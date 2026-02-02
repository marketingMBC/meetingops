import prisma from '../../db';
import {
  fetchThreadMessages,
  fetchChannelMessages,
  postMessage,
  postBlockMessage,
  formatTasksAsBlocks,
  formatCheckInMessage,
  getUserInfo,
} from '../../slack/client';
import { parseCheckInResponse } from '../../llm/client';
import type { FlowNode, RunContext, NodeOutput, Task } from '../../types';

/**
 * Slack Command Trigger - Entry point for /tasks command
 * Expects ctx.inputs['_trigger'] to contain slack command payload
 */
export async function handleSlackCommandTrigger(
  node: FlowNode,
  ctx: RunContext
): Promise<NodeOutput> {
  try {
    const triggerData = ctx.inputs['_trigger']?.data as any;
    if (!triggerData) {
      return { success: false, error: 'No trigger data provided' };
    }

    const { channel_id, thread_ts, user_id } = triggerData;

    ctx.logs.push(`Processing /tasks in channel ${channel_id}`);

    // Check for duplicate processing
    if (thread_ts) {
      const existing = await prisma.processedSlackThread.findUnique({
        where: {
          channelId_threadTs: {
            channelId: channel_id,
            threadTs: thread_ts,
          },
        },
      });

      if (existing) {
        ctx.logs.push('Thread already processed, skipping');
        return {
          success: true,
          data: {
            skipped: true,
            reason: 'Thread already processed',
          },
        };
      }
    }

    // Fetch messages
    let messages;
    if (thread_ts) {
      ctx.logs.push('Fetching thread messages...');
      messages = await fetchThreadMessages(channel_id, thread_ts);
    } else {
      ctx.logs.push('Fetching recent channel messages...');
      messages = await fetchChannelMessages(channel_id, 20);
    }

    // Format messages as conversation text
    const conversationText = await Promise.all(
      messages.map(async (msg) => {
        const userInfo = await getUserInfo(msg.user);
        return `${userInfo.realName}: ${msg.text}`;
      })
    ).then((lines) => lines.join('\n'));

    ctx.logs.push(`Collected ${messages.length} messages`);

    // Construct Slack thread URL
    const slackThread = thread_ts
      ? `https://slack.com/archives/${channel_id}/p${thread_ts.replace('.', '')}`
      : undefined;

    return {
      success: true,
      data: {
        channelId: channel_id,
        threadTs: thread_ts,
        userId: user_id,
        conversationText,
        messageCount: messages.length,
        slackThread,
      },
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    ctx.logs.push(`Slack command trigger error: ${msg}`);
    return { success: false, error: msg };
  }
}

/**
 * Post Summary to Slack - Posts created tasks back to Slack
 */
export async function handleSlackPostSummary(
  node: FlowNode,
  ctx: RunContext
): Promise<NodeOutput> {
  try {
    // Collect data from previous nodes
    const previousOutputs = Object.values(ctx.inputs);
    let channelId: string | undefined;
    let threadTs: string | undefined;
    let tasks: Task[] = [];
    let created = 0;

    for (const output of previousOutputs) {
      if (output.success && output.data) {
        const data = output.data as any;
        if (data.channelId) channelId = data.channelId;
        if (data.threadTs) threadTs = data.threadTs;
        if (data.tasks) tasks = data.tasks;
        if (data.created) created = data.created;
      }
    }

    if (!channelId) {
      return { success: false, error: 'No channel ID found' };
    }

    if (tasks.length === 0) {
      // Post "no tasks found" message
      await postMessage(
        channelId,
        ':mag: No actionable tasks found in this conversation.',
        threadTs
      );
      return { success: true, data: { posted: true, tasksCount: 0 } };
    }

    // Format and post tasks
    const blocks = formatTasksAsBlocks(tasks);
    const fallbackText = `Created ${created} tasks from this conversation`;

    await postBlockMessage(channelId, blocks, fallbackText, threadTs);

    // Mark thread as processed
    if (threadTs) {
      await prisma.processedSlackThread.upsert({
        where: {
          channelId_threadTs: {
            channelId,
            threadTs,
          },
        },
        create: {
          channelId,
          threadTs,
          tasksCreated: created,
        },
        update: {
          tasksCreated: created,
        },
      });
    }

    ctx.logs.push(`Posted summary with ${tasks.length} tasks to Slack`);

    return {
      success: true,
      data: {
        posted: true,
        tasksCount: tasks.length,
      },
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    ctx.logs.push(`Slack post summary error: ${msg}`);
    return { success: false, error: msg };
  }
}

/**
 * Ask Update - Posts daily check-in message to configured channels
 */
export async function handleSlackAskUpdate(
  node: FlowNode,
  ctx: RunContext
): Promise<NodeOutput> {
  try {
    // Get configured channels
    const channels = await prisma.slackChannelConfig.findMany({
      where: { isActive: true },
    });

    if (channels.length === 0) {
      ctx.logs.push('No channels configured for check-in');
      return { success: true, data: { posted: 0 } };
    }

    const blocks = formatCheckInMessage();
    const fallbackText = 'Daily Check-in: What did you complete today? What\'s still pending?';

    const postedTo: string[] = [];

    for (const channel of channels) {
      try {
        const messageTs = await postBlockMessage(
          channel.channelId,
          blocks,
          fallbackText
        );

        // Record the check-in
        await prisma.dailyCheckIn.create({
          data: {
            channelId: channel.channelId,
            messageTs,
            date: new Date(),
          },
        });

        postedTo.push(channel.channelName);
        ctx.logs.push(`Posted check-in to ${channel.channelName}`);
      } catch (error) {
        ctx.logs.push(`Failed to post to ${channel.channelName}: ${error}`);
      }
    }

    return {
      success: true,
      data: {
        posted: postedTo.length,
        channels: postedTo,
      },
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    ctx.logs.push(`Slack ask update error: ${msg}`);
    return { success: false, error: msg };
  }
}

/**
 * Process Check-in Responses - Collects and parses thread replies
 * This would typically be triggered by a Slack event or a scheduled job
 */
export async function processCheckInResponses(
  checkInId: string
): Promise<{ completed: string[]; pending: string[]; responseCount: number }> {
  const checkIn = await prisma.dailyCheckIn.findUnique({
    where: { id: checkInId },
    include: { channel: true },
  });

  if (!checkIn) {
    throw new Error(`Check-in ${checkInId} not found`);
  }

  // Fetch thread replies
  const messages = await fetchThreadMessages(checkIn.channelId, checkIn.messageTs);

  // Skip the original message
  const replies = messages.filter((m) => m.ts !== checkIn.messageTs);

  const allCompleted: string[] = [];
  const allPending: string[] = [];

  for (const reply of replies) {
    const userInfo = await getUserInfo(reply.user);

    // Parse the response
    const { completed, pending } = await parseCheckInResponse(reply.text);

    // Store the response
    await prisma.dailyCheckInResponse.upsert({
      where: {
        id: `${checkInId}_${reply.ts}`, // Composite key
      },
      create: {
        id: `${checkInId}_${reply.ts}`,
        checkInId,
        userId: reply.user,
        userName: userInfo.realName,
        responseText: reply.text,
        responseTs: reply.ts,
        completedItems: JSON.stringify(completed),
        pendingItems: JSON.stringify(pending),
      },
      update: {
        responseText: reply.text,
        completedItems: JSON.stringify(completed),
        pendingItems: JSON.stringify(pending),
      },
    });

    allCompleted.push(...completed);
    allPending.push(...pending);
  }

  return {
    completed: allCompleted,
    pending: allPending,
    responseCount: replies.length,
  };
}
