import { NextRequest, NextResponse } from 'next/server';
import { createTask, fetchAllTasks, updateTaskStatus } from '@/lib/notion/client';
import prisma from '@/lib/db';
import { NotionTask } from '@/lib/types';

// GET all tasks (for UI display and matching)
export async function GET() {
  try {
    const tasks = await fetchAllTasks();

    return NextResponse.json({
      success: true,
      data: { tasks, count: tasks.length },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error fetching tasks:', message);

    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}

// POST create a new task
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { title, description, owner, status, sourceUrl, meetingId, slackThread } = body;

    if (!title) {
      return NextResponse.json(
        { success: false, error: 'title is required' },
        { status: 400 }
      );
    }

    const task: NotionTask = {
      title,
      description: description || '',
      owner,
      status: status || 'Todo',
      sourceUrl,
      meetingId,
      slackThread,
    };

    const taskId = await createTask(task);

    // Create local mapping
    await prisma.taskMapping.create({
      data: {
        notionTaskId: taskId,
        notionTaskTitle: title,
        normalizedTitle: title.toLowerCase().trim(),
        ownerName: owner,
        status: 'todo',
      },
    });

    return NextResponse.json({
      success: true,
      data: { taskId, title },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error creating task:', message);

    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}

// PATCH update task status
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { taskId, status } = body;

    if (!taskId || !status) {
      return NextResponse.json(
        { success: false, error: 'taskId and status are required' },
        { status: 400 }
      );
    }

    if (!['Todo', 'Doing', 'Done'].includes(status)) {
      return NextResponse.json(
        { success: false, error: 'status must be Todo, Doing, or Done' },
        { status: 400 }
      );
    }

    await updateTaskStatus(taskId, status);

    // Update local mapping
    await prisma.taskMapping.updateMany({
      where: { notionTaskId: taskId },
      data: { status: status.toLowerCase() },
    });

    return NextResponse.json({
      success: true,
      data: { taskId, status },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error updating task:', message);

    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
