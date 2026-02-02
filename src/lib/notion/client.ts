import { Client } from '@notionhq/client';
import type { NotionMeeting, NotionTask } from '../types';

// Initialize Notion client
const notion = new Client({
  auth: process.env.NOTION_TOKEN,
});

const MEETINGS_DB_ID = process.env.NOTION_MEETINGS_DB_ID!;
const TASKS_DB_ID = process.env.NOTION_TASKS_DB_ID!;

/**
 * Fetch meetings from Notion Meetings DB
 * Adapted for user's database structure:
 * - "Name" (title)
 * - "Date of Meeting" (date)
 * - "Resumen" (rich_text with summary + action items)
 * - "Text" (rich_text with additional content)
 */
export async function fetchMeetings(lastSyncTime?: Date): Promise<NotionMeeting[]> {
  const filter = lastSyncTime
    ? {
        timestamp: 'last_edited_time' as const,
        last_edited_time: {
          after: lastSyncTime.toISOString(),
        },
      }
    : undefined;

  const response = await notion.databases.query({
    database_id: MEETINGS_DB_ID,
    filter,
    sorts: [{ timestamp: 'last_edited_time', direction: 'descending' }],
  });

  const meetings: NotionMeeting[] = [];

  for (const page of response.results) {
    if (!('properties' in page)) continue;

    const properties = page.properties as Record<string, any>;

    // Extract title from "Name"
    const titleProp = properties.Name || properties.Title;
    const title = titleProp?.title?.[0]?.plain_text || 'Untitled';

    // Extract summary from "Resumen" field (contains summary + action items)
    const resumenProp = properties.Resumen || properties.Summary;
    const resumen = resumenProp?.rich_text
      ?.map((t: any) => t.plain_text)
      .join('') || '';

    // Also get "Text" field for additional content
    const textProp = properties.Text;
    const text = textProp?.rich_text
      ?.map((t: any) => t.plain_text)
      .join('') || '';

    // Combine both fields for full content
    const summary = [resumen, text].filter(Boolean).join('\n\n');

    // Extract date from "Date of Meeting"
    const dateProp = properties['Date of Meeting'] || properties.Date;
    const date = dateProp?.date?.start || null;

    // Construct URL
    const url = `https://notion.so/${page.id.replace(/-/g, '')}`;

    meetings.push({
      id: page.id,
      title,
      summary,
      date,
      url,
    });
  }

  return meetings;
}

/**
 * Get full page content (blocks) for deeper extraction
 */
export async function getPageContent(pageId: string): Promise<string> {
  const blocks = await notion.blocks.children.list({
    block_id: pageId,
    page_size: 100,
  });

  let content = '';

  for (const block of blocks.results) {
    if (!('type' in block)) continue;

    const blockType = block.type;
    const blockContent = (block as any)[blockType];

    if (blockContent?.rich_text) {
      content += blockContent.rich_text
        .map((t: any) => t.plain_text)
        .join('') + '\n';
    }
  }

  return content;
}

/**
 * Create a task in Notion Tasks DB
 * Adapted for user's database structure:
 * - "Task name" (title)
 * - "Responsable" (text)
 * - "Priority" (select: P0, P1, P2)
 * - "Due" (date)
 * - "Status" (select: Not Started, In Progress, Done)
 */
export async function createTask(task: NotionTask): Promise<string> {
  // Map status to user's format
  const statusMap: Record<string, string> = {
    'Todo': 'Not Started',
    'Doing': 'In Progress',
    'Done': 'Done',
    'Pending': 'Not Started',
  };
  const mappedStatus = statusMap[task.status] || 'Not Started';

  const properties: Record<string, any> = {
    'Task name': {
      title: [{ text: { content: task.title } }],
    },
    Status: {
      select: { name: mappedStatus },
    },
  };

  // Add Responsable (owner)
  if (task.owner) {
    properties.Responsable = {
      rich_text: [{ text: { content: task.owner } }],
    };
  }

  // Add Priority if provided (default to P1)
  if (task.priority) {
    const priorityMap: Record<string, string> = {
      'high': 'P0',
      'medium': 'P1',
      'low': 'P2',
    };
    properties.Priority = {
      select: { name: priorityMap[task.priority] || 'P1' },
    };
  }

  // Add Due date if provided
  if (task.dueDate) {
    properties.Due = {
      date: { start: task.dueDate },
    };
  }

  const response = await notion.pages.create({
    parent: { database_id: TASKS_DB_ID },
    properties,
  });

  return response.id;
}

/**
 * Update task status in Notion
 * Maps to user's status format: Not Started, In Progress, Done
 */
export async function updateTaskStatus(
  taskId: string,
  status: 'Todo' | 'Doing' | 'Done'
): Promise<void> {
  const statusMap: Record<string, string> = {
    'Todo': 'Not Started',
    'Doing': 'In Progress',
    'Done': 'Done',
  };

  await notion.pages.update({
    page_id: taskId,
    properties: {
      Status: {
        select: { name: statusMap[status] || status },
      },
    },
  });
}

/**
 * Search for a task by title (fuzzy match)
 */
export async function findTaskByTitle(title: string): Promise<{ id: string; title: string } | null> {
  const response = await notion.databases.query({
    database_id: TASKS_DB_ID,
    filter: {
      property: 'Task name',
      title: {
        contains: title.toLowerCase().slice(0, 50), // First 50 chars for matching
      },
    },
  });

  if (response.results.length === 0) return null;

  const page = response.results[0];
  if (!('properties' in page)) return null;

  const titleProp = (page.properties as any)['Task name'];
  const foundTitle = titleProp?.title?.[0]?.plain_text || '';

  return {
    id: page.id,
    title: foundTitle,
  };
}

/**
 * Fetch all tasks (for mapping/matching)
 */
export async function fetchAllTasks(): Promise<{ id: string; title: string; status: string }[]> {
  const response = await notion.databases.query({
    database_id: TASKS_DB_ID,
    filter: {
      property: 'Status',
      select: {
        does_not_equal: 'Done',
      },
    },
  });

  // Map user's status back to internal format
  const reverseStatusMap: Record<string, string> = {
    'Not Started': 'Todo',
    'In Progress': 'Doing',
    'Done': 'Done',
  };

  return response.results
    .filter((page): page is typeof page & { properties: any } => 'properties' in page)
    .map((page) => ({
      id: page.id,
      title: page.properties['Task name']?.title?.[0]?.plain_text || '',
      status: reverseStatusMap[page.properties.Status?.select?.name] || 'Todo',
    }));
}

export { notion };
