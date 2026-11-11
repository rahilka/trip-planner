import { config } from '../config.ts';
import { NARRATE } from './narrate.ts';
import type { ActFeatures } from '../acts.ts';
import type { SystemPart } from '../context.ts';
import type { AgentConfig, AgentTool } from '../types.ts';

const today = () => new Date().toISOString().slice(0, 10);

/** The single-agent Trip Planner used in Acts 1 to 4. */
export function tripPlannerAgent(features: ActFeatures, tools: AgentTool[], skillStubs: SystemPart[] = []): AgentConfig {
  const instructions = [
    'You are a friendly trip planner.',
    `Today's date is ${today()}.`,
    'If the user gives a vague date such as "early December", start the trip on the 1st of that month.',
    features.weatherTool
      ? 'Use your tools to get real data. Never invent prices, schedules or weather.'
      : 'Answer directly with a day-by-day plan, approximate costs and what weather to expect.',
    features.skill ? 'Check your available skills and load any that apply before you start searching.' : '',
    features.mcp ? 'Check real flights, hotels and activities, and keep the whole trip within the budget.' : '',
    features.weatherTool ? NARRATE : '',
    'Keep the final answer concise: a short day-by-day plan with a cost breakdown.',
  ]
    .filter(Boolean)
    .join('\n');

  return {
    agentId: 'planner',
    role: 'Trip Planner',
    model: config.coordinatorModel,
    system: [{ kind: 'system', label: 'System prompt', text: instructions }, ...skillStubs],
    tools,
  };
}
