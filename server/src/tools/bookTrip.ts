import type { AgentTool } from '../types.ts';
import { describe } from './describe.ts';

/** A mock booking. Real money would move here, which is exactly why a hook guards it. */
export const bookTripTool = (breakIt: boolean): AgentTool => ({
  source: 'local',
  definition: {
    name: 'book_trip',
    description: describe(breakIt, 'Book the flights and hotel of a submitted trip plan. This spends the user\'s money.'),
    input_schema: {
      type: 'object',
      properties: {
        plan_id: { type: 'string', description: 'The id returned by submit_trip_plan' },
        total_eur: { type: 'number', description: 'Total trip cost in EUR' },
      },
      required: ['plan_id', 'total_eur'],
    },
  },
  run: async ({ plan_id, total_eur }: { plan_id: string; total_eur: number }) => ({
    confirmation: `GB-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
    plan_id,
    charged_eur: total_eur,
    status: 'booked (mock, no money moved)',
  }),
});
