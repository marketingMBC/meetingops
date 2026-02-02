import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';

// GET all workflows
export async function GET() {
  try {
    const workflows = await prisma.workflow.findMany({
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        name: true,
        description: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: { runs: true },
        },
      },
    });

    return NextResponse.json({
      success: true,
      data: workflows,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error fetching workflows:', message);

    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}

// POST create a new workflow
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, description, flowJson } = body;

    if (!name) {
      return NextResponse.json(
        { success: false, error: 'name is required' },
        { status: 400 }
      );
    }

    const workflow = await prisma.workflow.create({
      data: {
        name,
        description,
        flowJson: typeof flowJson === 'string' ? flowJson : JSON.stringify(flowJson || { nodes: [], edges: [] }),
      },
    });

    return NextResponse.json({
      success: true,
      data: workflow,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error creating workflow:', message);

    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
