import { v4 as uuid } from 'uuid';
import prisma from '../db';
import type {
  WorkflowDefinition,
  FlowNode,
  FlowEdge,
  NodeOutput,
  RunContext,
} from '../types';

// Import node handlers
import * as notionNodes from './nodes/notion';
import * as slackNodes from './nodes/slack';
import * as llmNodes from './nodes/llm';
import * as schedulerNodes from './nodes/scheduler';

// Node handler registry
const nodeHandlers: Record<string, (node: FlowNode, ctx: RunContext) => Promise<NodeOutput>> = {
  notion_trigger: notionNodes.handleNotionTrigger,
  llm_extract_tasks: llmNodes.handleLLMExtractTasks,
  notion_create_tasks: notionNodes.handleNotionCreateTasks,
  slack_command_trigger: slackNodes.handleSlackCommandTrigger,
  slack_post_summary: slackNodes.handleSlackPostSummary,
  daily_scheduler: schedulerNodes.handleDailyScheduler,
  slack_ask_update: slackNodes.handleSlackAskUpdate,
  task_updater: notionNodes.handleTaskUpdater,
};

/**
 * Execute a workflow
 */
export async function runWorkflow(
  workflowId: string,
  trigger: string,
  initialInput?: Record<string, unknown>
): Promise<{ runId: string; success: boolean; outputs: Record<string, NodeOutput> }> {
  // Fetch workflow definition
  const workflow = await prisma.workflow.findUnique({
    where: { id: workflowId },
  });

  if (!workflow) {
    throw new Error(`Workflow ${workflowId} not found`);
  }

  const flowDef = JSON.parse(workflow.flowJson) as WorkflowDefinition;
  const runId = uuid();

  // Create run record
  await prisma.workflowRun.create({
    data: {
      id: runId,
      workflowId,
      status: 'running',
      trigger,
      inputData: initialInput ? JSON.stringify(initialInput) : null,
    },
  });

  const ctx: RunContext = {
    workflowId,
    runId,
    trigger,
    inputs: {},
    logs: [],
  };

  // Add initial input to context
  if (initialInput) {
    ctx.inputs['_trigger'] = { success: true, data: initialInput };
  }

  try {
    // Get execution order (topological sort)
    const executionOrder = topologicalSort(flowDef.nodes, flowDef.edges);
    ctx.logs.push(`Execution order: ${executionOrder.map((n) => n.data.type).join(' -> ')}`);

    // Execute nodes in order
    const outputs: Record<string, NodeOutput> = {};

    for (const node of executionOrder) {
      ctx.logs.push(`Executing node: ${node.data.type} (${node.id})`);

      // Get inputs from connected source nodes
      const sourceEdges = flowDef.edges.filter((e) => e.target === node.id);
      for (const edge of sourceEdges) {
        if (outputs[edge.source]) {
          ctx.inputs[edge.source] = outputs[edge.source];
        }
      }

      // Execute the node
      const handler = nodeHandlers[node.data.type];
      if (!handler) {
        ctx.logs.push(`Warning: No handler for node type ${node.data.type}`);
        outputs[node.id] = { success: false, error: `Unknown node type: ${node.data.type}` };
        continue;
      }

      try {
        const output = await handler(node, ctx);
        outputs[node.id] = output;
        ctx.logs.push(`Node ${node.id} completed: ${output.success ? 'success' : 'failed'}`);
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        ctx.logs.push(`Node ${node.id} error: ${errorMsg}`);
        outputs[node.id] = { success: false, error: errorMsg };
      }
    }

    // Update run record
    const allSuccess = Object.values(outputs).every((o) => o.success);
    await prisma.workflowRun.update({
      where: { id: runId },
      data: {
        status: allSuccess ? 'completed' : 'failed',
        outputData: JSON.stringify(outputs),
        logs: JSON.stringify(ctx.logs),
        completedAt: new Date(),
      },
    });

    return { runId, success: allSuccess, outputs };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    ctx.logs.push(`Workflow error: ${errorMsg}`);

    await prisma.workflowRun.update({
      where: { id: runId },
      data: {
        status: 'failed',
        error: errorMsg,
        logs: JSON.stringify(ctx.logs),
        completedAt: new Date(),
      },
    });

    return { runId, success: false, outputs: {} };
  }
}

/**
 * Topological sort of nodes based on edges
 */
function topologicalSort(nodes: FlowNode[], edges: FlowEdge[]): FlowNode[] {
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  const inDegree = new Map<string, number>();
  const adjacency = new Map<string, string[]>();

  // Initialize
  for (const node of nodes) {
    inDegree.set(node.id, 0);
    adjacency.set(node.id, []);
  }

  // Build graph
  for (const edge of edges) {
    const targets = adjacency.get(edge.source) || [];
    targets.push(edge.target);
    adjacency.set(edge.source, targets);
    inDegree.set(edge.target, (inDegree.get(edge.target) || 0) + 1);
  }

  // Kahn's algorithm
  const queue: string[] = [];
  for (const [nodeId, degree] of inDegree) {
    if (degree === 0) queue.push(nodeId);
  }

  const result: FlowNode[] = [];
  while (queue.length > 0) {
    const nodeId = queue.shift()!;
    const node = nodeMap.get(nodeId);
    if (node) result.push(node);

    for (const neighbor of adjacency.get(nodeId) || []) {
      const newDegree = (inDegree.get(neighbor) || 1) - 1;
      inDegree.set(neighbor, newDegree);
      if (newDegree === 0) queue.push(neighbor);
    }
  }

  // Check for cycles
  if (result.length !== nodes.length) {
    throw new Error('Workflow contains cycles');
  }

  return result;
}

/**
 * Run workflow by trigger type (convenience functions)
 */
export async function runNotionPollWorkflow(workflowId: string) {
  return runWorkflow(workflowId, 'notion_poll');
}

export async function runSlackCommandWorkflow(
  workflowId: string,
  slackPayload: Record<string, unknown>
) {
  return runWorkflow(workflowId, 'slack_command', slackPayload);
}

export async function runScheduledWorkflow(workflowId: string) {
  return runWorkflow(workflowId, 'scheduler');
}
