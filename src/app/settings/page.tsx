'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface SlackChannel {
  id: string;
  channelId: string;
  channelName: string;
  isActive: boolean;
  timezone: string;
  checkInTime: string;
  _count: { checkIns: number };
}

export default function SettingsPage() {
  const [channels, setChannels] = useState<SlackChannel[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [newChannelId, setNewChannelId] = useState('');
  const [newChannelName, setNewChannelName] = useState('');

  useEffect(() => {
    fetchChannels();
  }, []);

  const fetchChannels = () => {
    fetch('/api/slack/channels')
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setChannels(data.data);
        }
      })
      .finally(() => setIsLoading(false));
  };

  const handleAddChannel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newChannelId || !newChannelName) return;

    const res = await fetch('/api/slack/channels', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        channelId: newChannelId,
        channelName: newChannelName,
      }),
    });

    const data = await res.json();
    if (data.success) {
      setNewChannelId('');
      setNewChannelName('');
      fetchChannels();
    }
  };

  const handleDeleteChannel = async (channelId: string) => {
    if (!confirm('Remove this channel from check-ins?')) return;

    const res = await fetch('/api/slack/channels', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ channelId }),
    });

    const data = await res.json();
    if (data.success) {
      fetchChannels();
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-6 py-4">
          <div className="flex items-center gap-4">
            <Link href="/" className="text-gray-500 hover:text-gray-700">
              &larr; Back
            </Link>
            <h1 className="text-xl font-bold text-gray-900">Settings</h1>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8">
        {/* Slack Channels */}
        <section className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Slack Channels for Daily Check-in</h2>
          <p className="text-sm text-gray-600 mb-6">
            Configure which Slack channels receive the daily check-in message at 7pm Chile time.
          </p>

          {/* Add channel form */}
          <form onSubmit={handleAddChannel} className="flex gap-3 mb-6">
            <input
              type="text"
              placeholder="Channel ID (e.g., C0123456789)"
              value={newChannelId}
              onChange={(e) => setNewChannelId(e.target.value)}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm"
            />
            <input
              type="text"
              placeholder="Channel name"
              value={newChannelName}
              onChange={(e) => setNewChannelName(e.target.value)}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm"
            />
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700"
            >
              Add Channel
            </button>
          </form>

          {/* Channels list */}
          {isLoading ? (
            <div className="text-gray-500">Loading...</div>
          ) : channels.length === 0 ? (
            <div className="text-gray-500">No channels configured yet.</div>
          ) : (
            <div className="space-y-3">
              {channels.map((channel) => (
                <div
                  key={channel.id}
                  className="flex items-center justify-between p-4 bg-gray-50 rounded-lg"
                >
                  <div>
                    <div className="font-medium text-gray-900">#{channel.channelName}</div>
                    <div className="text-sm text-gray-500">
                      ID: {channel.channelId} | {channel._count.checkIns} check-ins sent
                    </div>
                  </div>
                  <button
                    onClick={() => handleDeleteChannel(channel.channelId)}
                    className="text-red-600 hover:text-red-700 text-sm"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Environment Variables */}
        <section className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Environment Variables</h2>
          <p className="text-sm text-gray-600 mb-4">
            These are configured in your <code className="bg-gray-100 px-1 rounded">.env</code> file.
          </p>

          <div className="space-y-3">
            <div className="flex items-center justify-between py-2 border-b border-gray-100">
              <span className="text-sm font-medium text-gray-700">NOTION_TOKEN</span>
              <span className="text-sm text-gray-500">
                {process.env.NEXT_PUBLIC_NOTION_CONFIGURED === 'true' ? 'Configured' : 'Not set'}
              </span>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-gray-100">
              <span className="text-sm font-medium text-gray-700">SLACK_BOT_TOKEN</span>
              <span className="text-sm text-gray-500">
                {process.env.NEXT_PUBLIC_SLACK_CONFIGURED === 'true' ? 'Configured' : 'Not set'}
              </span>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-gray-100">
              <span className="text-sm font-medium text-gray-700">LLM_PROVIDER</span>
              <span className="text-sm text-gray-500">mock (default)</span>
            </div>
          </div>
        </section>

        {/* Notion Database Info */}
        <section className="bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Notion Database Setup</h2>

          <div className="space-y-4 text-sm text-gray-600">
            <div>
              <h3 className="font-medium text-gray-800 mb-2">Meetings DB Properties</h3>
              <ul className="list-disc list-inside space-y-1">
                <li><strong>Name</strong> (title) - Meeting title</li>
                <li><strong>Summary</strong> (rich_text) - Meeting summary</li>
                <li><strong>Date</strong> (date) - Meeting date</li>
              </ul>
            </div>

            <div>
              <h3 className="font-medium text-gray-800 mb-2">Tasks DB Properties</h3>
              <ul className="list-disc list-inside space-y-1">
                <li><strong>Name</strong> (title) - Task title</li>
                <li><strong>Description</strong> (rich_text) - Task details</li>
                <li><strong>OwnerName</strong> (rich_text) - Assigned person</li>
                <li><strong>Status</strong> (select) - Todo / Doing / Done</li>
                <li><strong>SourceUrl</strong> (url) - Link to source</li>
                <li><strong>MeetingId</strong> (rich_text) - Related meeting ID</li>
                <li><strong>SlackThread</strong> (rich_text) - Slack thread link</li>
              </ul>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
