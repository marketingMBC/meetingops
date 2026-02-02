'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface DashboardStats {
  workflows: number;
  runs: number;
  tasks: number;
  channels: number;
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats>({ workflows: 0, runs: 0, tasks: 0, channels: 0 });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Fetch dashboard data
    Promise.all([
      fetch('/api/workflows').then((r) => r.json()),
      fetch('/api/notion/tasks').then((r) => r.json()),
      fetch('/api/slack/channels').then((r) => r.json()),
    ])
      .then(([workflowsData, tasksData, channelsData]) => {
        setStats({
          workflows: workflowsData.data?.length || 0,
          runs: workflowsData.data?.reduce((acc: number, w: any) => acc + (w._count?.runs || 0), 0) || 0,
          tasks: tasksData.data?.count || 0,
          channels: channelsData.data?.length || 0,
        });
      })
      .catch(console.error)
      .finally(() => setIsLoading(false));
  }, []);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center text-white text-xl font-bold">
                M
              </div>
              <h1 className="text-xl font-bold text-gray-900">MeetingOps</h1>
            </div>
            <nav className="flex items-center gap-6">
              <Link href="/workflows" className="text-gray-600 hover:text-gray-900">
                Workflows
              </Link>
              <Link href="/editor" className="text-gray-600 hover:text-gray-900">
                Editor
              </Link>
              <Link href="/settings" className="text-gray-600 hover:text-gray-900">
                Settings
              </Link>
            </nav>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">Dashboard</h2>

        {/* Stats grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="text-3xl font-bold text-gray-900">{stats.workflows}</div>
            <div className="text-gray-600">Workflows</div>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="text-3xl font-bold text-gray-900">{stats.runs}</div>
            <div className="text-gray-600">Total Runs</div>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="text-3xl font-bold text-gray-900">{stats.tasks}</div>
            <div className="text-gray-600">Active Tasks</div>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="text-3xl font-bold text-gray-900">{stats.channels}</div>
            <div className="text-gray-600">Slack Channels</div>
          </div>
        </div>

        {/* Quick actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
            <div className="space-y-3">
              <Link
                href="/editor"
                className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50"
              >
                <span className="text-2xl">+</span>
                <div>
                  <div className="font-medium text-gray-900">Create Workflow</div>
                  <div className="text-sm text-gray-500">Build a new automation flow</div>
                </div>
              </Link>
              <button
                onClick={async () => {
                  const res = await fetch('/api/scheduler/daily-checkin');
                  const data = await res.json();
                  alert(data.success ? 'Check-in sent!' : `Error: ${data.error}`);
                }}
                className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 w-full text-left"
              >
                <span className="text-2xl">M</span>
                <div>
                  <div className="font-medium text-gray-900">Send Daily Check-in</div>
                  <div className="text-sm text-gray-500">Post to configured channels now</div>
                </div>
              </button>
              <Link
                href="/settings"
                className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50"
              >
                <span className="text-2xl">S</span>
                <div>
                  <div className="font-medium text-gray-900">Configure Channels</div>
                  <div className="text-sm text-gray-500">Set up Slack channels for check-ins</div>
                </div>
              </Link>
            </div>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">How It Works</h3>
            <div className="space-y-4 text-sm text-gray-600">
              <div className="flex items-start gap-3">
                <span className="text-lg">1.</span>
                <div>
                  <strong>Notion Meetings</strong> - The system polls your Notion Meetings DB and extracts tasks using AI.
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-lg">2.</span>
                <div>
                  <strong>/tasks Command</strong> - Use <code className="bg-gray-100 px-1 rounded">/tasks</code> in Slack to extract tasks from any conversation.
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-lg">3.</span>
                <div>
                  <strong>Daily Check-in</strong> - At 7pm Chile time, the bot asks for updates and marks tasks as done.
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* System status */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">System Status</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 rounded-full bg-green-500"></div>
              <span className="text-gray-700">Notion API</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 rounded-full bg-green-500"></div>
              <span className="text-gray-700">Slack Bot</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
              <span className="text-gray-700">LLM (Mock mode)</span>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
