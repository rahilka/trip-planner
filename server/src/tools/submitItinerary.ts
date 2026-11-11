// Structured output: instead of free text, the agent must hand back JSON that matches a schema.
// With strict: true, the API guarantees the tool input matches the schema exactly.
import type Anthropic from '@anthropic-ai/sdk';
import type { Itinerary } from '@glass-box/shared';
import type { AgentTool, RunContext } from '../types.ts';
import { describe } from './describe.ts';

type Schema = Record<string, unknown>;
const str = (description?: string): Schema => ({ type: 'string', ...(description && { description }) });
const num = (description?: string): Schema => ({ type: 'number', ...(description && { description }) });
const bool = (): Schema => ({ type: 'boolean' });
const arr = (items: Schema): Schema => ({ type: 'array', items });
/** Strict mode needs every property required and no extras. */
const obj = (properties: Record<string, Schema>): Schema => ({
  type: 'object',
  properties,
  required: Object.keys(properties),
  additionalProperties: false,
});

const flight = obj({ carrier: str(), depart: str('Local time and airport, e.g. "06:10 SKP"'), arrive: str(), priceEur: num() });

export const ITINERARY_SCHEMA = obj({
  destination: str(),
  origin: str(),
  startDate: str('YYYY-MM-DD'),
  endDate: str('YYYY-MM-DD'),
  transport: obj({ outbound: flight, inbound: flight }),
  hotel: obj({ name: str(), nights: num(), pricePerNightEur: num(), totalEur: num() }),
  days: arr(
    obj({
      day: num(),
      date: str('YYYY-MM-DD'),
      weather: obj({ summary: str(), tempMinC: num(), tempMaxC: num(), rainy: bool() }),
      activities: arr(obj({ time: str('e.g. "10:00"'), name: str(), indoor: bool(), costEur: num() })),
    }),
  ),
  budget: obj({ limitEur: num(), transportEur: num('Flights + airport transfers'), stayEur: num(), activitiesEur: num(), foodEur: num(), totalEur: num() }),
  notes: arr(str()),
}) as Anthropic.Tool['input_schema'];

export const submitItineraryTool = (run: RunContext, breakIt: boolean): AgentTool => {
  let count = 0;
  return {
    source: 'local',
    definition: {
      name: 'submit_trip_plan',
      description: describe(breakIt, 'Submit the final trip plan as structured data. Call this once the plan is complete. Returns the plan_id.'),
      input_schema: ITINERARY_SCHEMA,
      strict: true,
    },
    run: async (input: Omit<Itinerary, 'id'>) => {
      const id = `IT-${Date.now().toString(36).toUpperCase()}${count++ ? `-${count}` : ''}`;
      run.emit({ type: 'itinerary', data: { id, ...input } });
      return { plan_id: id, status: 'received' };
    },
  };
};
