// Subagents: small specialists. Each one gets its OWN prompt, its OWN tools and a FRESH,
// empty context. The coordinator only ever sees the short report each one sends back.
import { config } from '../config.ts';
import { NARRATE } from './narrate.ts';
import type { AgentConfig, AgentTool } from '../types.ts';

export type SubagentName = 'transport' | 'weather' | 'stay' | 'activities';

type SubagentSpec = { role: string; tools: string[]; prompt: string; waitsOn?: SubagentName };

const today = () => new Date().toISOString().slice(0, 10);
const SHARED = [
  `Today's date is ${today()}.`,
  'Use your tools for every fact. Never invent prices, times or weather.',
  'Reply with a SHORT report (under 120 words). The coordinator reads only your report, not your tool results.',
  NARRATE,
].join('\n');

export const SUBAGENTS: Record<SubagentName, SubagentSpec> = {
  transport: {
    role: 'Transport Scout',
    tools: ['search_flights'],
    prompt:
      'You find flights. Search outbound and return flights for the dates you are given. ' +
      'If a date has no flights, try the next day, and move the return by the same number of days so the trip length stays the same. Return the best 2 options for each direction with times and prices, ' +
      'and point out late-night arrivals.',
  },
  weather: {
    role: 'Weather Analyst',
    tools: ['get_weather'],
    prompt: 'You check the weather. Return conditions for each day with min/max °C and flag rainy days clearly. Say if the data is a forecast or from last year.',
  },
  stay: {
    role: 'Stay Finder',
    tools: ['search_hotels'],
    prompt: 'You find a place to stay. Stay within the budget you are given (use maxPricePerNight). Return the best 2 options with area, nightly price, total and rating.',
  },
  activities: {
    role: 'Activities Curator',
    tools: ['search_activities'],
    waitsOn: 'weather',
    prompt:
      'You plan activities day by day. Put INDOOR activities on rainy days and outdoor ones on dry days. ' +
      'At most 2 paid activities per day. Return a day-by-day list with prices and a total.',
  },
};

/** Builds a subagent from its spec, picking its tools out of everything this run has available. */
export function buildSubagent(name: SubagentName, agentId: string, parentId: string, task: string, toolPool: AgentTool[]): AgentConfig {
  const spec = SUBAGENTS[name];
  return {
    agentId,
    parentId,
    role: spec.role,
    model: config.subagentModel,
    system: [{ kind: 'system', label: `${spec.role} prompt`, text: `${spec.prompt}\n${SHARED}` }],
    tools: toolPool.filter((t) => spec.tools.includes(t.realName ?? t.definition.name)),
    task,
    waitsOn: spec.waitsOn,
  };
}
