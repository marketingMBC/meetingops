import { NextRequest, NextResponse } from 'next/server';
import { fetchMeetings, getPageContent } from '@/lib/notion/client';
import prisma from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const hoursBack = parseInt(searchParams.get('hours') || '24', 10);

    const lastSyncTime = new Date(Date.now() - hoursBack * 60 * 60 * 1000);
    const meetings = await fetchMeetings(lastSyncTime);

    // Check which ones are already processed
    const processedIds = await prisma.processedMeeting.findMany({
      where: {
        notionPageId: { in: meetings.map((m) => m.id) },
      },
      select: { notionPageId: true },
    });
    const processedSet = new Set(processedIds.map((p) => p.notionPageId));

    const meetingsWithStatus = meetings.map((m) => ({
      ...m,
      processed: processedSet.has(m.id),
    }));

    return NextResponse.json({
      success: true,
      data: {
        meetings: meetingsWithStatus,
        total: meetings.length,
        unprocessed: meetings.length - processedSet.size,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error fetching meetings:', message);

    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}

// GET specific meeting content
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { pageId } = body;

    if (!pageId) {
      return NextResponse.json(
        { success: false, error: 'pageId is required' },
        { status: 400 }
      );
    }

    const content = await getPageContent(pageId);

    return NextResponse.json({
      success: true,
      data: { pageId, content },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error fetching meeting content:', message);

    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
