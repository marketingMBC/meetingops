import { NextRequest, NextResponse } from 'next/server';
import { verifySlackSignature } from '@/lib/slack/client';
import { runWorkflow } from '@/lib/workflow/runner';
import prisma from '@/lib/db';

// Default workflow ID for /tasks command - can be configured
const TASKS_WORKFLOW_ID = process.env.TASKS_WORKFLOW_ID || 'default-tasks-workflow';

export async function POST(request: NextRequest) {
  try {
    // Get raw body for signature verification
    const rawBody = await request.text();

    // Verify Slack signature
    const signature = request.headers.get('x-slack-signature') || '';
    const timestamp = request.headers.get('x-slack-request-timestamp') || '';

    if (!verifySlackSignature(signature, timestamp, rawBody)) {
      console.error('Invalid Slack signature');
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 401 }
      );
    }

    // Parse form data
    const params = new URLSearchParams(rawBody);
    const command = params.get('command');
    const channelId = params.get('channel_id');
    const channelName = params.get('channel_name');
    const userId = params.get('user_id');
    const userName = params.get('user_name');
    const text = params.get('text') || '';
    const responseUrl = params.get('response_url');

    // Handle the specific command
    if (command === '/tasks') {
      // Parse optional thread_ts from text (e.g., "/tasks in:thread")
      // For MVP, we'll check if triggered from a thread via Slack's built-in mechanism
      // Note: Slack includes thread_ts in the payload when command is in a thread

      // Acknowledge immediately (Slack requires response within 3 seconds)
      // We'll send the actual response via response_url

      // Find or create a workflow for /tasks
      let workflow = await prisma.workflow.findFirst({
        where: { name: 'slack-tasks-workflow' },
      });

      if (!workflow) {
        // Create default workflow
        workflow = await prisma.workflow.create({
          data: {
            name: 'slack-tasks-workflow',
            description: 'Extracts tasks from Slack conversations',
            flowJson: JSON.stringify({
              nodes: [
                {
                  id: 'trigger',
                  type: 'custom',
                  position: { x: 100, y: 100 },
                  data: { label: 'Slack Command', type: 'slack_command_trigger' },
                },
                {
                  id: 'extract',
                  type: 'custom',
                  position: { x: 300, y: 100 },
                  data: { label: 'Extract Tasks', type: 'llm_extract_tasks' },
                },
                {
                  id: 'create',
                  type: 'custom',
                  position: { x: 500, y: 100 },
                  data: { label: 'Create in Notion', type: 'notion_create_tasks' },
                },
                {
                  id: 'post',
                  type: 'custom',
                  position: { x: 700, y: 100 },
                  data: { label: 'Post Summary', type: 'slack_post_summary' },
                },
              ],
              edges: [
                { id: 'e1', source: 'trigger', target: 'extract' },
                { id: 'e2', source: 'extract', target: 'create' },
                { id: 'e3', source: 'create', target: 'post' },
              ],
            }),
          },
        });
      }

      // Run workflow asynchronously
      // In production, you might want to use a proper queue
      runWorkflow(workflow.id, 'slack_command', {
        channel_id: channelId,
        channel_name: channelName,
        user_id: userId,
        user_name: userName,
        text,
        response_url: responseUrl,
        // Note: thread_ts would be here if Slack provides it
      }).catch((error) => {
        console.error('Workflow error:', error);
      });

      // Return immediate acknowledgment
      return NextResponse.json({
        response_type: 'ephemeral',
        text: ':hourglass_flowing_sand: Processing your request... I\'ll post the results shortly.',
      });
    }

    // Unknown command
    return NextResponse.json({
      response_type: 'ephemeral',
      text: `Unknown command: ${command}`,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Slack command error:', message);

    return NextResponse.json({
      response_type: 'ephemeral',
      text: ':x: An error occurred processing your request.',
    });
  }
}
