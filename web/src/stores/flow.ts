import { defineStore } from 'pinia';
import dagre from '@dagrejs/dagre';
import type { StreamedEvent } from '@glass-box/shared';
import { explain } from '../explain';

// The simple view: every step the agent takes becomes a box in one flowchart.
//   You → Agent → 🧠 Think → 🔧 tools → 🧠 Think → … → ✅ Answer
// A subagent hangs below the tool call that asked for it, and its report flows back up.

export type StepKind = 'prompt' | 'agent' | 'think' | 'tool' | 'answer' | 'report' | 'error';
export type StepStatus = 'running' | 'done' | 'error' | 'waiting';
export type StepData = {
  kind: StepKind;
  icon: string;
  title: string;
  subtitle?: string;
  footer?: string;
  tag?: string;
  status: StepStatus;
  /** Think boxes: which way the model went at the fork. */
  decision?: 'tools' | 'answer' | 'other';
  /** Who is speaking in the 💭 bubble. */
  speaker?: string;
  /** 💭 The model's own words about this decision. */
  quote?: string;
  /** ℹ A plain-language explanation of what is happening and why. */
  why?: string;
  /** Which decision this box belongs to, for the "🔎 Why?" breakdown. */
  origin?: { agentId: string; turn: number; toolUseId?: string };
  /** 📂 Hand-picked code spots behind this step (keys of server/src/codeRefs.ts). */
  code?: string[];
  /** Full details for the side panel when the box is clicked. */
  details: { label: string; value: unknown }[];
};

/** What travels along an arrow: a request to a tool, a result coming back, a task for another agent. */
export type EdgeKind = 'flow' | 'call' | 'result' | 'delegate';

/** Plain shapes Vue Flow accepts (its own Node/Edge types are too deep for Pinia's inference). */
export type FlowNode = { id: string; type: 'step'; position: { x: number; y: number }; data: StepData };
export type FlowEdge = { id: string; source: string; target: string; type: 'packet'; markerEnd: string; data: { kind: EdgeKind; active: boolean } };

/** The subtitle bar: one sentence about the latest step. */
export type Caption = { step: number; icon: string; text: string };

const DEFAULT_SIZE = { width: 300, height: 110 };
const ROLE_BY_NAME: Record<string, string> = {
  transport: 'Transport Scout',
  weather: 'Weather Analyst',
  stay: 'Stay Finder',
  activities: 'Activities Curator',
};
export const AGENT_ICON: Record<string, string> = { planner: '🧭', transport: '✈️', weather: '🌦️', stay: '🏨', activities: '🎟️' };

const short = (text: string, max = 46) => {
  const line = text.replace(/[#*_`>|]/g, '').replace(/\s+/g, ' ').trim();
  return line.length > max ? line.slice(0, max - 1) + '…' : line;
};

/**
 * The model's own words about its decision: the sentence it wrote before calling tools,
 * or (when it just answered) the start of its reasoning summary.
 */
function narration(stopReason: string, text?: string, thinking?: string): string | undefined {
  const said = stopReason === 'tool_use' && text?.trim() ? text : thinking;
  if (!said?.trim()) return undefined;
  const clean = said.replace(/[#*_`>|]/g, '').replace(/\s+/g, ' ').trim();
  const sentences = clean.match(/[^.!?]+[.!?]+/g) ?? [clean];
  const picked = sentences.slice(0, 2).join(' ').trim();
  return picked.length > 200 ? picked.slice(0, 199) + '…' : picked;
}

/** A friendly one-liner for a tool call, e.g. "Skopje → Paris · 2026-12-01". */
function describeCall(tool: string, input: any): { icon: string; title: string; subtitle: string } {
  const name = tool; // in break-it mode this reads "tool_2 = search_flights"
  const real = tool.split(' = ').pop()!;
  if (real === 'delegate_task') return { icon: '🤝', title: `ask ${ROLE_BY_NAME[input?.agent] ?? input?.agent}`, subtitle: short(String(input?.task ?? '')) };
  if (real === 'load_skill') return { icon: '📖', title: 'read skill', subtitle: String(input?.name ?? '') };
  if (real === 'submit_trip_plan' || real === 'submit_itinerary') return { icon: '📋', title: 'submit trip plan', subtitle: 'structured JSON result' };
  if (real === 'book_trip') return { icon: '💳', title: 'book trip', subtitle: `€${input?.total_eur}` };
  if (real === 'search_flights') return { icon: '✈️', title: name, subtitle: `${input?.from} → ${input?.to} · ${input?.date}` };
  if (real === 'search_hotels') return { icon: '🏨', title: name, subtitle: `${input?.city} · ${input?.checkIn} → ${input?.checkOut}` };
  if (real === 'search_activities') return { icon: '🎟️', title: name, subtitle: [input?.city, input?.category, input?.indoor === true ? 'indoor' : input?.indoor === false ? 'outdoor' : ''].filter(Boolean).join(' · ') };
  if (real === 'get_weather') return { icon: '🌦️', title: name, subtitle: `${input?.city} · ${input?.startDate} → ${input?.endDate}` };
  const values = Object.values(input ?? {}).filter((v) => typeof v !== 'object').join(', ');
  return { icon: '🔧', title: name, subtitle: short(values) };
}

/** 📂 Where a tool lives: its definition, plus how MCP tools reach the agent. */
function codeForTool(realName: string, source: 'local' | 'mcp'): string[] {
  if (source === 'mcp') return [`mcp.${realName}`, 'mcp.client', 'loop.runTools'];
  if (realName === 'load_skill') return ['tool.load_skill', 'skill.playbook'];
  return [`tool.${realName === 'submit_itinerary' ? 'submit_trip_plan' : realName}`, 'loop.runTools'];
}

export const useFlowStore = defineStore('flow', {
  state: () => ({
    nodes: [] as FlowNode[],
    edges: [] as FlowEdge[],
    selectedId: '' as string,
    caption: undefined as Caption | undefined,
    steps: 0,
    /** Bumps when a run ends well: the view throws confetti. */
    celebrate: 0,
    // Bookkeeping to know where each new box connects:
    lastThink: {} as Record<string, string>, // agentId -> its latest think box
    turnOf: {} as Record<string, number>, // agentId -> its current turn
    stopped: false, // after Stop, late events (cancelled calls) don't draw anything new
    turnOutputs: {} as Record<string, string[]>, // agentId -> tool boxes of its current turn
    toolBox: {} as Record<string, string>, // toolUseId -> tool box
    reportOfTool: {} as Record<string, string>, // delegate tool box -> the subagent's report box
    childOfTool: {} as Record<string, string>, // delegate tool box -> subagentId
    delegateTarget: {} as Record<string, string>, // delegate tool box -> requested subagent name
    ownerOf: {} as Record<string, string>, // tool box -> agentId that called it
    roleOf: {} as Record<string, string>, // agentId -> role
    isSubagent: {} as Record<string, boolean>,
    counts: {} as Record<string, { turns: number; tools: number; errors: number }>,
    act: 1,
    toolDescs: {} as Record<string, Record<string, string>>, // agentId -> tool name -> description it was given
    /** Expanded (default): each subagent's own loop is drawn. Collapsed: each subagent is ONE box that updates live. */
    expandSubagents: true,
    /** Show the ℹ explanation lines (the 💭 model quotes are always shown). */
    showExplain: true,
  }),

  getters: {
    selected(state): FlowNode | undefined {
      return state.nodes.find((n) => n.id === state.selectedId);
    },
  },

  actions: {
    reset() {
      const { expandSubagents, showExplain } = this;
      this.$reset();
      Object.assign(this, { expandSubagents, showExplain });
    },

    /** Rebuilds the whole chart from the events so far (used when toggling the subagent view). */
    rebuild(events: StreamedEvent[]) {
      this.reset();
      for (const e of events) this.ingest(e);
    },

    collapsed(agentId: string) {
      return this.isSubagent[agentId] && !this.expandSubagents;
    },

    node(id: string) {
      return this.nodes.find((n) => n.id === id);
    },

    addNode(id: string, data: StepData) {
      this.nodes.push({ id, type: 'step', position: { x: 0, y: 0 }, data });
      this.say(data.icon, `${data.title}${data.subtitle ? ` · ${data.subtitle}` : ''}`, true);
    },

    /** Update the subtitle bar. */
    say(icon: string, text: string, newStep = false) {
      if (newStep) this.steps++;
      this.caption = { step: this.steps, icon, text };
    },

    connect(source: string | undefined, target: string, kind: EdgeKind = 'flow', active = false) {
      const from = source && this.node(source);
      const to = this.node(target);
      if (!from || !to) return;
      // A brand-new box starts just below the box it comes from, so it "grows out" of it.
      if (!this.edges.some((e) => e.target === target)) to.position = { x: from.position.x, y: from.position.y + 160 };
      this.edges.push({ id: `${source}->${target}`, source, target, type: 'packet', markerEnd: 'arrowclosed', data: { kind, active } });
    },

    /** Stop the packets on every arrow that ends at this box. */
    settle(target: string) {
      for (const edge of this.edges) if (edge.target === target) edge.data = { ...edge.data, active: false };
    },

    update(id: string, patch: Partial<StepData>) {
      const n = this.node(id);
      if (n) n.data = { ...n.data, ...patch };
    },

    ingest(e: StreamedEvent) {
      if (this.stopped && e.type !== 'run_finished') return;
      if ('agentId' in e && this.collapsed(e.agentId) && this.ingestCollapsed(e)) return;
      switch (e.type) {
        case 'run_started':
          this.reset();
          this.act = e.act;
          this.addNode('prompt', {
            kind: 'prompt', icon: '🙋', title: 'You ask', subtitle: short(e.prompt, 70), status: 'done', why: explain.prompt(e.act),
            details: [{ label: 'Prompt', value: e.prompt }],
          });
          break;

        case 'agent_started': {
          const id = `agent:${e.agentId}`;
          const base = e.agentId.replace(/-\d+$/, '');
          this.roleOf[e.agentId] = e.role;
          this.addNode(id, {
            kind: 'agent', icon: AGENT_ICON[base] ?? '🤖', title: e.role, subtitle: e.model, status: 'running',
            tag: e.parentId ? 'subagent' : 'agent',
            code: e.parentId ? ['agent.subagents'] : this.act >= 6 ? ['agent.coordinator', 'hook.register'] : this.act === 5 ? ['agent.coordinator'] : ['agent.planner'],
            why: e.parentId ? explain.subagent() : explain.agent(this.act, e.tools?.length ?? 0),
            details: [
              ...(e.task ? [{ label: 'Task it was given', value: e.task }] : []),
              { label: 'Model', value: e.model },
              { label: 'Tools it can use', value: (e.tools ?? []).map((t) => t.name).join(', ') || 'none' },
            ],
          });
          // An agent starts from the user's prompt, or from the tool call of the agent that asked for it.
          let from = e.parentToolUseId ? this.toolBox[e.parentToolUseId] : e.parentId ? undefined : 'prompt';
          // Older recordings lack parentToolUseId: match the parent's unclaimed "ask <agent>" box by name.
          if (!from && e.parentId) {
            from = this.nodes.find(
              (n) => n.id.startsWith('tool:') && this.delegateTarget[n.id] === base && !this.childOfTool[n.id] && this.ownerOf[n.id] === e.parentId,
            )?.id;
          }
          if (from && e.parentId) this.childOfTool[from] = e.agentId;
          this.isSubagent[e.agentId] = Boolean(e.parentId);
          this.counts[e.agentId] = { turns: 0, tools: 0, errors: 0 };
          this.toolDescs[e.agentId] = Object.fromEntries((e.tools ?? []).map((t) => [t.name, t.description]));
          this.connect(from ?? 'prompt', id, e.parentId ? 'delegate' : 'flow', Boolean(e.parentId));
          break;
        }

        case 'model_call': {
          const id = `think:${e.agentId}:${e.turn}`;
          this.addNode(id, {
            kind: 'think', icon: '🧠', title: `Think · turn ${e.turn}`, subtitle: 'reading everything so far…', status: 'running',
            speaker: this.roleOf[e.agentId], why: explain.thinking(), origin: { agentId: e.agentId, turn: e.turn },
            code: ['loop.decide', 'loop.stop'],
            footer: `≈${e.inputTokens.toLocaleString()} tokens in`,
            details: [{ label: 'What happens', value: 'The model reads the whole conversation so far and decides: call tools, or answer.' }],
          });
          // Turn 1 follows the agent box; later turns follow every result of the previous turn.
          const previous = this.turnOutputs[e.agentId] ?? [];
          if (e.turn === 1 || !previous.length) this.connect(`agent:${e.agentId}`, id);
          for (const box of previous) this.connect(this.reportOfTool[box] ?? box, id, 'result', true);
          this.turnOutputs[e.agentId] = [];
          this.lastThink[e.agentId] = id;
          this.turnOf[e.agentId] = e.turn;
          this.update(`agent:${e.agentId}`, { status: 'done' });
          this.say('🧠', `${this.roleOf[e.agentId]} is thinking: it reads everything so far and decides what to do next.`);
          break;
        }

        case 'model_response': {
          const id = `think:${e.agentId}:${e.turn}`;
          const decision = e.stopReason === 'tool_use' ? 'tools' : e.stopReason === 'end_turn' ? 'answer' : 'other';
          const n = this.node(id);
          const toolCount = Object.keys(this.toolDescs[e.agentId] ?? {}).length;
          const quote = narration(e.stopReason, e.text, e.thinking);
          this.update(id, {
            status: 'done',
            decision,
            subtitle: decision === 'other' ? `stopped: ${e.stopReason}` : undefined,
            quote,
            why: explain.decided(e.stopReason, this.act, toolCount),
            footer: `${n?.data.footer ?? ''} · ${e.outputTokens.toLocaleString()} out`,
            details: [
              { label: 'Decision (stop_reason)', value: e.stopReason },
              ...(e.thinking ? [{ label: '💭 Its reasoning (summary from the API)', value: e.thinking }] : []),
              ...(e.text ? [{ label: 'What the model wrote', value: e.text }] : []),
            ],
          });
          this.settle(id);
          this.say(
            decision === 'tools' ? '🔀' : '🏁',
            quote ? `“${quote}”` : decision === 'tools' ? 'The model decided it needs tools.' : 'The model decided it can answer now.',
          );
          break;
        }

        case 'tool_use': {
          const id = `tool:${e.toolUseId}`;
          const call = describeCall(e.tool, e.input);
          this.addNode(id, {
            kind: 'tool', icon: call.icon, title: call.title, subtitle: call.subtitle, status: 'running',
            tag: e.source === 'mcp' ? 'MCP' : undefined,
            origin: { agentId: e.agentId, turn: this.turnOf[e.agentId] ?? 1, toolUseId: e.toolUseId },
            code: codeForTool(e.tool.split(' = ').pop()!, e.source),
            why: explain.tool(e.tool.split(' = ').pop()!, this.toolDescs[e.agentId]?.[e.tool.split(' = ')[0]], e.source),
            details: [
              { label: 'Tool', value: e.tool + (e.source === 'mcp' ? '  (from the travel-data MCP server)' : '') },
              { label: 'Input (chosen by the model)', value: e.input },
            ],
          });
          this.toolBox[e.toolUseId] = id;
          this.ownerOf[id] = e.agentId;
          if ((e.input as { agent?: string })?.agent && e.tool.endsWith('delegate_task')) this.delegateTarget[id] = (e.input as { agent: string }).agent;
          (this.turnOutputs[e.agentId] ??= []).push(id);
          this.connect(this.lastThink[e.agentId], id, 'call', true);
          break;
        }

        case 'hook_decision': {
          const id = this.toolBox[e.toolUseId];
          const n = this.node(id);
          if (!n) break;
          this.update(id, {
            status: e.decision === 'ask' ? 'waiting' : e.decision === 'block' ? 'error' : n.data.status,
            tag: e.decision === 'ask' ? '🛡 needs approval' : e.decision === 'block' ? '🛡 blocked' : '🛡 allowed',
            why: explain.hook(e.decision),
            code: ['hook.budget', 'loop.hook', ...(n.data.code ?? [])],
            details: [...n.data.details, { label: `Hook decision: ${e.decision}`, value: e.reason }],
          });
          this.say('🛡', e.decision === 'ask' ? 'A hook paused the agent: you must approve this booking.' : `A hook ${e.decision === 'block' ? 'BLOCKED' : 'allowed'} the call: ${e.reason}`);
          break;
        }

        case 'approval_resolved': {
          const id = this.toolBox[e.toolUseId];
          if (id) this.update(id, { status: 'running', tag: e.approved ? '🛡 approved' : '🛡 declined' });
          this.say(e.approved ? '👍' : '✋', e.approved ? 'You approved. The tool runs now.' : 'You declined. The agent will be told.');
          break;
        }

        case 'tool_result': {
          const id = this.toolBox[e.toolUseId];
          const n = this.node(id);
          if (!n) break;
          this.update(id, {
            status: e.isError ? 'error' : 'done',
            footer: e.isError ? `✗ error · ${e.ms} ms` : `✓ ${e.ms} ms`,
            // Keep "why it was picked" on success; on failure, explain what happens next.
            ...(e.isError ? { why: explain.result(true, e.tool.split(' = ').pop()!) } : {}),
            details: [...n.data.details, { label: e.isError ? 'Error (sent back to the model)' : 'Result (sent back to the model)', value: e.output }],
          });
          this.settle(id);
          if (e.isError) this.say('💥', `${n.data.title} failed. The error goes back to the model, and it decides how to recover.`);
          break;
        }

        case 'agent_finished': {
          const isChild = Object.values(this.childOfTool).includes(e.agentId);
          const id = `answer:${e.agentId}`;
          this.addNode(id, {
            kind: isChild ? 'report' : 'answer', icon: isChild ? '📝' : '✅',
            title: isChild ? 'Report back' : 'Final answer', subtitle: short(e.summary, 70), status: 'done',
            footer: `${e.totalTokens.toLocaleString()} tokens used`,
            why: isChild ? explain.report() : explain.answer(this.act),
            code: ['loop.stop'],
            details: [{ label: isChild ? 'Report (the ONLY thing the coordinator sees)' : 'Answer', value: e.summary }],
          });
          this.connect(this.lastThink[e.agentId] ?? `agent:${e.agentId}`, id);
          // The delegate_task box now hands this report back to the coordinator.
          const tool = Object.keys(this.childOfTool).find((t) => this.childOfTool[t] === e.agentId);
          if (tool) {
            this.reportOfTool[tool] = id;
            this.update(tool, { status: 'done' });
            this.settle(tool);
          }
          this.settle(`agent:${e.agentId}`);
          if (!isChild) this.say('✅', 'The model asked for no more tools, so the loop ends. Here is the answer.');
          break;
        }

        case 'step_waiting':
          this.say('⏸', 'Paused before the model thinks. Press ⏭ Next turn when you are ready.');
          break;

        case 'run_stopped': {
          this.stopped = true;
          // Whatever was still busy will not finish: mark it.
          for (const n of this.nodes) {
            if (n.data.status === 'running' || n.data.status === 'waiting') this.update(n.id, { status: 'error', tag: '⏹ stopped', subtitle: n.data.kind === 'think' ? 'cancelled' : n.data.subtitle });
          }
          this.settle('stopped');
          for (const edge of this.edges) edge.data = { ...edge.data, active: false };
          const root = Object.keys(this.isSubagent).find((id) => !this.isSubagent[id]);
          this.addNode('stopped', {
            kind: 'error', icon: '⏹', title: 'Stopped by you', subtitle: 'no more turns', status: 'error', why: explain.stopped(), code: ['run.stop'],
            details: [{ label: 'What happened', value: 'Our code cancelled the model request in flight and did not start another turn.' }],
          });
          this.connect((root && this.lastThink[root]) || 'prompt', 'stopped');
          this.say('⏹', 'You pressed Stop. Our code ended the loop: the model doesn’t get a say in that.');
          break;
        }

        case 'run_finished':
          if (!this.nodes.some((n) => n.data.kind === 'error')) this.celebrate++;
          break;

        case 'error':
          this.addNode(`error:${e.seq}`, { kind: 'error', icon: '⚠️', title: 'Error', subtitle: short(e.message, 60), status: 'error', details: [{ label: 'Error', value: e.message }] });
          this.connect(Object.values(this.lastThink)[0] ?? 'prompt', `error:${e.seq}`);
          break;
      }
    },

    /** A collapsed subagent: no new boxes, just live updates on its single box. Returns true if handled. */
    ingestCollapsed(e: StreamedEvent): boolean {
      if (!('agentId' in e)) return false;
      const box = `agent:${e.agentId}`;
      const n = this.node(box);
      const c = this.counts[e.agentId];
      if (!n || !c) return false;
      const footer = () => `${c.turns} turn${c.turns === 1 ? '' : 's'} · ${c.tools} tool call${c.tools === 1 ? '' : 's'}${c.errors ? ` · ${c.errors} error` : ''}`;
      switch (e.type) {
        case 'model_call':
          c.turns++;
          this.update(box, { status: 'running', subtitle: `🧠 thinking (turn ${e.turn})…`, footer: footer() });
          return true;
        case 'model_response': {
          const quote = narration(e.stopReason, e.text, e.thinking);
          if (quote) {
            this.update(box, { quote, speaker: n.data.title });
            this.say(n.data.icon, `${n.data.title}: “${quote}”`);
          }
          return true;
        }
        case 'tool_use':
          c.tools++;
          this.update(box, {
            subtitle: `🔧 using ${e.tool}…`, footer: footer(),
            details: [...n.data.details, { label: `Called ${e.tool}`, value: e.input }],
          });
          return true;
        case 'tool_result':
          if (e.isError) c.errors++;
          this.update(box, { footer: footer(), details: [...n.data.details, { label: `${e.tool} ${e.isError ? 'failed' : 'returned'}`, value: e.output }] });
          return true;
        case 'agent_finished':
          this.update(box, { status: 'done', subtitle: '✓ done', footer: footer() });
          return false; // still draw the "Report back" box
        default:
          return false;
      }
    },

    /** A rough height from the box's content (matches StepNode's styling closely enough). */
    estimateHeight(d: StepData) {
      const lines = (text: string | undefined, perLine: number) => (text ? Math.ceil(text.length / perLine) : 0);
      let h = d.kind === 'prompt' || d.kind === 'agent' ? 70 : 64;
      if (d.kind === 'prompt') h += lines(d.subtitle, 38) * 16;
      if (d.quote) h += 26 + lines(`${d.speaker ?? ''}: ${d.quote}`, 40) * 18;
      if (d.kind === 'think' && d.decision) h += 54;
      if (this.showExplain && d.why) h += 22 + lines(d.why, 48) * 16;
      if (d.footer) h += 18;
      if (d.origin && (d.kind === 'tool' || d.decision)) h += 34; // the 🔎 Why? button
      return h;
    },

    /**
     * Top-to-bottom layout with dagre, using each box's real (measured) size when the view knows it.
     * Returns true if anything moved.
     */
    layout(measure?: (id: string) => { width: number; height: number } | undefined): boolean {
      // Use the larger of "measured" and "estimated from content", so a stale measurement
      // (the browser hasn't re-measured a box that just grew) can never cause an overlap.
      const size = (id: string) => {
        const m = measure?.(id);
        const n = this.node(id);
        const estimate = n ? this.estimateHeight(n.data) : DEFAULT_SIZE.height;
        return { width: DEFAULT_SIZE.width, height: Math.max(m?.height ?? 0, estimate) };
      };
      const g = new dagre.graphlib.Graph();
      g.setGraph({ rankdir: 'TB', nodesep: 36, ranksep: 56 });
      g.setDefaultEdgeLabel(() => ({}));
      for (const n of this.nodes) g.setNode(n.id, { ...size(n.id) });
      for (const e of this.edges) g.setEdge(e.source, e.target);
      dagre.layout(g);
      let moved = false;
      for (const n of this.nodes) {
        const p = g.node(n.id);
        const s = size(n.id);
        const position = { x: Math.round(p.x - s.width / 2), y: Math.round(p.y - s.height / 2) };
        if (position.x !== n.position.x || position.y !== n.position.y) {
          n.position = position;
          moved = true;
        }
      }
      // Vue Flow re-reads positions when it gets a new array, so hand it one.
      if (moved) this.nodes = [...this.nodes];
      return moved;
    },
  },
});
