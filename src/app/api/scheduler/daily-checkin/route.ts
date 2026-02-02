import { NextRequest, NextResponse } from 'next/server';
import { runWorkflow } from '@/lib/workflow/runner';
import prisma from '@/lib/db';

// This endpoint is called by a cron job (e.g., Vercel Cron, GitHub Actions, or external service)
// Schedule: 0 19 * * * (every day at 7pm Chile time)
// Note: Configure cron in your deployment platform with the correct timezone

export async function GET(request: NextRequest) {
  // Verify cron secret to prevent unauthorized access
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  try {
    // Find or create the daily check-in workflow
    let workflow = await prisma.workflow.findFirst({
      where: { name: 'daily-checkin-workflow' },
    });

    if (!workflow) {
      workflow = await prisma.workflow.create({
        data: {
          name: 'daily-checkin-workflow',
          description: 'Posts daily check-in to configured channels',
          flowJson: JSON.stringify({
            nodes: [
              {
                id: 'scheduler',
                type: 'custom',
                position: { x: 100, y: 100 },
                data: {
                  label: 'Daily 7pm Chile',
                  type: 'daily_scheduler',
                  config: {
                    timezone: 'America/Santiago',
                    time: '19:00',
                  },
                },
              },
              {
                id: 'ask',
                type: 'custom',
                position: { x: 300, y: 100 },
                data: { label: 'Post Check-in', type: 'slack_ask_update' },
              },
            ],
            edges: [
              { id: 'e1', source: 'scheduler', target: 'ask' },
            ],
          }),
        },
      });
    }

    // Run the workflow
    const result = await runWorkflow(workflow.id, 'scheduler');

    return NextResponse.json({
      success: true,
      data: {
        runId: result.runId,
        workflowSuccess: result.success,
        outputs: result.outputs,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Daily check-in error:', message);

    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}

// Also support POST for flexibility
export async function POST(request: NextRequest) {
  return GET(request);
}
