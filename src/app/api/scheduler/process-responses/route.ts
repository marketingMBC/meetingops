import { NextRequest, NextResponse } from 'next/server';
import { processCheckInResponses } from '@/lib/workflow/nodes/slack';
import { runWorkflow } from '@/lib/workflow/runner';
import prisma from '@/lib/db';

// This endpoint processes check-in responses and updates task statuses
// Schedule: 0 22 * * * (every day at 10pm Chile time, 3 hours after check-in)

export async function GET(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  try {
    // Get today's check-ins
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const checkIns = await prisma.dailyCheckIn.findMany({
      where: {
        date: { gte: today },
      },
    });

    const results = [];

    for (const checkIn of checkIns) {
      try {
        const result = await processCheckInResponses(checkIn.id);
        results.push({
          checkInId: checkIn.id,
          channelId: checkIn.channelId,
          ...result,
        });

        // If there are completed items, run the task updater workflow
        if (result.completed.length > 0) {
          // Find or create task updater workflow
          let workflow = await prisma.workflow.findFirst({
            where: { name: 'task-updater-workflow' },
          });

          if (!workflow) {
            workflow = await prisma.workflow.create({
              data: {
                name: 'task-updater-workflow',
                description: 'Updates task status based on check-in responses',
                flowJson: JSON.stringify({
                  nodes: [
                    {
                      id: 'updater',
                      type: 'custom',
                      position: { x: 100, y: 100 },
                      data: { label: 'Update Tasks', type: 'task_updater' },
                    },
                  ],
                  edges: [],
                }),
              },
            });
          }

          await runWorkflow(workflow.id, 'scheduler', {
            completedItems: result.completed,
            checkInId: checkIn.id,
          });
        }
      } catch (error) {
        console.error(`Error processing check-in ${checkIn.id}:`, error);
        results.push({
          checkInId: checkIn.id,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        processedCheckIns: checkIns.length,
        results,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Process responses error:', message);

    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  return GET(request);
}
