// Replay-only mode: everything a visitor needs to watch the agent, with no server and no API key.
// A recording is just the list of events a real run emitted, so replaying it never calls the model.
// Vite bundles these files into the web app (each one is loaded only when it is played).
import { SPOTS, cutSpot, type CodeSpot } from '@glass-box/shared/codeSpots';

/** The curated recordings, in the order of the talk. File names match server/recordings/demo-*.jsonl. */
export const DEMOS = [
  { file: 'demo-act1-plain-llm.jsonl', act: 1, label: '1 · Just the model (no tools)' },
  { file: 'demo-act2-local-tool.jsonl', act: 2, label: '2 · Agent loop + a tool' },
  { file: 'demo-act3-mcp.jsonl', act: 3, label: '3 · + MCP server' },
  { file: 'demo-act3-break-it.jsonl', act: 3, label: '3 · ⚡ Break it: vague tool names' },
  { file: 'demo-act4-skill.jsonl', act: 4, label: '4 · + Skill' },
  { file: 'demo-act5-subagents.jsonl', act: 5, label: '5 · Agent asks other agents' },
  { file: 'demo-act6-hooks-approval.jsonl', act: 6, label: '6 · + Hook & human approval' },
  { file: 'demo-act6-budget-hook.jsonl', act: 6, label: '6 · Budget rule in a hook (code)' },
  { file: 'demo-act6-budget-prompt-only.jsonl', act: 6, label: '6 · Budget rule in the prompt only' },
];

const recordingFiles = import.meta.glob<string>('../../server/recordings/demo-*.jsonl', { query: '?raw', import: 'default' });

/** The text of a bundled recording, or undefined if it is not one of the demos (then ask the server). */
export async function loadBundledRecording(file: string): Promise<string | undefined> {
  return recordingFiles[`../../server/recordings/${file}`]?.();
}

// The source files behind "📂 Where is this in the code?", so those snippets work without the server too.
const sourceFiles = import.meta.glob<string>(['../../server/src/**/*.{ts,md}', '../../mcp-travel-data/src/index.ts'], {
  query: '?raw',
  import: 'default',
});

export async function loadBundledSpot(key: string): Promise<CodeSpot | undefined> {
  const spot = SPOTS[key];
  const loadFile = spot && sourceFiles[`../../${spot.file}`];
  return loadFile ? cutSpot(key, await loadFile()) : undefined;
}
