import { extractTasks } from '../../llm/client';
import type { FlowNode, RunContext, NodeOutput } from '../../types';

/**
 * LLM Extract Tasks - Uses LLM to extract tasks from text
 */
export async function handleLLMExtractTasks(
  node: FlowNode,
  ctx: RunContext
): Promise<NodeOutput> {
  try {
    // Get input from previous nodes
    const previousOutputs = Object.values(ctx.inputs);

    // Check for Notion meetings
    for (const output of previousOutputs) {
      if (output.success && output.data) {
        const data = output.data as any;

        // Handle Notion meetings
        if (data.meetings && Array.isArray(data.meetings)) {
          ctx.logs.push(`Extracting tasks from ${data.meetings.length} meetings`);

          const allTasks = [];
          for (const meeting of data.meetings) {
            const content = meeting.content || meeting.summary;
            if (!content) continue;

            const result = await extractTasks(content, 'notion', meeting.url);
            allTasks.push(
              ...result.tasks.map((t) => ({
                ...t,
                meetingId: meeting.id,
              }))
            );
            ctx.logs.push(`Extracted ${result.tasks.length} tasks from meeting: ${meeting.title}`);
          }

          return {
            success: true,
            data: {
              tasks: allTasks,
              source: 'notion',
              meetingIds: data.meetings.map((m: any) => m.id),
            },
          };
        }

        // Handle Slack conversation
        if (data.conversationText) {
          ctx.logs.push('Extracting tasks from Slack conversation');

          const result = await extractTasks(
            data.conversationText,
            'slack',
            data.slackThread
          );

          ctx.logs.push(`Extracted ${result.tasks.length} tasks`);

          return {
            success: true,
            data: {
              tasks: result.tasks,
              source: 'slack',
              channelId: data.channelId,
              threadTs: data.threadTs,
              slackThread: data.slackThread,
            },
          };
        }
      }
    }

    ctx.logs.push('No content found to extract tasks from');
    return {
      success: true,
      data: { tasks: [], source: 'unknown' },
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    ctx.logs.push(`LLM extract error: ${msg}`);
    return { success: false, error: msg };
  }
}
