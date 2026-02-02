import { toZonedTime, format } from 'date-fns-tz';
import type { FlowNode, RunContext, NodeOutput } from '../../types';

const DEFAULT_TIMEZONE = 'America/Santiago';

/**
 * Daily Scheduler - Entry point for scheduled workflows
 * Validates timing and prepares context for downstream nodes
 */
export async function handleDailyScheduler(
  node: FlowNode,
  ctx: RunContext
): Promise<NodeOutput> {
  try {
    const config = node.data.config || {};
    const timezone = (config.timezone as string) || DEFAULT_TIMEZONE;
    const scheduledTime = (config.time as string) || '19:00';

    // Get current time in configured timezone
    const now = new Date();
    const zonedTime = toZonedTime(now, timezone);
    const currentTime = format(zonedTime, 'HH:mm', { timeZone: timezone });
    const currentDate = format(zonedTime, 'yyyy-MM-dd', { timeZone: timezone });

    ctx.logs.push(`Scheduler triggered at ${currentTime} (${timezone})`);
    ctx.logs.push(`Scheduled time: ${scheduledTime}`);

    // For manual runs, always proceed
    // For scheduler runs, verify we're in the right time window (within 5 min)
    if (ctx.trigger === 'scheduler') {
      const [schedHour, schedMin] = scheduledTime.split(':').map(Number);
      const [currHour, currMin] = currentTime.split(':').map(Number);

      const schedMinutes = schedHour * 60 + schedMin;
      const currMinutes = currHour * 60 + currMin;

      if (Math.abs(currMinutes - schedMinutes) > 5) {
        ctx.logs.push('Outside scheduled time window, skipping');
        return {
          success: true,
          data: {
            skipped: true,
            reason: 'Outside scheduled time window',
          },
        };
      }
    }

    return {
      success: true,
      data: {
        scheduledTime,
        actualTime: currentTime,
        timezone,
        date: currentDate,
      },
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    ctx.logs.push(`Scheduler error: ${msg}`);
    return { success: false, error: msg };
  }
}
