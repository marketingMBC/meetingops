'use client';

import { memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import type { NodeData, NodeType } from '@/lib/types';

const nodeColors: Record<NodeType, string> = {
  notion_trigger: 'bg-purple-500',
  llm_extract_tasks: 'bg-blue-500',
  notion_create_tasks: 'bg-purple-400',
  slack_command_trigger: 'bg-green-500',
  slack_post_summary: 'bg-green-400',
  daily_scheduler: 'bg-yellow-500',
  slack_ask_update: 'bg-green-300',
  task_updater: 'bg-orange-500',
};

const nodeIcons: Record<NodeType, string> = {
  notion_trigger: '📋',
  llm_extract_tasks: '🤖',
  notion_create_tasks: '✅',
  slack_command_trigger: '💬',
  slack_post_summary: '📤',
  daily_scheduler: '⏰',
  slack_ask_update: '👋',
  task_updater: '🔄',
};

function CustomNode({ data, selected }: NodeProps<NodeData>) {
  const colorClass = nodeColors[data.type] || 'bg-gray-500';
  const icon = nodeIcons[data.type] || '📦';

  return (
    <div
      className={`
        px-4 py-3 shadow-md rounded-lg border-2 min-w-[160px]
        ${selected ? 'border-blue-600' : 'border-gray-200'}
        bg-white
      `}
    >
      {/* Input handle (except for triggers) */}
      {!data.type.includes('trigger') && !data.type.includes('scheduler') && (
        <Handle
          type="target"
          position={Position.Left}
          className="w-3 h-3 !bg-gray-400"
        />
      )}

      {/* Node content */}
      <div className="flex items-center gap-2">
        <div className={`w-8 h-8 rounded-md ${colorClass} flex items-center justify-center text-lg`}>
          {icon}
        </div>
        <div>
          <div className="text-sm font-medium text-gray-800">{data.label}</div>
          <div className="text-xs text-gray-500">{data.type.replace(/_/g, ' ')}</div>
        </div>
      </div>

      {/* Output handle */}
      <Handle
        type="source"
        position={Position.Right}
        className="w-3 h-3 !bg-gray-400"
      />
    </div>
  );
}

export default memo(CustomNode);
