import { defineStore } from 'pinia';
import { DEMO_PROMPT, type Block, type Itinerary, type ToolDefinition, type StopReason, type StreamedEvent } from '@glass-box/shared';
import { useContextStore } from './context';
import { useTimelineStore } from './timeline';
import { useGraphStore } from './graph';
import { useFlowStore } from './flow';

export type Phase = 'think' | 'act' | 'observe' | 'done' | null;
export type AgentStatus = 'idle' | 'thinking' | 'acting' | 'waiting' | 'done';

export type AgentState = {
  agentId: string;
  parentId?: string;
  role: string;
  model: string;
  task?: string;
  waitsOn?: string;
  status: AgentStatus;
  phase: Phase;
  turn: number;
  stopReason?: StopReason;
  /** Tool calls in flight, so the loop knows when "Act" is over. */
  pendingTools: number;
  /** Frozen while a human decides on an approval. */
  frozen: boolean;
  tokens: number;
  summary?: string;
  tools: ToolDefinition[];
};

let source: EventSource | undefined;
let replayTimer: ReturnType<typeof setTimeout> | undefined;
let replayEvents: StreamedEvent[] = [];
let replayIndex = 0;
const mcpToolUses = new Set<string>(); // toolUseIds that went to an MCP server
const toolKeys = new Map<string, string>(); // toolUseId -> "agentId|toolName" (for the toolbox)
const toolInputs = new Map<string, unknown>(); // toolUseId -> input, for the approval modal

/** The hub: owns the event stream (live or replayed) and fans every event out to the other stores. */
export const useRunStore = defineStore('run', {
  state: () => ({
    prompt: DEMO_PROMPT,
    act: 1,
    breakIt: false,
    stepMode: true, // on by default so learners go turn by turn; they can untick it

    promptOnlyBudget: false,
    /** Playback speed. Every animation duration is divided by this. */
    speed: 1,

    runId: '' as string,
    mode: 'idle' as 'idle' | 'live' | 'replay',
    /** Replay paused (teaching pace: advance one step at a time). */
    paused: false,
    /** Live step mode: the server is paused before a model call, waiting for "Next". */
    waitingForStep: false,
    /** Toolbox: calls in flight and total calls, keyed "agentId|toolName". */
    activeTools: {} as Record<string, number>,
    toolCalls: {} as Record<string, number>,
    /** Skills the agent has loaded: name -> tokens it added to the context. */
    skillsLoaded: {} as Record<string, number>,
    /** Flags of the current run (break-it, prompt-only budget…). */
    flags: {} as Record<string, boolean>,
    running: false,
    /** The presenter pressed Stop (live or replay). */
    stopped: false,
    events: [] as StreamedEvent[],
    agents: {} as Record<string, AgentState>,
    selectedAgentId: '' as string,
    /** MCP servers discovered via tools/list, and a counter that ticks on every MCP call (drives the flash). */
    mcpServers: [] as { server: string; tools: { name: string; description: string }[] }[],
    mcpCalls: 0,
    /** MCP calls in flight per agent: lights up the agent → MCP edge. */
    mcpPending: {} as Record<string, number>,
    /** Act 6: a human is part of the system (approves bookings). */
    humanInvolved: false,
    approvalOutcome: undefined as string | undefined,
    /** A hook said "ask": the run is paused until a human decides. */
    pendingApproval: undefined as { toolUseId: string; tool: string; input: unknown; reason: string } | undefined,
    itinerary: undefined as Itinerary | undefined,
    showItinerary: false,
    /** Off in the side-by-side panes, where overlays would hide the comparison. */
    autoOpenItinerary: true,
    /** Inspector drawer: a context block, or the tool definitions of the selected agent. */
    inspector: undefined as undefined | { kind: 'block'; block: Block } | { kind: 'tools' },
    showClosing: false,
    error: '' as string,
    totalTokens: 0,
    durationMs: 0,
  }),

  getters: {
    selectedAgent: (s): AgentState | undefined => s.agents[s.selectedAgentId],
    agentList: (s) => Object.values(s.agents),
  },

  actions: {
    reset() {
      source?.close();
      clearTimeout(replayTimer);
      this.events = [];
      this.agents = {};
      this.selectedAgentId = '';
      this.mcpServers = [];
      this.mcpCalls = 0;
      this.mcpPending = {};
      this.humanInvolved = false;
      this.approvalOutcome = undefined;
      this.pendingApproval = undefined;
      this.itinerary = undefined;
      this.showItinerary = false;
      toolInputs.clear();
      useGraphStore().reset();
      useFlowStore().reset();
      mcpToolUses.clear();
      this.error = '';
      this.waitingForStep = false;
      this.stopped = false;
      this.activeTools = {};
      this.toolCalls = {};
      this.skillsLoaded = {};
      this.flags = {};
      this.totalTokens = 0;
      this.durationMs = 0;
      useContextStore().reset();
      useTimelineStore().reset();
    },

    async start() {
      this.reset();
      this.mode = 'live';
      this.running = true;
      const res = await fetch('/api/runs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: this.prompt, act: this.act, breakIt: this.breakIt, stepMode: this.stepMode, promptOnlyBudget: this.promptOnlyBudget }),
      });
      if (!res.ok) {
        this.error = `Could not start run (HTTP ${res.status})`;
        this.running = false;
        return;
      }
      this.runId = (await res.json()).runId;
      source = new EventSource(`/api/runs/${this.runId}/events`);
      source.onmessage = (msg) => this.ingest(JSON.parse(msg.data));
      source.onerror = () => {
        // The stream dropped before the run finished: the server restarted or went down.
        if (this.running) this.lostRun();
      };
    },

    /** Sends a button press (Next turn, Approve, Stop) to the live run. If the server no longer has it, say so. */
    async send(action: 'step' | 'approve' | 'stop', body?: unknown) {
      if (!this.runId) return;
      try {
        const res = await fetch(`/api/runs/${this.runId}/${action}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: body ? JSON.stringify(body) : undefined,
        });
        if (res.ok) return;
      } catch {
        // the server is down: same outcome as below
      }
      this.lostRun();
    },

    /** The server restarted (or is down), so this run no longer exists there. */
    lostRun() {
      source?.close();
      this.error = 'The server restarted, so this run was lost. Press ▶ Run to start again.';
      this.running = false;
      this.waitingForStep = false;
      this.pendingApproval = undefined;
    },

    step() {
      void this.send('step');
    },

    /** The Stop button. Live: the server cancels the model call and starts no new turn. Replay: stop playing. */
    stop() {
      if (!this.running || this.stopped) return;
      if (this.mode === 'live') {
        void this.send('stop');
        return;
      }
      clearTimeout(replayTimer);
      this.paused = false;
      const last = this.events[this.events.length - 1];
      this.ingest({ type: 'run_stopped', runId: last?.runId ?? '', seq: (last?.seq ?? 0) + 1, ts: Date.now() });
      this.running = false;
    },

    approve(toolUseId: string, approved: boolean) {
      void this.send('approve', { toolUseId, approved });
    },

    /** Re-emits a saved run through the exact same code path as a live one, scaled by speed. */
    async replay(file: string) {
      this.reset();
      this.mode = 'replay';
      this.running = true;
      this.paused = false;
      const text = await (await fetch(`/api/recordings/${encodeURIComponent(file)}`)).text();
      replayEvents = text.split('\n').filter(Boolean).map((line) => JSON.parse(line) as StreamedEvent);
      replayIndex = 0;
      this.playNext();
    },

    /** Plays the next recorded event, then schedules the one after it (unless paused). */
    playNext() {
      clearTimeout(replayTimer);
      if (replayIndex >= replayEvents.length) return void (this.running = false);
      const event = replayEvents[replayIndex++];
      this.ingest(event);
      if (this.paused) return;
      const following = replayEvents[replayIndex];
      const gap = following ? following.ts - event.ts : 0;
      // Cap long waits (slow model calls) so replays stay watchable.
      replayTimer = setTimeout(() => this.playNext(), Math.min(gap, 1500) / this.speed);
    },

    pauseReplay() {
      this.paused = true;
      clearTimeout(replayTimer);
    },

    resumeReplay() {
      this.paused = false;
      this.playNext();
    },

    /** Teaching pace: advance the replay until exactly one new step (box or decision) appears. */
    stepReplay() {
      this.pauseReplay();
      const flow = useFlowStore();
      const before = `${flow.steps}|${flow.caption?.text}`;
      while (replayIndex < replayEvents.length && `${flow.steps}|${flow.caption?.text}` === before) this.ingest(replayEvents[replayIndex++]);
      if (replayIndex >= replayEvents.length) this.running = false;
    },

    ingest(e: StreamedEvent) {
      this.events.push(e);
      useContextStore().ingest(e);
      useTimelineStore().ingest(e);
      useFlowStore().ingest(e);
      const agent = 'agentId' in e ? this.agents[e.agentId] : undefined;

      switch (e.type) {
        case 'run_started':
          this.act = e.act;
          this.flags = e.flags;
          this.humanInvolved = e.act >= 6;
          break;
        case 'mcp_handshake':
          this.mcpServers.push({ server: e.server, tools: e.tools });
          break;
        case 'agent_started':
          this.agents[e.agentId] = {
            agentId: e.agentId, parentId: e.parentId, role: e.role, model: e.model, task: e.task, waitsOn: e.waitsOn,
            tools: e.tools ?? [],
            status: e.waitsOn && this.agents[e.waitsOn]?.status !== 'done' ? 'waiting' : 'idle', phase: null, turn: 0, pendingTools: 0, frozen: false, tokens: 0,
          };
          if (!this.selectedAgentId || !e.parentId) this.selectedAgentId = e.agentId; // default: the root agent
          break;
        case 'model_call':
          if (agent) Object.assign(agent, { status: 'thinking', phase: 'think', turn: e.turn, stopReason: undefined });
          break;
        case 'model_response':
          if (agent) agent.stopReason = e.stopReason;
          break;
        case 'tool_use': {
          toolInputs.set(e.toolUseId, e.input);
          const key = `${e.agentId}|${e.tool.split(' = ')[0]}`; // break-it mode reads "tool_2 = search_flights"
          toolKeys.set(e.toolUseId, key);
          this.activeTools[key] = (this.activeTools[key] ?? 0) + 1;
          this.toolCalls[key] = (this.toolCalls[key] ?? 0) + 1;
        }
          if (e.source === 'mcp') {
            this.mcpCalls++;
            mcpToolUses.add(e.toolUseId);
            this.mcpPending[e.agentId] = (this.mcpPending[e.agentId] ?? 0) + 1;
          }
          if (agent) Object.assign(agent, { status: 'acting', phase: 'act', pendingTools: agent.pendingTools + 1 });
          break;
        case 'hook_decision':
          if (agent && e.decision === 'ask') {
            Object.assign(agent, { status: 'waiting', frozen: true });
            this.showItinerary = false; // keep the graph visible during the approval moment
            this.pendingApproval = { toolUseId: e.toolUseId, tool: e.tool, input: toolInputs.get(e.toolUseId), reason: e.reason };
          }
          break;
        case 'approval_resolved':
          this.approvalOutcome = e.approved ? 'approved ✓' : 'declined ✗';
          this.pendingApproval = undefined;
          for (const a of Object.values(this.agents)) if (a.frozen) Object.assign(a, { frozen: false, status: 'acting' });
          break;
        case 'tool_result': {
          const key = toolKeys.get(e.toolUseId);
          if (key) this.activeTools[key] = Math.max(0, (this.activeTools[key] ?? 1) - 1);
        }
          if (mcpToolUses.delete(e.toolUseId)) this.mcpPending[e.agentId] = Math.max(0, (this.mcpPending[e.agentId] ?? 1) - 1);
          if (agent) {
            agent.pendingTools = Math.max(0, agent.pendingTools - 1);
            if (agent.pendingTools === 0) Object.assign(agent, { status: 'acting', phase: 'observe' });
          }
          break;
        case 'agent_finished':
          if (agent) Object.assign(agent, { status: 'done', phase: 'done', summary: e.summary, tokens: e.totalTokens });
          break;
        case 'itinerary':
          this.itinerary = e.data;
          this.showItinerary = this.autoOpenItinerary;
          break;
        case 'error':
          this.error = e.message;
          break;
        case 'skill_loaded':
          this.skillsLoaded[e.skill] = e.tokens;
          break;
        case 'step_waiting':
          this.waitingForStep = true;
          break;
        case 'step_released':
          this.waitingForStep = false;
          break;
        case 'run_stopped':
          this.stopped = true;
          this.waitingForStep = false;
          this.pendingApproval = undefined;
          for (const a of Object.values(this.agents)) {
            if (a.status !== 'done') Object.assign(a, { frozen: false, status: 'done', phase: 'done' });
          }
          break;
        case 'run_finished':
          this.waitingForStep = false;
          this.totalTokens = e.totalTokens;
          this.durationMs = e.durationMs;
          if (this.itinerary && this.autoOpenItinerary) this.showItinerary = true;
          this.running = false;
          source?.close();
          break;
      }
    },
  },
});
