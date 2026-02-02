import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';

interface RouteParams {
  params: Promise<{ runId: string }>;
}

// GET a workflow run details
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { runId } = await params;

    const run = await prisma.workflowRun.findUnique({
      where: { id: runId },
      include: {
        workflow: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!run) {
      return NextResponse.json(
        { success: false, error: 'Run not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        ...run,
        inputData: run.inputData ? JSON.parse(run.inputData) : null,
        outputData: run.outputData ? JSON.parse(run.outputData) : null,
        logs: run.logs ? JSON.parse(run.logs) : [],
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error fetching run:', message);

    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
