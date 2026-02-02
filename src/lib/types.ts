import { z } from 'zod';

// ============ Task Schema (from LLM extraction) ============
export const TaskSchema = z.object({
  title: z.string(),
  description: z.string(),
  owner: z.string().nullable(),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  priority: z.enum(['low', 'medium', 'high']).nullable().optional(),
  source: z.enum(['notion', 'slack']),
  sourceUrl: z.string().nullable().optional(),
});

export const ExtractedTasksSchema = z.object({
  tasks: z.array(TaskSchema),
});

export type Task = z.infer<typeof TaskSchema>;
export type ExtractedTasks = z.infer<typeof ExtractedTasksSchema>;

// ============ Workflow Node Types ============
export type NodeType =
  | 'notion_trigger'
  | 'llm_extract_tasks'
  | 'notion_create_tasks'
  | 'slack_command_trigger'
  | 'slack_post_summary'
  | 'daily_scheduler'
  | 'slack_ask_update'
  | 'task_updater';

export interface NodeData {
  label: string;
  type: NodeType;
  config?: Record<string, unknown>;
}

export interface FlowNode {
  id: string;
  type: string;
  position: { x: number; y: number };
  data: NodeData;
}

export interface FlowEdge {
  id: string;
  source: string;
  target: string;
}

export interface WorkflowDefinition {
  nodes: FlowNode[];
  edges: FlowEdge[];
}

// ============ Workflow Runner Types ============
export interface NodeInput {
  [key: string]: unknown;
}

export interface NodeOutput {
  success: boolean;
  data?: unknown;
  error?: string;
}

export interface RunContext {
  workflowId: string;
  runId: string;
  trigger: string;
  inputs: Record<string, NodeOutput>;
  logs: string[];
}

// ============ Notion Types ============
export interface NotionMeeting {
  id: string;
  title: string;
  summary: string;
  date: string | null;
  url: string;
}

export interface NotionTask {
  title: string;
  description: string;
  owner?: string;
  status: 'Todo' | 'Doing' | 'Done';
  priority?: 'low' | 'medium' | 'high';
  dueDate?: string;
  sourceUrl?: string;
  meetingId?: string;
  slackThread?: string;
}

// ============ Slack Types ============
export interface SlackMessage {
  user: string;
  text: string;
  ts: string;
  thread_ts?: string;
}

export interface SlackCommandPayload {
  channel_id: string;
  channel_name: string;
  user_id: string;
  user_name: string;
  command: string;
  text: string;
  response_url: string;
  thread_ts?: string;
}

// ============ API Response Types ============
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}
