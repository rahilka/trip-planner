// "🔎 Why?": rebuilds one decision of the agent from the event stream, so learners can see
//   1. what the model had in front of it, 2. what it picked (and where each input came from),
//   3. where the decision was made (in the model, not in our code), and 4. what we can learn from it.
import { reactive } from 'vue';
import type { StreamedEvent, ToolDefinition } from '@glass-box/shared';

export const decisionView = reactive({ open: false, agentId: '', turn: 0, focusToolUseId: '' });

export function openDecision(agentId: string, turn: number, focusToolUseId = '') {
  Object.assign(decisionView, { open: true, agentId, turn, focusToolUseId });
}

/** Where a value the model typed into a tool came from. */
export type Origin = 'prompt' | 'result' | 'model';

export interface PickedCall {
  toolUseId: string;
  name: string;
  source: 'local' | 'mcp';
  description: string;
  inputs: { key: string; value: string; origin: Origin }[];
}

export interface Decision {
  role: string;
  turn: number;
  isSubagent: boolean;
  /** What the agent was asked: the user's prompt, or the task a coordinator wrote for it. */
  askedFor: string;
  /** Turn 2+: the results that arrived since the last decision. */
  newResults: { name: string; isError: boolean; summary: string }[];
  menu: (ToolDefinition & { picked: number })[];
  stopReason: string;
  /** The model's own words: what it wrote, and its reasoning summary. */
  said?: string;
  thinking?: string;
  calls: PickedCall[];
  lessons: { icon: string; text: string }[];
}

const realName = (tool: string) => tool.split(' = ').pop()!;
const oneLine = (value: unknown, max = 110) => {
  const text = (typeof value === 'string' ? value : JSON.stringify(value)).replace(/\s+/g, ' ').trim();
  return text.length > max ? text.slice(0, max - 1) + '…' : text;
};

export function buildDecision(events: StreamedEvent[], agentId: string, turn: number): Decision | undefined {
  const runStarted = events.find((e) => e.type === 'run_started');
  const started = events.find((e) => e.type === 'agent_started' && e.agentId === agentId);
  const responseIndex = events.findIndex((e) => e.type === 'model_response' && e.agentId === agentId && e.turn === turn);
  if (!runStarted || runStarted.type !== 'run_started' || !started || started.type !== 'agent_started' || responseIndex < 0) return undefined;
  const response = events[responseIndex];
  if (response.type !== 'model_response') return undefined;

  // This turn's tool calls: everything the agent asked for until its next model call.
  const nextCall = events.findIndex((e, i) => i > responseIndex && e.type === 'model_call' && e.agentId === agentId);
  const uses = events.slice(responseIndex + 1, nextCall < 0 ? undefined : nextCall).filter((e) => e.type === 'tool_use' && e.agentId === agentId);

  // What arrived since the previous decision: the results of the last turn.
  const callIndex = events.findIndex((e) => e.type === 'model_call' && e.agentId === agentId && e.turn === turn);
  const previousResponse = events.findIndex((e) => e.type === 'model_response' && e.agentId === agentId && e.turn === turn - 1);
  const results = turn > 1 ? events.slice(previousResponse + 1, callIndex).filter((e) => e.type === 'tool_result' && e.agentId === agentId) : [];
  const newResults = results.map((e) => (e.type === 'tool_result' ? { name: realName(e.tool), isError: e.isError, summary: oneLine(e.output) } : { name: '', isError: false, summary: '' }));

  const askedFor = started.task ?? runStarted.prompt;
  const seenText = (results.map((e) => (e.type === 'tool_result' ? JSON.stringify(e.output) : '')).join(' ')).toLowerCase();
  const originOf = (value: string): Origin => {
    const v = value.toLowerCase();
    if (v.length > 1 && askedFor.toLowerCase().includes(v)) return 'prompt';
    if (v.length > 1 && seenText.includes(v)) return 'result';
    return 'model';
  };

  const tools = started.tools ?? [];
  const calls: PickedCall[] = uses.map((e) => {
    if (e.type !== 'tool_use') throw new Error('unreachable');
    const def = tools.find((t) => t.name === e.tool.split(' = ')[0]);
    const input = (e.input ?? {}) as Record<string, unknown>;
    return {
      toolUseId: e.toolUseId,
      name: e.tool,
      source: e.source,
      description: def?.description ?? '',
      inputs: Object.entries(input).map(([key, raw]) => {
        const value = typeof raw === 'object' ? JSON.stringify(raw) : String(raw);
        return { key, value: value.length > 90 ? value.slice(0, 89) + '…' : value, origin: originOf(value) };
      }),
    };
  });
  const menu = tools.map((t) => ({ ...t, picked: calls.filter((c) => c.name.split(' = ')[0] === t.name).length }));

  return {
    role: started.role,
    turn,
    isSubagent: Boolean(started.parentId),
    askedFor,
    newResults,
    menu,
    stopReason: response.stopReason,
    said: response.text?.trim() || undefined,
    thinking: response.thinking?.trim() || undefined,
    calls,
    lessons: lessonsFor({ turn, calls, menu, newResults, stopReason: response.stopReason, hasTools: tools.length > 0 }),
  };
}

/** The takeaways, picked to fit what actually happened in this turn. */
function lessonsFor(d: { turn: number; calls: PickedCall[]; menu: { name: string; picked: number }[]; newResults: { isError: boolean; name: string }[]; stopReason: string; hasTools: boolean }) {
  const lessons: { icon: string; text: string }[] = [];
  const names = [...new Set(d.calls.map((c) => realName(c.name)))];

  if (d.stopReason === 'end_turn') {
    lessons.push({ icon: '🏁', text: 'Nobody in our code said “stop”. The model decided nothing is missing anymore and wrote the answer (stop_reason: end_turn).' });
    if (!d.hasTools) lessons.push({ icon: '🧠', text: 'It had no tools, so answering from memory was its only option. Everything in the answer is a guess.' });
    return lessons;
  }

  if (d.hasTools) lessons.push({ icon: '📝', text: 'The tool descriptions were its only guide. It never saw the code behind them, so a clear description is what makes it pick the right tool.' });
  if (d.calls.length > 1) lessons.push({ icon: '🚀', text: `It asked for ${d.calls.length} tool calls in ONE turn. They don’t depend on each other, so our loop runs them at the same time (Promise.all).` });
  if (d.calls.some((c) => c.source === 'mcp')) {
    const mcp = [...new Set(d.calls.filter((c) => c.source === 'mcp').map((c) => realName(c.name)))].join(', ');
    lessons.push({ icon: '🔌', text: `${mcp} come${mcp.includes(',') ? '' : 's'} from a separate program (the MCP server). The model didn’t know or care: to it, they look exactly like a local tool.` });
  }
  const made = d.calls.flatMap((c) => c.inputs).filter((i) => i.origin === 'model');
  if (made.length) {
    const example = made.find((i) => /\d{4}-\d{2}-\d{2}/.test(i.value)) ?? made[0];
    lessons.push({ icon: '🧩', text: `Some inputs are not in your words. The model worked them out itself (e.g. ${example.key} = “${example.value}”). That’s why tools must check their inputs.` });
  }
  if (d.newResults.some((r) => r.isError)) lessons.push({ icon: '💥', text: 'A tool failed last turn. The model read the error message and changed its plan. Errors are information for the model, not crashes.' });
  const unused = d.menu.filter((t) => !t.picked).map((t) => realName(t.name));
  if (unused.length && names.length) lessons.push({ icon: '⏸', text: `It did not use ${unused.join(', ')} this turn. It only picks what it needs right now; it can call more next turn.` });
  if (names.includes('delegate_task')) lessons.push({ icon: '🤝', text: 'It doesn’t search by itself: its instructions say to hand work to specialists. To the coordinator, a subagent is just another tool.' });
  if (names.includes('load_skill')) lessons.push({ icon: '📖', text: 'It only had the skill’s one-line description. It judged it useful for this task, so it loads the full text before planning.' });
  if (names.includes('book_trip')) lessons.push({ icon: '🛡', text: 'Booking spends money, so before it runs, a hook in OUR code checks it. The model’s decision is not the last word.' });
  return lessons;
}
