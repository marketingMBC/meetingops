import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Delete existing workflows to reset
  await prisma.workflowRun.deleteMany({});
  await prisma.workflow.deleteMany({});

  // =============================================
  // WORKFLOW 1: Notion Meetings -> Tasks
  // =============================================
  const notionWorkflow = await prisma.workflow.create({
    data: {
      id: 'notion-meetings-workflow',
      name: 'Notion Meetings to Tasks',
      description: 'Polls Notion for new meetings and extracts tasks automatically',
      flowJson: JSON.stringify({
        nodes: [
          {
            id: 'notion-trigger',
            type: 'custom',
            position: { x: 250, y: 200 },
            data: {
              label: 'Notion Poll',
              type: 'notion_trigger',
              config: { lastSyncHours: 24 },
            },
          },
          {
            id: 'llm-extract',
            type: 'custom',
            position: { x: 550, y: 200 },
            data: { label: 'Extract Tasks', type: 'llm_extract_tasks' },
          },
          {
            id: 'notion-create',
            type: 'custom',
            position: { x: 850, y: 200 },
            data: { label: 'Create in Notion', type: 'notion_create_tasks' },
          },
        ],
        edges: [
          { id: 'e1', source: 'notion-trigger', target: 'llm-extract' },
          { id: 'e2', source: 'llm-extract', target: 'notion-create' },
        ],
      }),
    },
  });

  // =============================================
  // WORKFLOW 2: Slack /tasks Command
  // =============================================
  const slackWorkflow = await prisma.workflow.create({
    data: {
      id: 'slack-tasks-workflow',
      name: 'Slack /tasks Command',
      description: 'Extracts tasks from Slack conversations and creates them in Notion',
      flowJson: JSON.stringify({
        nodes: [
          {
            id: 'slack-trigger',
            type: 'custom',
            position: { x: 150, y: 200 },
            data: { label: '/tasks Command', type: 'slack_command_trigger' },
          },
          {
            id: 'llm-extract',
            type: 'custom',
            position: { x: 400, y: 200 },
            data: { label: 'Extract Tasks', type: 'llm_extract_tasks' },
          },
          {
            id: 'notion-create',
            type: 'custom',
            position: { x: 650, y: 200 },
            data: { label: 'Create in Notion', type: 'notion_create_tasks' },
          },
          {
            id: 'slack-post',
            type: 'custom',
            position: { x: 900, y: 200 },
            data: { label: 'Post Summary', type: 'slack_post_summary' },
          },
        ],
        edges: [
          { id: 'e1', source: 'slack-trigger', target: 'llm-extract' },
          { id: 'e2', source: 'llm-extract', target: 'notion-create' },
          { id: 'e3', source: 'notion-create', target: 'slack-post' },
        ],
      }),
    },
  });

  // =============================================
  // WORKFLOW 3: Daily Check-in 7pm Chile
  // =============================================
  const dailyWorkflow = await prisma.workflow.create({
    data: {
      id: 'daily-checkin-workflow',
      name: 'Daily Check-in 7pm Chile',
      description: 'Posts daily check-in to Slack and processes responses to update tasks',
      flowJson: JSON.stringify({
        nodes: [
          {
            id: 'scheduler',
            type: 'custom',
            position: { x: 200, y: 150 },
            data: {
              label: 'Daily 7pm Chile',
              type: 'daily_scheduler',
              config: { timezone: 'America/Santiago', time: '19:00' },
            },
          },
          {
            id: 'ask-update',
            type: 'custom',
            position: { x: 500, y: 150 },
            data: { label: 'Post Check-in', type: 'slack_ask_update' },
          },
          {
            id: 'task-updater',
            type: 'custom',
            position: { x: 800, y: 150 },
            data: { label: 'Update Tasks', type: 'task_updater' },
          },
        ],
        edges: [
          { id: 'e1', source: 'scheduler', target: 'ask-update' },
          { id: 'e2', source: 'ask-update', target: 'task-updater' },
        ],
      }),
    },
  });

  // =============================================
  // WORKFLOW 4: Complete Pipeline (Demo)
  // =============================================
  const fullWorkflow = await prisma.workflow.create({
    data: {
      id: 'full-pipeline-workflow',
      name: 'Complete MeetingOps Pipeline',
      description: 'Full demo: Notion meetings + Slack tasks + Daily check-in',
      flowJson: JSON.stringify({
        nodes: [
          // Row 1: Notion flow
          {
            id: 'notion-trigger',
            type: 'custom',
            position: { x: 150, y: 100 },
            data: { label: 'Notion Poll', type: 'notion_trigger' },
          },
          {
            id: 'llm-extract-1',
            type: 'custom',
            position: { x: 450, y: 100 },
            data: { label: 'Extract Tasks', type: 'llm_extract_tasks' },
          },
          {
            id: 'notion-create-1',
            type: 'custom',
            position: { x: 750, y: 100 },
            data: { label: 'Create Tasks', type: 'notion_create_tasks' },
          },
          // Row 2: Slack /tasks flow
          {
            id: 'slack-trigger',
            type: 'custom',
            position: { x: 150, y: 250 },
            data: { label: '/tasks Command', type: 'slack_command_trigger' },
          },
          {
            id: 'llm-extract-2',
            type: 'custom',
            position: { x: 450, y: 250 },
            data: { label: 'Extract Tasks', type: 'llm_extract_tasks' },
          },
          {
            id: 'notion-create-2',
            type: 'custom',
            position: { x: 750, y: 250 },
            data: { label: 'Create Tasks', type: 'notion_create_tasks' },
          },
          {
            id: 'slack-post',
            type: 'custom',
            position: { x: 1050, y: 250 },
            data: { label: 'Post Summary', type: 'slack_post_summary' },
          },
          // Row 3: Daily check-in flow
          {
            id: 'scheduler',
            type: 'custom',
            position: { x: 150, y: 400 },
            data: { label: 'Daily 7pm', type: 'daily_scheduler' },
          },
          {
            id: 'ask-update',
            type: 'custom',
            position: { x: 450, y: 400 },
            data: { label: 'Ask Update', type: 'slack_ask_update' },
          },
          {
            id: 'task-updater',
            type: 'custom',
            position: { x: 750, y: 400 },
            data: { label: 'Update Status', type: 'task_updater' },
          },
        ],
        edges: [
          // Notion flow
          { id: 'e1', source: 'notion-trigger', target: 'llm-extract-1' },
          { id: 'e2', source: 'llm-extract-1', target: 'notion-create-1' },
          // Slack flow
          { id: 'e3', source: 'slack-trigger', target: 'llm-extract-2' },
          { id: 'e4', source: 'llm-extract-2', target: 'notion-create-2' },
          { id: 'e5', source: 'notion-create-2', target: 'slack-post' },
          // Daily flow
          { id: 'e6', source: 'scheduler', target: 'ask-update' },
          { id: 'e7', source: 'ask-update', target: 'task-updater' },
        ],
      }),
    },
  });

  console.log('Created workflows:');
  console.log('  1. Notion Meetings to Tasks:', notionWorkflow.id);
  console.log('  2. Slack /tasks Command:', slackWorkflow.id);
  console.log('  3. Daily Check-in 7pm Chile:', dailyWorkflow.id);
  console.log('  4. Complete Pipeline (Demo):', fullWorkflow.id);

  console.log('\nSeed completed!');
  console.log('\nGo to http://localhost:3000/workflows to see your workflows');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
