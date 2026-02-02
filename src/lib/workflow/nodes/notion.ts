import prisma from '../../db';
import { fetchMeetings, getPageContent, createTask, updateTaskStatus } from '../../notion/client';
import type { FlowNode, RunContext, NodeOutput, NotionTask, Task } from '../../types';

/**
 * Notion Trigger - Fetches new/updated meetings from Notion
 */
export async function handleNotionTrigger(
  node: FlowNode,
  ctx: RunContext
): Promise<NodeOutput> {
  try {
    ctx.logs.push('Fetching meetings from Notion...');

    // Get last sync time from config (optional)
    const config = node.data.config || {};
    const lastSyncHours = (config.lastSyncHours as number) || 24;
    const lastSyncTime = new Date(Date.now() - lastSyncHours * 60 * 60 * 1000);

    // Fetch meetings
    const meetings = await fetchMeetings(lastSyncTime);
    ctx.logs.push(`Found ${meetings.length} meetings`);

    // Filter out already processed meetings
    const processedIds = await prisma.processedMeeting.findMany({
      where: {
        notionPageId: { in: meetings.map((m) => m.id) },
      },
      select: { notionPageId: true },
    });
    const processedSet = new Set(processedIds.map((p) => p.notionPageId));

    const newMeetings = meetings.filter((m) => !processedSet.has(m.id));
    ctx.logs.push(`${newMeetings.length} new meetings to process`);

    // For each meeting, get full content if summary is short
    const meetingsWithContent = await Promise.all(
      newMeetings.map(async (meeting) => {
        let content = meeting.summary;
        if (content.length < 100) {
          const fullContent = await getPageContent(meeting.id);
          content = fullContent || content;
        }
        return { ...meeting, content };
      })
    );

    return {
      success: true,
      data: {
        meetings: meetingsWithContent,
        count: meetingsWithContent.length,
      },
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    ctx.logs.push(`Notion trigger error: ${msg}`);
    return { success: false, error: msg };
  }
}

/**
 * Create Tasks in Notion - Takes extracted tasks and creates them in Notion
 */
export async function handleNotionCreateTasks(
  node: FlowNode,
  ctx: RunContext
): Promise<NodeOutput> {
  try {
    // Get tasks from previous node output
    const previousOutputs = Object.values(ctx.inputs);
    let tasks: Task[] = [];
    let meetingId: string | undefined;
    let slackThread: string | undefined;

    for (const output of previousOutputs) {
      if (output.success && output.data) {
        const data = output.data as any;
        if (data.tasks) {
          tasks = data.tasks;
        }
        if (data.meetingId) {
          meetingId = data.meetingId;
        }
        if (data.slackThread) {
          slackThread = data.slackThread;
        }
      }
    }

    if (tasks.length === 0) {
      ctx.logs.push('No tasks to create');
      return { success: true, data: { created: 0 } };
    }

    ctx.logs.push(`Creating ${tasks.length} tasks in Notion...`);

    const createdIds: string[] = [];
    for (const task of tasks) {
      const notionTask: NotionTask = {
        title: task.title,
        description: task.description,
        owner: task.owner || undefined,
        status: 'Todo',
        sourceUrl: task.sourceUrl || undefined,
        meetingId,
        slackThread,
      };

      const taskId = await createTask(notionTask);
      createdIds.push(taskId);

      // Create task mapping for future matching
      await prisma.taskMapping.create({
        data: {
          notionTaskId: taskId,
          notionTaskTitle: task.title,
          normalizedTitle: task.title.toLowerCase().trim(),
          ownerName: task.owner,
          status: 'todo',
        },
      });

      ctx.logs.push(`Created task: ${task.title}`);
    }

    // Mark meeting as processed if this came from a meeting
    if (meetingId) {
      await prisma.processedMeeting.upsert({
        where: { notionPageId: meetingId },
        create: {
          notionPageId: meetingId,
          notionPageTitle: 'Meeting',
          tasksCreated: tasks.length,
          workflowRunId: ctx.runId,
        },
        update: {
          tasksCreated: { increment: tasks.length },
        },
      });
    }

    return {
      success: true,
      data: {
        created: createdIds.length,
        taskIds: createdIds,
      },
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    ctx.logs.push(`Create tasks error: ${msg}`);
    return { success: false, error: msg };
  }
}

/**
 * Task Updater - Updates task status based on check-in responses
 */
export async function handleTaskUpdater(
  node: FlowNode,
  ctx: RunContext
): Promise<NodeOutput> {
  try {
    // Get completed items from previous node
    const previousOutputs = Object.values(ctx.inputs);
    let completedItems: string[] = [];

    for (const output of previousOutputs) {
      if (output.success && output.data) {
        const data = output.data as any;
        if (data.completedItems) {
          completedItems = data.completedItems;
        }
      }
    }

    if (completedItems.length === 0) {
      ctx.logs.push('No completed items to process');
      return { success: true, data: { matched: 0 } };
    }

    ctx.logs.push(`Attempting to match ${completedItems.length} completed items...`);

    // Get all active task mappings
    const activeTasks = await prisma.taskMapping.findMany({
      where: { status: { not: 'done' } },
    });

    const matchedTasks: { id: string; title: string }[] = [];

    for (const item of completedItems) {
      const normalizedItem = item.toLowerCase().trim();

      // Simple fuzzy matching: check if task title is contained in the item or vice versa
      for (const task of activeTasks) {
        const similarity = calculateSimilarity(normalizedItem, task.normalizedTitle);
        if (similarity > 0.5) {
          // Update in Notion
          await updateTaskStatus(task.notionTaskId, 'Done');

          // Update local mapping
          await prisma.taskMapping.update({
            where: { id: task.id },
            data: { status: 'done' },
          });

          matchedTasks.push({ id: task.notionTaskId, title: task.notionTaskTitle });
          ctx.logs.push(`Matched and closed: ${task.notionTaskTitle}`);
          break;
        }
      }
    }

    return {
      success: true,
      data: {
        matched: matchedTasks.length,
        matchedTasks,
      },
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    ctx.logs.push(`Task updater error: ${msg}`);
    return { success: false, error: msg };
  }
}

/**
 * Simple word overlap similarity (0-1)
 */
function calculateSimilarity(a: string, b: string): number {
  const wordsA = new Set(a.split(/\s+/).filter((w) => w.length > 2));
  const wordsB = new Set(b.split(/\s+/).filter((w) => w.length > 2));

  if (wordsA.size === 0 || wordsB.size === 0) return 0;

  let overlap = 0;
  for (const word of wordsA) {
    if (wordsB.has(word)) overlap++;
  }

  return overlap / Math.max(wordsA.size, wordsB.size);
}
