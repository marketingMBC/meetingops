import { NextRequest, NextResponse } from 'next/server';
import { runWorkflow } from '@/lib/workflow/runner';
import prisma from '@/lib/db';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// POST run a workflow
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

    // Verify workflow exists
    const workflow = await prisma.workflow.findUnique({
      where: { id },
    });

    if (!workflow) {
      return NextResponse.json(
        { success: false, error: 'Workflow not found' },
        { status: 404 }
      );
    }

    // Get optional input from body
    let inputData: Record<string, unknown> | undefined;
    try {
      const body = await request.json();
      inputData = body.input;
    } catch {
      // No body provided, that's fine
    }

    // Run the workflow
    const result = await runWorkflow(id, 'manual', inputData);

    return NextResponse.json({
      success: true,
      data: {
        runId: result.runId,
        workflowId: id,
        workflowName: workflow.name,
        success: result.success,
        outputs: result.outputs,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error running workflow:', message);

    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
