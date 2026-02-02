'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import type { WorkflowDefinition } from '@/lib/types';

// Dynamic import to avoid SSR issues with ReactFlow
const FlowEditorWithProvider = dynamic(
  () => import('@/components/flow/FlowEditor').then((mod) => mod.FlowEditorWithProvider),
  { ssr: false, loading: () => <div className="flex-1 flex items-center justify-center">Loading editor...</div> }
);

interface Workflow {
  id: string;
  name: string;
  description?: string;
  flowJson: WorkflowDefinition;
}

function EditorContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const workflowId = searchParams.get('id');

  const [workflow, setWorkflow] = useState<Workflow | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (workflowId) {
      // Fetch existing workflow
      fetch(`/api/workflows/${workflowId}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.success) {
            setWorkflow(data.data);
          } else {
            setError(data.error);
          }
        })
        .catch((err) => setError(err.message))
        .finally(() => setIsLoading(false));
    } else {
      // New workflow
      setIsLoading(false);
    }
  }, [workflowId]);

  const handleSave = async (flow: WorkflowDefinition) => {
    if (workflowId) {
      // Update existing
      const res = await fetch(`/api/workflows/${workflowId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ flowJson: flow }),
      });

      const data = await res.json();
      if (!data.success) throw new Error(data.error);
    } else {
      // Create new
      const name = prompt('Enter workflow name:', 'My Workflow');
      if (!name) return;

      const res = await fetch('/api/workflows', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, flowJson: flow }),
      });

      const data = await res.json();
      if (!data.success) throw new Error(data.error);

      // Redirect to the new workflow
      router.push(`/editor?id=${data.data.id}`);
    }
  };

  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="text-gray-600">Loading...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="text-red-600">Error: {error}</div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col">
      <FlowEditorWithProvider
        workflowId={workflow?.id}
        workflowName={workflow?.name || 'New Workflow'}
        initialFlow={workflow?.flowJson}
        onSave={handleSave}
      />
    </div>
  );
}

export default function EditorPage() {
  return (
    <Suspense fallback={
      <div className="h-screen flex items-center justify-center">
        <div className="text-gray-600">Loading editor...</div>
      </div>
    }>
      <EditorContent />
    </Suspense>
  );
}
