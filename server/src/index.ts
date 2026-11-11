import express from 'express';
import type { StartRunRequest } from '@glass-box/shared';
import { config } from './config.ts';
import { readSpot } from './codeRefs.ts';
import { listRecordings, readRecording } from './recorder.ts';
import { getRun, startRun } from './runs.ts';

const app = express();
app.use(express.json());

// Can this server run the agent live? Without an API key the web app switches to replay-only mode.
app.get('/health', (_req, res) => res.json({ live: Boolean(process.env.ANTHROPIC_API_KEY) }));

// Start a run. The agent works in the background; follow it via the SSE stream.
app.post('/runs', (req, res) => {
  const body = req.body as StartRunRequest;
  if (!body?.prompt) return void res.status(400).json({ error: 'prompt is required' });
  const run = startRun(body);
  res.json({ runId: run.id });
});

// Server-Sent Events: replays everything so far, then streams new events live.
app.get('/runs/:id/events', (req, res) => {
  const run = getRun(req.params.id);
  if (!run) return void res.status(404).end();

  res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
  // Never write to a connection the browser already closed (that can crash the server mid-demo).
  const send = (data: unknown) => {
    if (!res.writableEnded && !res.destroyed) res.write(`data: ${JSON.stringify(data)}\n\n`);
  };
  res.on('error', () => {}); // a dropped connection is not a server problem
  run.events.forEach(send);
  if (run.finished) return void res.end();

  const unsubscribe = run.subscribe((event) => {
    send(event);
    if (event.type === 'run_finished') res.end();
  });
  res.on('close', unsubscribe); // the browser left (closed tab, new run, page reload)
});

app.post('/runs/:id/step', (req, res) => {
  const run = getRun(req.params.id);
  if (!run) return void res.status(404).end();
  res.json({ released: run.step() });
});

// The Stop button: the loop starts no new turns and the model call in flight is cancelled.
app.post('/runs/:id/stop', (req, res) => {
  const run = getRun(req.params.id);
  if (!run) return void res.status(404).end();
  res.json({ stopped: run.stop() });
});

app.post('/runs/:id/approve', (req, res) => {
  const run = getRun(req.params.id);
  const { toolUseId, approved } = req.body ?? {};
  if (!run || typeof toolUseId !== 'string') return void res.status(404).end();
  res.json({ ok: run.approve(toolUseId, Boolean(approved)) });
});

// "📂 Where is this in the code?": one of the hand-picked spots in codeRefs.ts (nothing else can be read).
app.get('/code/:key', (req, res) => {
  const spot = readSpot(req.params.key);
  if (!spot) return void res.status(404).end();
  res.json(spot);
});

app.get('/recordings', (_req, res) => res.json(listRecordings()));

app.get('/recordings/:file', (req, res) => {
  const content = readRecording(req.params.file);
  if (content === undefined) return void res.status(404).end();
  res.type('application/x-ndjson').send(content);
});

app.listen(config.port, () => {
  console.log(`Agent Glass Box server on http://localhost:${config.port}`);
  if (!process.env.ANTHROPIC_API_KEY) console.warn('⚠ ANTHROPIC_API_KEY is not set (add it to .env)');
});

// Last line of defence: log, don't die, in the middle of a live demo.
process.on('unhandledRejection', (err) => console.error('Unhandled rejection:', err));
process.on('uncaughtException', (err) => console.error('Uncaught exception (server kept running):', err));
