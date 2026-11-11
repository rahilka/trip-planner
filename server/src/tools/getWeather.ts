import type { AgentTool } from '../types.ts';
import { describe } from './describe.ts';

// Open-Meteo: free, no API key. https://open-meteo.com
const GEOCODE = 'https://geocoding-api.open-meteo.com/v1/search';
const FORECAST = 'https://api.open-meteo.com/v1/forecast';
const ARCHIVE = 'https://archive-api.open-meteo.com/v1/archive';
const DAILY = 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum';

// WMO weather codes -> words. https://open-meteo.com/en/docs (Weather variable documentation)
function describeCode(code: number): string {
  if (code === 0) return 'clear';
  if (code <= 3) return 'cloudy';
  if (code <= 48) return 'fog';
  if (code <= 57) return 'drizzle';
  if (code <= 67) return 'rain';
  if (code <= 77) return 'snow';
  if (code <= 82) return 'showers';
  if (code <= 86) return 'snow showers';
  return 'thunderstorm';
}

const shiftYear = (date: string, years: number) => `${Number(date.slice(0, 4)) + years}${date.slice(4)}`;

async function getJson(url: string, params: Record<string, string | number>) {
  const query = new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)]));
  // A website that never answers must not freeze the whole agent: give up after 10 s.
  // The error goes back to the model as a tool result, and it decides how to carry on.
  const res = await fetch(`${url}?${query}`, { signal: AbortSignal.timeout(10_000) }).catch((err: Error) => {
    throw new Error(err.name === 'TimeoutError' ? 'The weather service did not answer within 10 seconds.' : `The weather service could not be reached (${err.message}).`);
  });
  const body = await res.json();
  if (!res.ok || body.error) throw new Error(body.reason ?? `HTTP ${res.status}`);
  return body;
}

async function getWeather({ city, startDate, endDate }: { city: string; startDate: string; endDate: string }) {
  const geo = await getJson(GEOCODE, { name: city, count: 1 });
  const place = geo.results?.[0];
  if (!place) throw new Error(`Unknown city: ${city}`);
  const where = { latitude: place.latitude, longitude: place.longitude, daily: DAILY, timezone: 'auto' };

  // Real forecasts only reach ~2 weeks ahead. Further out, we fall back to what
  // the weather actually was on the same dates last year, and we SAY so.
  let basis = 'forecast';
  let data;
  try {
    data = await getJson(FORECAST, { ...where, start_date: startDate, end_date: endDate });
  } catch {
    basis = 'same dates last year (forecast not available yet this far ahead)';
    data = await getJson(ARCHIVE, { ...where, start_date: shiftYear(startDate, -1), end_date: shiftYear(endDate, -1) });
  }

  // TEACHING POINT: the raw API response is large. Everything we return lands in
  // the model's context window, so we trim it to a compact daily summary first.
  const d = data.daily;
  const days = d.time.map((time: string, i: number) => ({
    date: basis === 'forecast' ? time : shiftYear(time, 1),
    conditions: describeCode(d.weather_code[i]),
    minC: Math.round(d.temperature_2m_min[i]),
    maxC: Math.round(d.temperature_2m_max[i]),
    rainy: d.precipitation_sum[i] >= 1,
  }));
  return { city: `${place.name}, ${place.country_code}`, basis, days };
}

export const getWeatherTool = (breakIt: boolean): AgentTool => ({
  source: 'local',
  definition: {
    name: 'get_weather',
    description: describe(
      breakIt,
      'Get the daily weather for a city between two dates: conditions, min/max °C, and whether each day is rainy. ' +
        'Uses a live forecast when available, otherwise the same dates last year as a guide.',
    ),
    input_schema: {
      type: 'object',
      properties: {
        city: { type: 'string', description: 'City name, e.g. "Paris"' },
        startDate: { type: 'string', description: 'First day, YYYY-MM-DD' },
        endDate: { type: 'string', description: 'Last day, YYYY-MM-DD' },
      },
      required: ['city', 'startDate', 'endDate'],
    },
  },
  run: getWeather,
});
