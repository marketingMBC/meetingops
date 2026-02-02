import { ExtractedTasks, ExtractedTasksSchema, Task } from '../types';

type LLMProvider = 'openai' | 'anthropic' | 'mock';

const PROVIDER = (process.env.LLM_PROVIDER || 'mock') as LLMProvider;

/**
 * Extract tasks from meeting summary or conversation
 */
export async function extractTasks(
  content: string,
  source: 'notion' | 'slack',
  sourceUrl?: string
): Promise<ExtractedTasks> {
  const prompt = buildExtractionPrompt(content, source, sourceUrl);

  switch (PROVIDER) {
    case 'openai':
      return extractWithOpenAI(prompt);
    case 'anthropic':
      return extractWithAnthropic(prompt);
    case 'mock':
    default:
      return extractWithMock(content, source, sourceUrl);
  }
}

function buildExtractionPrompt(content: string, source: string, sourceUrl?: string): string {
  return `You are a task extraction assistant. Analyze the following ${source === 'notion' ? 'meeting summary' : 'Slack conversation'} and extract all actionable tasks.

For each task, determine:
- title: A clear, actionable task title
- description: More details about what needs to be done
- owner: The person responsible (look for @mentions, names, or "assigned to")
- dueDate: Any mentioned deadline in YYYY-MM-DD format
- priority: low, medium, or high based on urgency cues

Content to analyze:
---
${content}
---

Respond ONLY with valid JSON in this exact format:
{
  "tasks": [
    {
      "title": "string",
      "description": "string",
      "owner": "string | null",
      "dueDate": "YYYY-MM-DD | null",
      "priority": "low|medium|high|null",
      "source": "${source}",
      "sourceUrl": ${sourceUrl ? `"${sourceUrl}"` : 'null'}
    }
  ]
}

If no tasks are found, return {"tasks": []}.`;
}

/**
 * OpenAI implementation
 */
async function extractWithOpenAI(prompt: string): Promise<ExtractedTasks> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY not configured');

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.1,
      response_format: { type: 'json_object' },
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenAI API error: ${error}`);
  }

  const data = await response.json();
  const content = data.choices[0]?.message?.content;

  if (!content) throw new Error('No content in OpenAI response');

  const parsed = JSON.parse(content);
  return ExtractedTasksSchema.parse(parsed);
}

/**
 * Anthropic implementation
 */
async function extractWithAnthropic(prompt: string): Promise<ExtractedTasks> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not configured');

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-3-haiku-20240307',
      max_tokens: 2048,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Anthropic API error: ${error}`);
  }

  const data = await response.json();
  const content = data.content[0]?.text;

  if (!content) throw new Error('No content in Anthropic response');

  // Extract JSON from response (Claude might add explanation)
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('No JSON found in Anthropic response');

  const parsed = JSON.parse(jsonMatch[0]);
  return ExtractedTasksSchema.parse(parsed);
}

/**
 * Mock implementation for local testing
 */
async function extractWithMock(
  content: string,
  source: 'notion' | 'slack',
  sourceUrl?: string
): Promise<ExtractedTasks> {
  // Simple heuristic-based extraction for testing
  const tasks: Task[] = [];
  const lines = content.split('\n');

  // Look for action items, todos, or task-like patterns
  const taskPatterns = [
    /(?:TODO|TASK|ACTION|@\w+):\s*(.+)/gi,
    /[-*]\s*\[[ x]?\]\s*(.+)/gi,  // Markdown checkboxes
    /[-*]\s*(.+(?:should|needs to|will|must|has to).+)/gi,
    /(?:assigned to|owner:|@\w+)\s*[:-]?\s*(.+)/gi,
  ];

  const seenTitles = new Set<string>();

  for (const line of lines) {
    for (const pattern of taskPatterns) {
      const matches = line.matchAll(new RegExp(pattern));
      for (const match of matches) {
        const title = match[1]?.trim();
        if (title && title.length > 5 && !seenTitles.has(title.toLowerCase())) {
          seenTitles.add(title.toLowerCase());

          // Try to extract owner from @mentions
          const ownerMatch = line.match(/@(\w+)/);
          const owner = ownerMatch ? ownerMatch[1] : null;

          // Try to extract date
          const dateMatch = line.match(/(\d{4}-\d{2}-\d{2})/);
          const dueDate = dateMatch ? dateMatch[1] : null;

          tasks.push({
            title: title.slice(0, 100),
            description: line,
            owner,
            dueDate,
            priority: line.toLowerCase().includes('urgent') ? 'high' : null,
            source,
            sourceUrl: sourceUrl || null,
          });
        }
      }
    }
  }

  // If no tasks found with patterns, create a generic one for testing
  if (tasks.length === 0 && content.length > 20) {
    tasks.push({
      title: 'Review and follow up on discussed items',
      description: `Auto-generated task from ${source}. Please review the original content for details.`,
      owner: null,
      dueDate: null,
      priority: null,
      source,
      sourceUrl: sourceUrl || null,
    });
  }

  return { tasks };
}

/**
 * Parse check-in response to extract completed/pending items
 */
export async function parseCheckInResponse(
  responseText: string
): Promise<{ completed: string[]; pending: string[] }> {
  // Simple pattern matching for MVP
  const completed: string[] = [];
  const pending: string[] = [];

  const lines = responseText.split('\n');
  let currentSection: 'completed' | 'pending' | null = null;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Detect section headers
    if (/complet|done|finish|termin/i.test(trimmed)) {
      currentSection = 'completed';
      continue;
    }
    if (/pending|blocked|todo|remain|quedan/i.test(trimmed)) {
      currentSection = 'pending';
      continue;
    }

    // Extract bullet items
    const bulletMatch = trimmed.match(/^[-*•]\s*(.+)/);
    if (bulletMatch) {
      const item = bulletMatch[1].trim();
      if (currentSection === 'completed' || /^(?:done|completed|finished|terminé)/i.test(trimmed)) {
        completed.push(item);
      } else if (currentSection === 'pending') {
        pending.push(item);
      } else {
        // Try to infer from content
        if (/(?:done|completed|finished|terminé|hecho)/i.test(trimmed)) {
          completed.push(item);
        } else {
          pending.push(item);
        }
      }
    }
  }

  return { completed, pending };
}
