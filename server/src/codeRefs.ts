// "📂 Where is this in the code?": a short, hand-picked list of the places that drive the agent's decisions.
// The UI asks for a spot by key; we find the anchor text in the file so the line numbers are always current.
// Only these files can be read: never arbitrary paths (and never .env).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));

type Spot = { file: string; anchor: string; title: string; why: string; before?: number; lines?: number };

const SPOTS: Record<string, Spot> = {
  // The agent loop
  'loop.decide': {
    file: 'server/src/loop.ts', anchor: 'const response = await anthropic.messages.create(', lines: 8,
    title: 'The model decides here',
    why: 'One API call. The model gets the instructions, the conversation and the tool list, and replies with an answer or with tool calls.',
  },
  'loop.stop': {
    file: 'server/src/loop.ts', anchor: "if (response.stop_reason !== 'tool_use')", before: 1, lines: 5,
    title: 'The only normal way out of the loop',
    why: 'If the model asked for no tool, the agent is done. Otherwise the loop goes around again.',
  },
  'loop.runTools': {
    file: 'server/src/loop.ts', anchor: '// ACT: run every requested tool', lines: 6,
    title: 'Our code runs the tools it asked for',
    why: 'The model only wrote a request. Here our code runs every requested tool and sends the results back.',
  },
  'loop.hook': {
    file: 'server/src/loop.ts', anchor: '// HOOKS: our code gets a veto', lines: 11,
    title: 'The hook check before every tool',
    why: 'Before ANY tool runs, our code asks the hooks. “block” → the tool never runs. “ask” → wait for a human.',
  },
  // Hooks
  'hook.budget': {
    file: 'server/src/hooks.ts', anchor: 'export const budgetHook =', lines: 8,
    title: 'The hard stop: the budget rule',
    why: 'A plain if-statement. Over budget → block. Otherwise → ask a human. The model cannot argue with it.',
  },
  'hook.register': {
    file: 'server/src/runs.ts', anchor: '// Code enforcement: the hook guards', lines: 2,
    title: 'Where the hook is switched on (Act 6)',
    why: 'The run registers the budget hook for book_trip. In the “prompt only” variant this line is skipped on purpose.',
  },
  // Tools (defined in our code)
  'tool.get_weather': {
    file: 'server/src/tools/getWeather.ts', anchor: "name: 'get_weather'", before: 1, lines: 9,
    title: 'Where get_weather is defined',
    why: 'Name, description and inputs: the only things the model ever sees about this tool.',
  },
  'tool.delegate_task': {
    file: 'server/src/tools/delegateTask.ts', anchor: "name: 'delegate_task'", before: 1, lines: 9,
    title: 'Where delegate_task is defined',
    why: 'To the coordinator, “ask a specialist” is just another tool. Calling it starts a whole subagent.',
  },
  'tool.load_skill': {
    file: 'server/src/tools/loadSkill.ts', anchor: "name: 'load_skill'", before: 1, lines: 8,
    title: 'Where load_skill is defined',
    why: 'The tool the agent uses to pull a skill’s full text into its context.',
  },
  'tool.submit_trip_plan': {
    file: 'server/src/tools/submitItinerary.ts', anchor: "name: 'submit_trip_plan'", before: 1, lines: 8,
    title: 'Where submit_trip_plan is defined',
    why: 'A strict JSON schema: the final plan must have this exact shape so the app can show it.',
  },
  'tool.book_trip': {
    file: 'server/src/tools/bookTrip.ts', anchor: "name: 'book_trip'", before: 1, lines: 8,
    title: 'Where book_trip is defined',
    why: 'A mock booking. The tool itself has no budget check: the hook does that.',
  },
  // Tools that live in the MCP server (a separate program)
  'mcp.search_flights': {
    file: 'mcp-travel-data/src/index.ts', anchor: "'search_flights',", before: 1, lines: 9,
    title: 'search_flights lives in the MCP server',
    why: 'A separate program registers this tool. Our agent never sees this code, only the name and description it sends over MCP.',
  },
  'mcp.search_hotels': {
    file: 'mcp-travel-data/src/index.ts', anchor: "'search_hotels',", before: 1, lines: 9,
    title: 'search_hotels lives in the MCP server',
    why: 'A separate program registers this tool. Our agent never sees this code, only the name and description it sends over MCP.',
  },
  'mcp.search_activities': {
    file: 'mcp-travel-data/src/index.ts', anchor: "'search_activities',", before: 1, lines: 9,
    title: 'search_activities lives in the MCP server',
    why: 'A separate program registers this tool. Our agent never sees this code, only the name and description it sends over MCP.',
  },
  'mcp.client': {
    file: 'server/src/mcp/client.ts', anchor: 'const { tools } = await client.listTools();', lines: 4,
    title: 'Our agent asks the MCP server “what can you do?”',
    why: 'At start-up our code connects to the MCP server and gets its tool list, then hands those tools to the model.',
  },
  // Instructions and skills
  'agent.planner': {
    file: 'server/src/agents/tripPlanner.ts', anchor: 'const instructions = [', lines: 10,
    title: 'The agent’s instructions (system prompt)',
    why: 'What the agent is told to do and how to behave. The model reads this on every turn.',
  },
  'agent.coordinator': {
    file: 'server/src/agents/coordinator.ts', anchor: 'const instructions = [', lines: 10,
    title: 'The coordinator’s instructions (system prompt)',
    why: 'It is told to plan and delegate, never to search by itself. That is why it calls delegate_task.',
  },
  'agent.subagents': {
    file: 'server/src/agents/subagents.ts', anchor: 'export const SUBAGENTS', lines: 9,
    title: 'The specialists: their roles, tools and prompts',
    why: 'Each subagent gets only the tools it needs, and its own short instructions.',
  },
  'skill.playbook': {
    file: 'server/src/skills/budget-travel-playbook/SKILL.md', anchor: '---', lines: 8,
    title: 'The skill file (SKILL.md)',
    why: 'Only the name and description sit in the prompt. The rest of this file is loaded when the agent asks for it.',
  },
  'run.stop': {
    file: 'server/src/runs.ts', anchor: 'stop() {', before: 1, lines: 10,
    title: 'The Stop button',
    why: 'Cancels the model call in flight and wakes anything waiting. The loop then refuses to start another turn.',
  },
};

export type CodeSpot = { key: string; title: string; why: string; file: string; line: number; snippet: string; absolutePath: string };

export function readSpot(key: string): CodeSpot | undefined {
  const spot = SPOTS[key];
  if (!spot) return undefined;
  const absolutePath = path.join(ROOT, spot.file);
  let lines: string[];
  try {
    lines = fs.readFileSync(absolutePath, 'utf8').replace(/\r\n/g, '\n').split('\n');
  } catch {
    return undefined;
  }
  const found = lines.findIndex((l) => l.includes(spot.anchor));
  const start = Math.max(0, (found < 0 ? 0 : found) - (spot.before ?? 0));
  const snippet = lines.slice(start, start + (spot.lines ?? 6)).join('\n');
  return { key, title: spot.title, why: spot.why, file: spot.file, line: start + 1, snippet, absolutePath };
}
