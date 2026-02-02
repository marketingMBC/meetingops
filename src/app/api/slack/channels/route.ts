import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';

// GET all configured channels
export async function GET() {
  try {
    const channels = await prisma.slackChannelConfig.findMany({
      orderBy: { channelName: 'asc' },
      include: {
        _count: {
          select: { checkIns: true },
        },
      },
    });

    return NextResponse.json({
      success: true,
      data: channels,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error fetching channels:', message);

    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}

// POST add a channel for check-ins
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { channelId, channelName, timezone, checkInTime } = body;

    if (!channelId || !channelName) {
      return NextResponse.json(
        { success: false, error: 'channelId and channelName are required' },
        { status: 400 }
      );
    }

    const channel = await prisma.slackChannelConfig.upsert({
      where: { channelId },
      create: {
        channelId,
        channelName,
        timezone: timezone || 'America/Santiago',
        checkInTime: checkInTime || '19:00',
      },
      update: {
        channelName,
        ...(timezone && { timezone }),
        ...(checkInTime && { checkInTime }),
      },
    });

    return NextResponse.json({
      success: true,
      data: channel,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error adding channel:', message);

    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}

// DELETE remove a channel
export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const { channelId } = body;

    if (!channelId) {
      return NextResponse.json(
        { success: false, error: 'channelId is required' },
        { status: 400 }
      );
    }

    await prisma.slackChannelConfig.delete({
      where: { channelId },
    });

    return NextResponse.json({
      success: true,
      data: { deleted: channelId },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error deleting channel:', message);

    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
