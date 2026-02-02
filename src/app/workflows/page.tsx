'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface Workflow {
  id: string;
  name: string;
  description?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  _count: {
    runs: number;
  };
}

export default function WorkflowsPage() {
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetch('/api/workflows')
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setWorkflows(data.data);
        }
      })
      .finally(() => setIsLoading(false));
  }, []);

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete workflow "${name}"?`)) return;

    const res = await fetch(`/api/workflows/${id}`, { method: 'DELETE' });
    const data = await res.json();

    if (data.success) {
      setWorkflows((wfs) => wfs.filter((w) => w.id !== id));
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-600">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Workflows</h1>
            <p className="text-gray-600">Manage your automation workflows</p>
          </div>
          <Link
            href="/editor"
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            + New Workflow
          </Link>
        </div>

        {workflows.length === 0 ? (
          <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
            <p className="text-gray-500 mb-4">No workflows yet</p>
            <Link
              href="/editor"
              className="text-blue-600 hover:text-blue-700"
            >
              Create your first workflow
            </Link>
          </div>
        ) : (
          <div className="grid gap-4">
            {workflows.map((workflow) => (
              <div
                key={workflow.id}
                className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg font-semibold text-gray-900">
                        {workflow.name}
                      </h3>
                      <span
                        className={`px-2 py-0.5 text-xs rounded-full ${
                          workflow.isActive
                            ? 'bg-green-100 text-green-700'
                            : 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {workflow.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                    {workflow.description && (
                      <p className="text-gray-600 mt-1">{workflow.description}</p>
                    )}
                    <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
                      <span>{workflow._count.runs} runs</span>
                      <span>Updated {new Date(workflow.updatedAt).toLocaleDateString()}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Link
                      href={`/editor?id=${workflow.id}`}
                      className="px-3 py-1.5 text-sm text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50"
                    >
                      Edit
                    </Link>
                    <button
                      onClick={() => handleDelete(workflow.id, workflow.name)}
                      className="px-3 py-1.5 text-sm text-red-600 border border-red-200 rounded-md hover:bg-red-50"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Quick links */}
        <div className="mt-8 p-4 bg-white rounded-lg border border-gray-200">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Quick Links</h3>
          <div className="flex gap-4">
            <Link href="/" className="text-blue-600 hover:text-blue-700 text-sm">
              Dashboard
            </Link>
            <Link href="/settings" className="text-blue-600 hover:text-blue-700 text-sm">
              Settings
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
