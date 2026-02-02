'use client';

import { useCallback, useRef, useState, DragEvent } from 'react';
import ReactFlow, {
  Node,
  Edge,
  Controls,
  Background,
  MiniMap,
  addEdge,
  Connection,
  useNodesState,
  useEdgesState,
  ReactFlowProvider,
  ReactFlowInstance,
} from 'reactflow';
import 'reactflow/dist/style.css';

import CustomNode from './CustomNode';
import NodePalette from './NodePalette';
import type { NodeType, NodeData, WorkflowDefinition } from '@/lib/types';

const nodeTypes = {
  custom: CustomNode,
};

interface FlowEditorProps {
  workflowId?: string;
  workflowName?: string;
  initialFlow?: WorkflowDefinition;
  onSave?: (flow: WorkflowDefinition) => Promise<void>;
}

export default function FlowEditor({
  workflowId,
  workflowName = 'New Workflow',
  initialFlow,
  onSave,
}: FlowEditorProps) {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const [reactFlowInstance, setReactFlowInstance] = useState<ReactFlowInstance | null>(null);
  const [nodes, setNodes, onNodesChange] = useNodesState(initialFlow?.nodes || []);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialFlow?.edges || []);
  const [isSaving, setIsSaving] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [lastRunResult, setLastRunResult] = useState<{ success: boolean; message: string } | null>(null);

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  );

  const onDragOver = useCallback((event: DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (event: DragEvent) => {
      event.preventDefault();

      const type = event.dataTransfer.getData('application/reactflow-type') as NodeType;
      const label = event.dataTransfer.getData('application/reactflow-label');

      if (!type || !reactFlowInstance || !reactFlowWrapper.current) return;

      const bounds = reactFlowWrapper.current.getBoundingClientRect();
      const position = reactFlowInstance.screenToFlowPosition({
        x: event.clientX - bounds.left,
        y: event.clientY - bounds.top,
      });

      const newNode: Node<NodeData> = {
        id: `${type}_${Date.now()}`,
        type: 'custom',
        position,
        data: { label, type },
      };

      setNodes((nds) => nds.concat(newNode));
    },
    [reactFlowInstance, setNodes]
  );

  const handleSave = async () => {
    if (!onSave) return;

    setIsSaving(true);
    try {
      // Convert to our types (React Flow nodes have optional type)
      const flowNodes = nodes.map((n) => ({
        id: n.id,
        type: n.type || 'custom',
        position: n.position,
        data: n.data,
      }));
      const flowEdges = edges.map((e) => ({
        id: e.id,
        source: e.source,
        target: e.target,
      }));
      await onSave({ nodes: flowNodes, edges: flowEdges });
      setLastRunResult({ success: true, message: 'Workflow saved!' });
    } catch (error) {
      setLastRunResult({
        success: false,
        message: error instanceof Error ? error.message : 'Save failed',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleRun = async () => {
    if (!workflowId) {
      setLastRunResult({ success: false, message: 'Save workflow first' });
      return;
    }

    setIsRunning(true);
    setLastRunResult(null);

    try {
      const response = await fetch(`/api/workflows/${workflowId}/run`, {
        method: 'POST',
      });

      const data = await response.json();

      if (data.success) {
        setLastRunResult({
          success: true,
          message: `Run completed! ID: ${data.data.runId}`,
        });
      } else {
        setLastRunResult({
          success: false,
          message: data.error || 'Run failed',
        });
      }
    } catch (error) {
      setLastRunResult({
        success: false,
        message: error instanceof Error ? error.message : 'Run failed',
      });
    } finally {
      setIsRunning(false);
    }
  };

  const handleDelete = useCallback(() => {
    setNodes((nds) => nds.filter((node) => !node.selected));
    setEdges((eds) => eds.filter((edge) => !edge.selected));
  }, [setNodes, setEdges]);

  return (
    <div className="flex h-full">
      <NodePalette />

      <div className="flex-1 flex flex-col">
        {/* Toolbar */}
        <div className="h-14 bg-white border-b border-gray-200 flex items-center justify-between px-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-800">{workflowName}</h2>
            {workflowId && (
              <span className="text-xs text-gray-500">ID: {workflowId}</span>
            )}
          </div>

          <div className="flex items-center gap-3">
            {lastRunResult && (
              <span
                className={`text-sm ${
                  lastRunResult.success ? 'text-green-600' : 'text-red-600'
                }`}
              >
                {lastRunResult.message}
              </span>
            )}

            <button
              onClick={handleDelete}
              className="px-3 py-1.5 text-sm text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50"
            >
              Delete Selected
            </button>

            <button
              onClick={handleSave}
              disabled={isSaving}
              className="px-4 py-1.5 text-sm text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              {isSaving ? 'Saving...' : 'Save'}
            </button>

            <button
              onClick={handleRun}
              disabled={isRunning || !workflowId}
              className="px-4 py-1.5 text-sm text-white bg-green-600 rounded-md hover:bg-green-700 disabled:opacity-50"
            >
              {isRunning ? 'Running...' : 'Run'}
            </button>
          </div>
        </div>

        {/* Flow canvas */}
        <div ref={reactFlowWrapper} className="flex-1">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onInit={setReactFlowInstance}
            onDrop={onDrop}
            onDragOver={onDragOver}
            nodeTypes={nodeTypes}
            fitView
            snapToGrid
            snapGrid={[15, 15]}
          >
            <Controls />
            <MiniMap />
            <Background gap={15} size={1} />
          </ReactFlow>
        </div>
      </div>
    </div>
  );
}

// Wrap with provider for external use
export function FlowEditorWithProvider(props: FlowEditorProps) {
  return (
    <ReactFlowProvider>
      <FlowEditor {...props} />
    </ReactFlowProvider>
  );
}
