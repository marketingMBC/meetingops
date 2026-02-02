'use client';

import { DragEvent } from 'react';
import type { NodeType } from '@/lib/types';

interface NodeDefinition {
  type: NodeType;
  label: string;
  description: string;
  icon: string;
  color: string;
}

const availableNodes: NodeDefinition[] = [
  {
    type: 'notion_trigger',
    label: 'Notion Trigger',
    description: 'Poll Notion for new meetings',
    icon: '📋',
    color: 'bg-purple-500',
  },
  {
    type: 'llm_extract_tasks',
    label: 'Extract Tasks',
    description: 'Use LLM to extract tasks from text',
    icon: '🤖',
    color: 'bg-blue-500',
  },
  {
    type: 'notion_create_tasks',
    label: 'Create Tasks',
    description: 'Create tasks in Notion DB',
    icon: '✅',
    color: 'bg-purple-400',
  },
  {
    type: 'slack_command_trigger',
    label: 'Slack Command',
    description: 'Triggered by /tasks command',
    icon: '💬',
    color: 'bg-green-500',
  },
  {
    type: 'slack_post_summary',
    label: 'Post Summary',
    description: 'Post task summary to Slack',
    icon: '📤',
    color: 'bg-green-400',
  },
  {
    type: 'daily_scheduler',
    label: 'Daily Scheduler',
    description: '7pm Chile daily trigger',
    icon: '⏰',
    color: 'bg-yellow-500',
  },
  {
    type: 'slack_ask_update',
    label: 'Ask Update',
    description: 'Post daily check-in question',
    icon: '👋',
    color: 'bg-green-300',
  },
  {
    type: 'task_updater',
    label: 'Task Updater',
    description: 'Update task status from responses',
    icon: '🔄',
    color: 'bg-orange-500',
  },
];

export default function NodePalette() {
  const onDragStart = (event: DragEvent, nodeType: NodeType, label: string) => {
    event.dataTransfer.setData('application/reactflow-type', nodeType);
    event.dataTransfer.setData('application/reactflow-label', label);
    event.dataTransfer.effectAllowed = 'move';
  };

  return (
    <div className="p-4 bg-gray-50 border-r border-gray-200 w-64 overflow-y-auto">
      <h3 className="text-sm font-semibold text-gray-700 mb-4">Available Nodes</h3>
      <p className="text-xs text-gray-500 mb-4">Drag nodes to the canvas</p>

      <div className="space-y-2">
        {availableNodes.map((node) => (
          <div
            key={node.type}
            draggable
            onDragStart={(e) => onDragStart(e, node.type, node.label)}
            className="p-3 bg-white rounded-lg border border-gray-200 cursor-grab hover:shadow-md transition-shadow"
          >
            <div className="flex items-center gap-2">
              <div className={`w-8 h-8 rounded-md ${node.color} flex items-center justify-center text-lg`}>
                {node.icon}
              </div>
              <div>
                <div className="text-sm font-medium text-gray-800">{node.label}</div>
                <div className="text-xs text-gray-500">{node.description}</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
