# Agent Glass Box

A teaching demo: a trip-planner agent whose every internal step streams to a Vue app and is visualized live.
The audience is developers who are new to agents, so **clarity beats cleverness**.

## Stack
- Node 20+, TypeScript, npm workspaces: `shared/`, `server/`, `mcp-travel-data/`, `web/`.
- Server: Express + SSE, `@anthropic-ai/sdk` with a **hand-written agent loop**. Do not switch to the Agent SDK or the tool runner; the manual loop is the point of the demo.
- MCP: `@modelcontextprotocol/sdk` over stdio (`mcp-travel-data` is a separate process).
- Web: Vue 3 + Vite + Pinia + Vue Flow + dagre.

## Layout
- `shared/src/events.ts`: the event schema. Every visual is a projection of this stream; change it here first.
- `server/src/loop.ts`: the agent loop. **Keep it short (~110 lines) and readable: it is shown on a slide.**
- `server/src/runs.ts`: assembles each act (tools, skills, subagents, hooks).
- `server/src/agents/`, `server/src/tools/`, `server/src/hooks.ts`, `server/src/skills/`.
- `web/src/stores/run.ts`: the hub that ingests events (live or replayed) and fans them out to other stores.

## Conventions
- Comments explain the **concept** (what an agent/tool/hook is doing), not the syntax.
- Descriptive names over short ones. No clever abstractions.
- The server must never crash on a tool or API error: emit an `error` event and end the run.
- Never hardcode the API key; it lives in `.env` (`ANTHROPIC_API_KEY`).
- All animation durations read `--speed` (`var(--t-fast|med|slow)`), so the speed slider and replays stay in sync.

## Commands
- `npm run dev`: server on :3001 + web on :5173
- `npm run typecheck`: all workspaces
