import { WebClient } from '@slack/web-api';
import crypto from 'crypto';
import type { SlackMessage } from '../types';

// Initialize Slack client
const slack = new WebClient(process.env.SLACK_BOT_TOKEN);

const SIGNING_SECRET = process.env.SLACK_SIGNING_SECRET!;

/**
 * Verify Slack request signature
 */
export function verifySlackSignature(
  signature: string,
  timestamp: string,
  body: string
): boolean {
  // Check timestamp is within 5 minutes
  const currentTime = Math.floor(Date.now() / 1000);
  if (Math.abs(currentTime - parseInt(timestamp)) > 60 * 5) {
    return false;
  }

  const sigBasestring = `v0:${timestamp}:${body}`;
  const mySignature = 'v0=' + crypto
    .createHmac('sha256', SIGNING_SECRET)
    .update(sigBasestring, 'utf8')
    .digest('hex');

  return crypto.timingSafeEqual(
    Buffer.from(mySignature, 'utf8'),
    Buffer.from(signature, 'utf8')
  );
}

/**
 * Fetch thread messages
 */
export async function fetchThreadMessages(
  channelId: string,
  threadTs: string
): Promise<SlackMessage[]> {
  const result = await slack.conversations.replies({
    channel: channelId,
    ts: threadTs,
    limit: 100,
  });

  if (!result.messages) return [];

  return result.messages.map((msg) => ({
    user: msg.user || 'unknown',
    text: msg.text || '',
    ts: msg.ts || '',
    thread_ts: msg.thread_ts,
  }));
}

/**
 * Fetch recent channel messages (when not in a thread)
 */
export async function fetchChannelMessages(
  channelId: string,
  limit: number = 20
): Promise<SlackMessage[]> {
  const result = await slack.conversations.history({
    channel: channelId,
    limit,
  });

  if (!result.messages) return [];

  // Reverse to get chronological order
  return result.messages.reverse().map((msg) => ({
    user: msg.user || 'unknown',
    text: msg.text || '',
    ts: msg.ts || '',
    thread_ts: msg.thread_ts,
  }));
}

/**
 * Post a message to a channel
 */
export async function postMessage(
  channelId: string,
  text: string,
  threadTs?: string
): Promise<string> {
  const result = await slack.chat.postMessage({
    channel: channelId,
    text,
    thread_ts: threadTs,
    mrkdwn: true,
  });

  return result.ts || '';
}

/**
 * Post a message with blocks (rich formatting)
 */
export async function postBlockMessage(
  channelId: string,
  blocks: any[],
  text: string, // Fallback text
  threadTs?: string
): Promise<string> {
  const result = await slack.chat.postMessage({
    channel: channelId,
    text,
    blocks,
    thread_ts: threadTs,
    mrkdwn: true,
  });

  return result.ts || '';
}

/**
 * Get user info by ID
 */
export async function getUserInfo(userId: string): Promise<{ name: string; realName: string }> {
  try {
    const result = await slack.users.info({ user: userId });
    return {
      name: result.user?.name || userId,
      realName: result.user?.real_name || result.user?.name || userId,
    };
  } catch {
    return { name: userId, realName: userId };
  }
}

/**
 * Resolve user mention to name
 * Input: <@U123ABC> or plain text
 */
export function extractUserMentions(text: string): string[] {
  const mentionRegex = /<@([A-Z0-9]+)>/g;
  const matches = text.matchAll(mentionRegex);
  return Array.from(matches).map((m) => m[1]);
}

/**
 * Format tasks as Slack blocks for display
 */
export function formatTasksAsBlocks(
  tasks: { title: string; owner?: string | null; dueDate?: string | null }[]
): any[] {
  const blocks: any[] = [
    {
      type: 'header',
      text: {
        type: 'plain_text',
        text: `:white_check_mark: ${tasks.length} Tasks Created`,
        emoji: true,
      },
    },
    { type: 'divider' },
  ];

  tasks.forEach((task, index) => {
    let text = `*${index + 1}. ${task.title}*`;
    if (task.owner) text += `\n   :bust_in_silhouette: ${task.owner}`;
    if (task.dueDate) text += `\n   :calendar: ${task.dueDate}`;

    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text,
      },
    });
  });

  return blocks;
}

/**
 * Format daily check-in message
 */
export function formatCheckInMessage(): any[] {
  return [
    {
      type: 'header',
      text: {
        type: 'plain_text',
        text: ':wave: Daily Check-in',
        emoji: true,
      },
    },
    { type: 'divider' },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: 'Hey team! Time for our daily update.\n\n*Please reply in this thread with:*',
      },
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: ':white_check_mark: What did you complete today?\n:hourglass_flowing_sand: What\'s still pending?\n:warning: Any blockers?',
      },
    },
    { type: 'divider' },
    {
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: '_Tip: Use bullet points for clarity. If you completed a task, I\'ll try to mark it as done in Notion!_',
        },
      ],
    },
  ];
}

export { slack };
