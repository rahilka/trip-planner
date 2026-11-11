import { randomUUID } from 'node:crypto';
import type { AgentEvent, StartRunRequest, StreamedEvent } from '@glass-box/shared';
import { featuresFor, type RunFlags } from './acts.ts';
import { tripPlannerAgent } from './agents/tripPlanner.ts';
import { coordinatorAgent } from './agents/coordinator.ts';
import { delegateTaskTool } from './tools/delegateTask.ts';
import { budgetFromPrompt, budgetHook, HookRegistry } from './hooks.ts';
import { bookTripTool } from './tools/bookTrip.ts';
import { submitItineraryTool } from './tools/submitItinerary.ts';
import { breakTools } from './tools/describe.ts';
import { runAgent } from './loop.ts';
import { Recorder } from './recorder.ts';
import { getWeatherTool } from './tools/getWeather.ts';
import { loadSkills } from './skills/index.ts';
import { loadSkillTool, skillStubs } from './tools/loadSkill.ts';
import type { SystemPart } from './context.ts';
import { connectTravelData, type McpConnection } from './mcp/client.ts';
import type { AgentTool, RunContext } from './types.ts';

type Listener = (event: StreamedEvent) => void;

/** Thrown at the top of a turn once the presenter has pressed Stop. */
export class RunStopped extends Error {
  constructor() {
    super('Stopped by the presenter');
  }
}

/** One run of the demo: an event log, its live listeners, the step gate and pending approvals. */
export class Run implements RunContext {
  readonly id = randomUUID();
  readonly events: StreamedEvent[] = [];
  readonly hooks = new HookRegistry();
  private listeners = new Set<Listener>();
  private seq = 0;
  private stepWaiters: (() => void)[] = [];
  private approvals = new Map<string, (approved: boolean) => void>();
  private recorder: Recorder;
  private stopper = new AbortController();
  /** Aborts the model call in flight when the presenter presses Stop. */
  readonly signal = this.stopper.signal;
  finished = false;

  constructor(readonly act: number, readonly prompt: string, readonly flags: RunFlags) {
    this.recorder = new Recorder(act);
  }

  emit = (event: AgentEvent) => {
    const streamed = { ...event, runId: this.id, seq: this.seq++, ts: Date.now() } as StreamedEvent;
    this.events.push(streamed);
    this.recorder.append(streamed);
    for (const listener of this.listeners) listener(streamed);
  };

  subscribe(listener: Listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  get stopped() {
    return this.signal.aborted;
  }

  /**
   * Runs before EVERY model call. Stopped → refuse to start another turn.
   * Step mode → resolves only when the presenter clicks "Step".
   */
  gate = () => {
    if (this.stopped) return Promise.reject(new RunStopped());
    if (!this.flags.stepMode) return Promise.resolve();
    // Tell the UI the run is now waiting, so its "Next" button lights up.
    if (!this.stepWaiters.length) this.emit({ type: 'step_waiting' });
    return new Promise<void>((resolve, reject) => this.stepWaiters.push(() => (this.stopped ? reject(new RunStopped()) : resolve())));
  };

  /** The Stop button: cancel the call in flight, wake anything that is waiting, start no new turns. */
  stop() {
    if (this.finished || this.stopped) return false;
    this.emit({ type: 'run_stopped' });
    this.stopper.abort();
    this.stepWaiters.splice(0).forEach((wake) => wake()); // waiting for "Next": wake up, then stop
    for (const resolve of this.approvals.values()) resolve(false); // waiting for approval: treat as "no"
    this.approvals.clear();
    return true;
  }

  step() {
    const waiters = this.stepWaiters.splice(0);
    if (waiters.length) this.emit({ type: 'step_released' });
    waiters.forEach((resolve) => resolve());
    return waiters.length;
  }

  waitForApproval = (toolUseId: string) => new Promise<boolean>((resolve) => this.approvals.set(toolUseId, resolve));

  approve(toolUseId: string, approved: boolean) {
    const resolve = this.approvals.get(toolUseId);
    this.approvals.delete(toolUseId);
    resolve?.(approved);
    return Boolean(resolve);
  }
}

const runs = new Map<string, Run>();
export const getRun = (id: string) => runs.get(id);

export function startRun(request: StartRunRequest): Run {
  const flags: RunFlags = {
    breakIt: Boolean(request.breakIt),
    stepMode: Boolean(request.stepMode),
    promptOnlyBudget: Boolean(request.promptOnlyBudget),
  };
  const act = Math.min(6, Math.max(1, Math.round(request.act || 1)));
  const run = new Run(act, request.prompt, flags);
  runs.set(run.id, run);
  void execute(run); // runs in the background; the client follows along over SSE
  return run;
}

async function execute(run: Run) {
  const started = Date.now();
  let totalTokens = 0;
  run.emit({ type: 'run_started', act: run.act, prompt: run.prompt, flags: { ...run.flags } });
  let mcp: McpConnection | undefined;
  try {
    const features = featuresFor(run.act);
    const tools: AgentTool[] = [];
    if (features.weatherTool) tools.push(getWeatherTool(run.flags.breakIt));
    if (features.mcp) {
      mcp = await connectTravelData(run, run.flags.breakIt);
      tools.push(...mcp.tools);
    }
    let stubs: SystemPart[] = [];
    const skills = features.skill ? loadSkills() : [];
    if (features.skill) stubs = skillStubs(skills); // only names + descriptions go into the prompt

    let agent;
    if (features.subagents) {
      // Act 5+: the data tools go to the subagents. The coordinator only gets delegate_task (+ skills).
      const coordinatorTools = [
        delegateTaskTool(run, tools, run.flags.breakIt),
        loadSkillTool(skills, run, run.flags.breakIt),
        submitItineraryTool(run, run.flags.breakIt),
      ];
      const budget = { eur: budgetFromPrompt(run.prompt), promptOnly: run.flags.promptOnlyBudget };
      if (features.booking) {
        coordinatorTools.push(bookTripTool(run.flags.breakIt));
        // Code enforcement: the hook guards book_trip. In prompt-only mode we skip it on purpose.
        if (!budget.promptOnly) run.hooks.onPreToolUse(budgetHook(budget.eur));
      }
      agent = coordinatorAgent(features, coordinatorTools, stubs, budget);
    } else {
      if (features.skill) tools.push(loadSkillTool(skills, run, run.flags.breakIt));
      agent = tripPlannerAgent(features, tools, stubs);
    }
    if (run.flags.breakIt) {
      // Break-it mode: vague descriptions, no parameter descriptions, opaque names (tool_1, tool_2…).
      const shared = agent.tools === tools; // single agent: its tool list IS the pool
      tools.splice(0, tools.length, ...breakTools(tools));
      if (!shared) agent.tools = breakTools(agent.tools, tools.length + 1);
    }
    await runAgent(agent, [{ role: 'user', content: run.prompt }], run);
  } catch (err) {
    // Never crash the server: report the problem and end the run cleanly. (Stopping on purpose is not an error.)
    if (!run.stopped) run.emit({ type: 'error', message: err instanceof Error ? err.message : String(err) });
  } finally {
    await mcp?.close().catch(() => {});
    totalTokens = run.events.reduce((sum, e) => (e.type === 'agent_finished' ? sum + e.totalTokens : sum), 0);
    run.emit({ type: 'run_finished', totalTokens, durationMs: Date.now() - started });
    run.finished = true;
  }
}
