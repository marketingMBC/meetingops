import { NextRequest, NextResponse } from 'next/server';
import { verifySlackSignature } from '@/lib/slack/client';
import { processCheckInResponses } from '@/lib/workflow/nodes/slack';
import prisma from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    // Get raw body for signature verification
    const rawBody = await request.text();
    const body = JSON.parse(rawBody);

    // Handle Slack URL verification challenge
    if (body.type === 'url_verification') {
      return NextResponse.json({ challenge: body.challenge });
    }

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

    // Handle events
    if (body.type === 'event_callback') {
      const event = body.event;

      // Handle thread replies (potential check-in responses)
      if (event.type === 'message' && event.thread_ts) {
        // Check if this is a reply to a check-in message
        const checkIn = await prisma.dailyCheckIn.findFirst({
          where: {
            channelId: event.channel,
            messageTs: event.thread_ts,
          },
        });

        if (checkIn) {
          // Process check-in responses asynchronously
          processCheckInResponses(checkIn.id).catch((error) => {
            console.error('Error processing check-in responses:', error);
          });
        }
      }

      // Handle app mentions (optional: could trigger /tasks-like behavior)
      if (event.type === 'app_mention') {
        // TODO: Optionally implement @bot tasks extraction
        console.log('App mentioned:', event.text);
      }
    }

    // Acknowledge receipt
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Slack event error:', message);

    // Still return 200 to prevent Slack retries
    return NextResponse.json({ ok: true });
  }
}
