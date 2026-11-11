// travel-data: a standalone MCP server. It knows nothing about agents or Claude.
// Any MCP client can launch it over stdio, ask "what tools do you have?" (tools/list),
// and call them (tools/call). That's the whole protocol idea.
import { readFileSync } from 'node:fs';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

const load = (file: string) => JSON.parse(readFileSync(new URL(`../data/${file}`, import.meta.url), 'utf8'));
const flights = load('flights.json');
const hotels = load('hotels.json');
const activities = load('activities.json');

/** Mock latency, so the audience can see the call in flight. */
const delay = () => new Promise((r) => setTimeout(r, 300 + Math.random() * 500));
const ok = (data: unknown) => ({ content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] });
const fail = (message: string) => ({ content: [{ type: 'text' as const, text: message }], isError: true });

function airportCode(name: string): string | undefined {
  const key = name.trim().toLowerCase();
  return Object.entries(flights.airports as Record<string, string[]>).find(([, names]) => names.some((n) => key.includes(n)))?.[0];
}

/** Small, deterministic price wobble per date so different days aren't identical. */
const priceFor = (base: number, date: string) => Math.round(base * (1 + ((Number(date.slice(-2)) * 7) % 5) / 20));

const server = new McpServer({ name: 'travel-data', version: '1.0.0' });

server.registerTool(
  'search_flights',
  {
    description:
      'Search one-way flights between two cities on a given date. Returns flights with carrier, airports, ' +
      'local departure and arrival times, number of stops and price in EUR.',
    inputSchema: {
      from: z.string().describe('Origin city or airport, e.g. "Skopje"'),
      to: z.string().describe('Destination city or airport, e.g. "Paris"'),
      date: z.string().describe('Departure date, YYYY-MM-DD'),
    },
  },
  async ({ from, to, date }) => {
    await delay();
    const route = `${airportCode(from)}-${airportCode(to)}`;
    const schedule = flights.routes[route];
    if (!schedule) return fail(`No routes found from ${from} to ${to}.`);
    // PLANTED ERROR: this date always fails, so the agent has to recover and try another day.
    if (flights.unavailable[route]?.includes(date.slice(5))) return fail(`No flights available on ${date} for ${from} → ${to}. Try a different date.`);
    return ok({
      date,
      route,
      flights: schedule.map((f: { priceEur: number }) => ({ ...f, date, priceEur: priceFor(f.priceEur, date) })),
    });
  },
);

server.registerTool(
  'search_hotels',
  {
    description:
      'Search hotels in a city for a stay. Returns name, area, nightly price, total price for the stay and rating. ' +
      'Use maxPricePerNight to stay within budget.',
    inputSchema: {
      city: z.string().describe('City name, e.g. "Paris"'),
      checkIn: z.string().describe('Check-in date, YYYY-MM-DD'),
      checkOut: z.string().describe('Check-out date, YYYY-MM-DD'),
      maxPricePerNight: z.number().optional().describe('Maximum price per night in EUR'),
    },
  },
  async ({ city, checkIn, checkOut, maxPricePerNight }) => {
    await delay();
    const list = hotels[city.trim().toLowerCase()];
    if (!list) return fail(`No hotel data for ${city}.`);
    const nights = Math.round((Date.parse(checkOut) - Date.parse(checkIn)) / 86_400_000);
    if (!(nights > 0)) return fail('checkOut must be after checkIn.');
    const matches = list
      .filter((h: { pricePerNightEur: number }) => maxPricePerNight === undefined || h.pricePerNightEur <= maxPricePerNight)
      .map((h: { pricePerNightEur: number }) => ({ ...h, nights, totalEur: h.pricePerNightEur * nights }));
    return ok({ city, checkIn, checkOut, nights, hotels: matches });
  },
);

server.registerTool(
  'search_activities',
  {
    description:
      'Search things to do in a city. Each activity says whether it is indoor or outdoor, its price in EUR and how long it takes. ' +
      'Filter by indoor=true for rainy days.',
    inputSchema: {
      city: z.string().describe('City name, e.g. "Paris"'),
      category: z.string().optional().describe('museum, landmark, walk, food, market, tour, park or shopping'),
      indoor: z.boolean().optional().describe('true = indoor only, false = outdoor only'),
    },
  },
  async ({ city, category, indoor }) => {
    await delay();
    const list = activities[city.trim().toLowerCase()];
    if (!list) return fail(`No activity data for ${city}.`);
    const matches = list.filter(
      (a: { category: string; indoor: boolean }) =>
        (category === undefined || a.category === category.toLowerCase()) && (indoor === undefined || a.indoor === indoor),
    );
    return ok({ city, activities: matches });
  },
);

await server.connect(new StdioServerTransport());
// Note: stdout is the protocol channel. Logs must go to stderr.
console.error('travel-data MCP server ready (stdio)');
