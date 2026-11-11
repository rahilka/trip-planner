import { config } from '../config.ts';
import { NARRATE } from './narrate.ts';
import type { ActFeatures } from '../acts.ts';
import type { SystemPart } from '../context.ts';
import type { AgentConfig, AgentTool } from '../types.ts';

const today = () => new Date().toISOString().slice(0, 10);

/** Act 5+: the Trip Planner becomes a coordinator. It plans and delegates; it never searches. */
export function coordinatorAgent(
  features: ActFeatures,
  tools: AgentTool[],
  skillStubs: SystemPart[],
  budget: { eur: number; promptOnly: boolean },
): AgentConfig {
  const instructions = [
    'You are the Trip Planner, a COORDINATOR. You never search for data yourself; your specialists do that.',
    `Today's date is ${today()}.`,
    'If the user gives a vague date such as "early December", start the trip on the 1st of that month.',
    'Check your available skills and load any that apply first.',
    'Then work in two rounds:',
    '1. In ONE response, call delegate_task three times so they run in parallel: transport, weather and stay.',
    '   Give each a complete task with cities, exact dates and its slice of the budget.',
    '2. When they report back, call delegate_task for activities. Include the weather report and the activities budget in its task.',
    'If transport moves the dates, keep the trip length the user asked for and use the new dates for everything after that.',
    'Then call submit_trip_plan ONCE with the complete plan. That structured trip plan is your real deliverable.',
    features.booking
      ? 'After submitting, book the trip: call book_trip with the plan_id and the total in EUR. ' +
        'Attempting the booking is safe: the system checks every booking (and asks the user to approve) before any money moves.'
      : '',
    // Prompt-only enforcement: the rule exists only as words that the model may or may not follow.
    features.booking && budget.promptOnly ? `RULE: never call book_trip if the total is over €${budget.eur}.` : '',
    NARRATE,
    'Finish with a 2-3 sentence summary for the user.',
  ]
    .filter(Boolean)
    .join('\n');

  return {
    agentId: 'planner',
    role: 'Trip Planner',
    model: config.coordinatorModel,
    system: [{ kind: 'system', label: 'Coordinator prompt', text: instructions }, ...skillStubs],
    tools,
  };
}
