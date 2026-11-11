// delegate_task: how the coordinator hands work to a subagent.
// Under the hood it's just... another runAgent() call, with a brand-new message history.
import { buildSubagent, SUBAGENTS, type SubagentName } from '../agents/subagents.ts';
import { runAgent } from '../loop.ts';
import type { AgentTool, RunContext } from '../types.ts';
import { describe } from './describe.ts';

export function delegateTaskTool(run: RunContext, toolPool: AgentTool[], breakIt: boolean): AgentTool {
  // Latest run of each subagent: its id and its (future) report, for dependencies.
  const latest = new Map<SubagentName, { agentId: string; report: Promise<string>; finished: boolean }>();
  const count: Record<string, number> = {};

  return {
    source: 'local',
    definition: {
      name: 'delegate_task',
      description: describe(
        breakIt,
        'Hand a task to a specialist subagent and get back its short report. ' +
          Object.entries(SUBAGENTS).map(([name, s]) => `"${name}" = ${s.role}`).join(', ') +
          '. Several delegate_task calls in one response run in parallel. Give each task all the details it needs ' +
          '(cities, dates, budget): the subagent cannot see this conversation.',
      ),
      input_schema: {
        type: 'object',
        properties: {
          agent: { type: 'string', enum: Object.keys(SUBAGENTS) },
          task: { type: 'string', description: 'Complete, self-contained instructions for the subagent' },
        },
        required: ['agent', 'task'],
      },
    },
    run: async ({ agent, task }: { agent: SubagentName; task: string }, caller) => {
      if (!SUBAGENTS[agent]) throw new Error(`Unknown subagent "${agent}"`);
      count[agent] = (count[agent] ?? 0) + 1;
      const agentId = count[agent] === 1 ? agent : `${agent}-${count[agent]}`;
      const subagent = buildSubagent(agent, agentId, caller.agentId, task, toolPool);
      subagent.parentToolUseId = caller.toolUseId;

      // CONTEXT ISOLATION: the subagent starts from scratch. It sees only its own task.
      const messages = [{ role: 'user' as const, content: task }];

      // SEQUENTIAL DEPENDENCY: if this agent needs another one that is still working, wait for it
      // and hand over that agent's report.
      const needs = SUBAGENTS[agent].waitsOn;
      const dependency = needs && latest.get(needs);
      if (dependency) subagent.waitsOn = dependency.agentId; // the most recent run, e.g. "weather-2"
      if (dependency && !dependency.finished) {
        // Still running: wait for it, then hand its report over automatically.
        subagent.ready = dependency.report.then((report) => {
          messages[0].content += `\n\nReport from the ${SUBAGENTS[needs].role}:\n${report}`;
        });
      }

      const report = runAgent(subagent, messages, run);
      const entry = { agentId, report, finished: false };
      latest.set(agent, entry);
      void report.then(() => (entry.finished = true), () => (entry.finished = true));
      return await report; // only the SUMMARY travels back up to the coordinator
    },
  };
}
