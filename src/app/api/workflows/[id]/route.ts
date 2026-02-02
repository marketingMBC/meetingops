import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET a single workflow
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

    const workflow = await prisma.workflow.findUnique({
      where: { id },
      include: {
        runs: {
          orderBy: { startedAt: 'desc' },
          take: 10,
          select: {
            id: true,
            status: true,
            trigger: true,
            startedAt: true,
            completedAt: true,
          },
        },
      },
    });

    if (!workflow) {
      return NextResponse.json(
        { success: false, error: 'Workflow not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        ...workflow,
        flowJson: JSON.parse(workflow.flowJson),
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error fetching workflow:', message);

    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}

// PUT update a workflow
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { name, description, flowJson, isActive } = body;

    const workflow = await prisma.workflow.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description }),
        ...(flowJson !== undefined && {
          flowJson: typeof flowJson === 'string' ? flowJson : JSON.stringify(flowJson),
        }),
        ...(isActive !== undefined && { isActive }),
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        ...workflow,
        flowJson: JSON.parse(workflow.flowJson),
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error updating workflow:', message);

    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}

// DELETE a workflow
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

    await prisma.workflow.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
      data: { deleted: id },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error deleting workflow:', message);

    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
