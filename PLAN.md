# Agent Glass Box — Trip Planner Demo

## Purpose

A teaching demo for a company presentation. The audience is developers who are new to AI agents. The goal is for them to leave with a **visual mental model** of:

- what an agent is
- the agent loop
- tools
- MCP
- context
- skills
- subagents and orchestration
- hooks

The app is a **trip planner agent** whose every internal step is streamed to a **Vue 3 web app** and visualized live.

**Design principle:** a simple agent, shown through glass walls. Clarity beats features. Every concept must be *visible* on screen.

The demo request used throughout the talk:

> "Plan me 4 days in Paris from Skopje in early December, budget €700."

---

## Concepts the app must make visible

| # | Concept | Where it shows up | Visual |
|---|---|---|---|
| 1 | Plain LLM call | Act 1, no tools; answer invents prices and weather | Single model-call card |
| 2 | System prompt | Pinned top block of the context window | Context stack; inspector shows full text |
| 3 | Agent | Trip Planner node | Vue Flow node, pulses while active |
| 4 | Agent loop | Think → Act → Observe | Loop ring (SVG), current phase lit, turn counter |
| 5 | stop_reason | `tool_use` vs `end_turn` | Badge under the loop ring |
| 6 | Tool definition | name, description, JSON schema | Inspector drawer |
| 7 | Tool use / tool result | Raw JSON in and out | Tool cards in the timeline |
| 8 | Tool description quality | "Break it" mode with vague descriptions | Wrong tool picked, orange card |
| 9 | Tool error handling | Mock flight search fails once | Red card, then a retry loop |
| 10 | MCP server | `travel-data` server, separate process | MCP node in the graph |
| 11 | MCP discovery | `tools/list` at startup | Animated handshake; tools appear one by one |
| 12 | Context window | All messages the model sees | Stacked blocks colored by type |
| 13 | Tokens and cost | Usage per call | Fill bar and token badge per node |
| 14 | Skill | `budget-travel-playbook` | Thin one-line block (description only) |
| 15 | Progressive disclosure | Skill loaded on demand | Block expands; token bar jumps |
| 16 | Coordinator | Trip Planner delegates, never searches | Root node |
| 17 | Subagents | Transport, Weather, Stay, Activities | Child nodes spawn |
| 18 | Parallel orchestration | Transport, Weather and Stay at once | Simultaneous pulses; parallel timeline lanes |
| 19 | Sequential dependency | Activities waits for Weather | Dashed edge, "waiting on Weather" |
| 20 | Context isolation | Each subagent has its own context | Separate stacks; summaries as edge labels |
| 21 | Hooks | `PreToolUse` on `book_trip` | Shield icon intercepts the tool card |
| 22 | Human in the loop | Booking needs approval | Approval modal; loop ring freezes |
| 23 | Prompt vs code enforcement | Budget rule in prompt only vs hook | Side-by-side replay of two runs |
| 24 | Structured output | Final itinerary as schema-valid JSON | JSON morphs into day cards |
| 25–27 | CLAUDE.md, slash command, skill in Claude Code | Closing coda | Static closing screen, then live terminal |

---

## Tech stack

**Backend**
- Node 20+ and TypeScript
- `@anthropic-ai/sdk` with a **hand-written agent loop**. Do not use the Agent SDK; the manual loop is the point, because it lets us emit events at every step.
- `@modelcontextprotocol/sdk` for both the MCP server and the client, over stdio.
- Express (or Fastify) with SSE.

**Frontend**
- Vue 3, Vite, TypeScript and Pinia.
- Vue Flow: `@vue-flow/core`, `@vue-flow/background`, `@vue-flow/controls`, `@vue-flow/minimap`.
- `@dagrejs/dagre` for auto-layout.

**Models.** Make these configurable via `.env`:
- `COORDINATOR_MODEL=claude-sonnet-5-5`
- `SUBAGENT_MODEL=claude-haiku-5-5`

**External services**
- The Claude API is the only required one. Read `ANTHROPIC_API_KEY` from `.env` and never commit it.
- Open-Meteo for real weather. It's free and needs no key.
- Everything else is mocked locally.

---

## Repo structure (npm workspaces monorepo)

```
agent-glass-box/
├─ CLAUDE.md                     # project conventions (also a demo prop for the coda)
├─ .claude/
│  ├─ commands/plan-trip.md      # slash command for the Claude Code coda
│  └─ skills/budget-travel-playbook/SKILL.md
├─ shared/                       # event types shared by server and web
│  └─ src/events.ts
├─ mcp-travel-data/              # standalone MCP server (stdio)
│  ├─ src/index.ts
│  └─ data/{flights,hotels,activities}.json
├─ server/
│  ├─ src/
│  │  ├─ index.ts                # HTTP + SSE
│  │  ├─ loop.ts                 # the agent loop (keep it short and readable — it gets shown on a slide)
│  │  ├─ agents/                 # coordinator + subagent definitions (prompt, tools, model)
│  │  ├─ tools/                  # local tools: get_weather, book_trip, load_skill, delegate_task, submit_itinerary
│  │  ├─ mcp/client.ts           # spawns mcp-travel-data, tools/list, callTool
│  │  ├─ hooks.ts                # PreToolUse hook registry
│  │  ├─ skills/                 # skill files used by the app agent
│  │  ├─ acts.ts                 # feature flags per act
│  │  └─ recorder.ts             # writes events to recordings/*.jsonl
│  └─ recordings/
└─ web/
   └─ src/
      ├─ stores/{run,graph,context,timeline}.ts
      ├─ components/
      │  ├─ ActBar.vue
      │  ├─ AgentGraph.vue        # Vue Flow
      │  ├─ nodes/{AgentNode,McpServerNode,HumanNode}.vue
      │  ├─ LoopRing.vue          # SVG
      │  ├─ ContextStack.vue
      │  ├─ Timeline.vue + ToolCard.vue
      │  ├─ InspectorDrawer.vue
      │  ├─ ApprovalModal.vue
      │  ├─ ItineraryView.vue
      │  └─ ClosingScreen.vue
      └─ App.vue
```

---

## Event schema (`shared/src/events.ts`)

Every visual in the UI is a projection of this one stream. Each event also carries `runId`, `seq` and `ts`.

```ts
type Block = {
  kind: 'system' | 'user' | 'assistant' | 'tool_use' | 'tool_result' | 'skill_stub' | 'skill_full';
  label: string;
  tokens: number;      // approximate per block (chars/4 is fine, label it "≈")
  content: string;
};

type AgentEvent =
  | { type: 'run_started'; act: number; prompt: string; flags: Record<string, boolean> }
  | { type: 'mcp_handshake'; server: string; tools: { name: string; description: string }[] }
  | { type: 'agent_started'; agentId: string; parentId?: string; role: string; model: string; task?: string; waitsOn?: string }
  | { type: 'model_call'; agentId: string; turn: number; inputTokens: number }
  | { type: 'model_response'; agentId: string; turn: number; stopReason: 'tool_use' | 'end_turn' | 'max_tokens'; text?: string; outputTokens: number }
  | { type: 'tool_use'; agentId: string; toolUseId: string; tool: string; source: 'local' | 'mcp'; input: unknown }
  | { type: 'hook_decision'; agentId: string; toolUseId: string; tool: string; decision: 'allow' | 'block' | 'ask'; reason: string }
  | { type: 'approval_resolved'; toolUseId: string; approved: boolean }
  | { type: 'tool_result'; agentId: string; toolUseId: string; tool: string; output: unknown; isError: boolean; ms: number }
  | { type: 'skill_loaded'; agentId: string; skill: string; tokens: number }
  | { type: 'context_snapshot'; agentId: string; blocks: Block[]; totalTokens: number; limit: number }
  | { type: 'agent_finished'; agentId: string; summary: string; totalTokens: number }
  | { type: 'itinerary'; data: Itinerary }
  | { type: 'run_finished'; totalTokens: number; durationMs: number }
  | { type: 'error'; message: string };
```

Emit a `context_snapshot` after every change to an agent's messages.

---

## HTTP API

| Method | Path | Purpose |
|---|---|---|
| POST | `/runs` | Body `{ prompt, act, breakIt?, stepMode?, promptOnlyBudget? }`. Returns `{ runId }` |
| GET | `/runs/:id/events` | SSE stream of `AgentEvent` |
| POST | `/runs/:id/step` | Releases the step gate when step mode is on |
| POST | `/runs/:id/approve` | Body `{ toolUseId, approved }` |
| GET | `/recordings` | Lists saved runs |
| GET | `/recordings/:file` | Returns the JSONL of a saved run, for replay |

---

## Backend specification

### The agent loop (`loop.ts`)

One reusable function used by the coordinator **and** every subagent:

```
runAgent({ agentId, parentId, role, model, system, tools, messages, emit, gate, hooks })
  loop:
    await gate()                          // step mode: wait for /step
    emit model_call
    response = messages.create(...)
    emit model_response, context_snapshot
    if stop_reason !== 'tool_use' → emit agent_finished, return final text
    for each tool_use block (execute in PARALLEL with Promise.all):
      emit tool_use
      hookResult = hooks.preToolUse(...) → emit hook_decision
        'block' → tool_result is_error with the reason
        'ask'   → wait for /approve, then emit approval_resolved
      run the tool (local or MCP), catching errors → is_error: true
      emit tool_result
    append the assistant message and tool_results to messages, emit context_snapshot
  max 15 turns as a safety stop
```

Keep `loop.ts` under about 120 lines, readable enough to put on a slide.

### Acts (`acts.ts`)

The same prompt runs under every act. Each act enables more:

| Act | Enabled |
|---|---|
| 1 | Single agent, no tools |
| 2 | + local `get_weather` (Open-Meteo) |
| 3 | + MCP `travel-data` server (flights, hotels, activities) |
| 4 | + skill `budget-travel-playbook` via progressive disclosure |
| 5 | + coordinator and subagents |
| 6 | + `book_trip` tool with a `PreToolUse` hook and human approval |

**Flags:**
- `breakIt` swaps tool descriptions for vague ones, for example "gets data".
- `stepMode` pauses before each model call.
- `promptOnlyBudget` disables the hook and puts the budget rule only in the prompt, for the prompt-vs-code comparison.

### Tools

**Local tools**
- `get_weather(city, startDate, endDate)` calls Open-Meteo, geocoding first, and returns a compact daily summary. Trim the output so it doesn't bloat context, and mention this in a code comment since it's a teaching point.
- `load_skill(name)` returns the full SKILL.md content and emits `skill_loaded`. The system prompt contains only the skill's name and one-line description, which is the `skill_stub` block.
- `delegate_task(agent, task)` exists only on the coordinator, from Act 5. It runs `runAgent` for that subagent with a fresh, isolated message history and returns only the subagent's final summary.
  - Several `delegate_task` calls in one response run in parallel.
- `book_trip(itinerary_id, total_eur)` exists from Act 6. It's a mock that returns a fake confirmation.
- `submit_itinerary(itinerary)` is the structured output. Use a strict JSON schema, and tell the coordinator in its prompt that it must finish by calling this tool. The server emits an `itinerary` event with the validated data.

**MCP server `travel-data`** runs as a separate process, spawned via stdio by `server/mcp/client.ts`. It exposes:
- `search_flights(from, to, date)`
- `search_hotels(city, checkIn, checkOut, maxPricePerNight)`
- `search_activities(city, category?, indoor?)`

Mock data should cover Skopje → Paris and Paris → Skopje for early December, with **planted scenarios**:
- A very cheap flight that lands at 02:10. The agent should notice it.
- `search_flights` for **Dec 1 returns an error** ("No flights available"), so the agent must retry another date. This demonstrates tool errors.
- Hotels range from €45 to €220 per night.
- Activities are tagged indoor or outdoor.

### Agents (Act 5+)

| Agent | Model | Tools | Notes |
|---|---|---|---|
| Trip Planner (coordinator) | coordinator model | `delegate_task`, `load_skill`, `submit_itinerary`, `book_trip` (Act 6) | Never searches itself. Delegates Transport, Weather and Stay in parallel, then Activities with the weather summary |
| Transport Scout | subagent model | `search_flights` (MCP) | Returns the best 2 options with times and prices |
| Weather Analyst | subagent model | `get_weather` | Returns per-day conditions with rainy days flagged |
| Stay Finder | subagent model | `search_hotels` (MCP) | Stays within the budget slice it's given |
| Activities Curator | subagent model | `search_activities` (MCP) | Indoor plans on rainy days. In `agent_started`, set `waitsOn: 'weather'` |

### Hooks (`hooks.ts`)

A simple registry. Each `PreToolUse` hook gets `(agentId, tool, input)` and returns `allow | block | ask` with a reason.

The Act 6 rule for `book_trip`:
- If `total_eur` is over the budget, **block**.
- Otherwise, **ask**, which waits for human approval via the API.

### Step mode, recording, errors

- **Step mode:** `gate()` resolves immediately, or waits for `/step`.
- **Recording:** append every event to `recordings/<timestamp>-act<N>.jsonl`.
- **Errors:** the server must never crash on a tool or API error. Emit an `error` event and end the run cleanly.

---

## Frontend specification

### Layout (single screen, 16:9 projector-friendly, dark theme)

```
┌───────────────────────────────────────────────────────────────┐
│ ActBar: [1][2][3][4][5][6]  Prompt  ▶ Run ⏭ Step ⏮ Replay      │
│         Speed slider  ⚡Break it  Prompt-only budget            │
├───────────────────┬──────────────────┬────────────────────────┤
│ AgentGraph         │ LoopRing          │ ContextStack           │
│ (Vue Flow)         │ (selected agent)  │ (selected agent)       │
├───────────────────┴──────────────────┴────────────────────────┤
│ Timeline with ToolCards (lanes per agent when parallel)        │
└───────────────────────────────────────────────────────────────┘
Overlays: ApprovalModal · ItineraryView · InspectorDrawer · ClosingScreen
```

**Key interaction:** clicking a node in the graph selects that agent, and the LoopRing and ContextStack switch to it. This is how context isolation becomes visible. Default to selecting the coordinator.

### AgentGraph (Vue Flow)

**Custom nodes**
- `AgentNode` shows the role, the model, a status chip (`idle | thinking | acting | waiting | done`), a token badge, and a pulse animation while active.
- `McpServerNode` shows the server name, with its tools appearing one by one on `mcp_handshake`.
- `HumanNode` appears in Act 6 only.

**Edges**
- Coordinator → subagent: animated while running and labelled with the task. On `agent_finished`, the label becomes the summary, so the summary flows up.
- Agent → MCP: flashes on every MCP tool call.
- `waitsOn`: a dashed edge from Weather to Activities.
- Agent → human: red while approval is pending.

**Layout:** auto-layout with dagre, left to right, after every node is added, then `fitView` with a smooth transition.

### LoopRing (SVG)

- Three phases: **Think** (`model_call`), **Act** (`tool_use`) and **Observe** (`tool_result`).
- The active phase glows, and a turn counter sits in the middle.
- A `stop_reason` badge sits below. On `end_turn`, animate the exit to "Done ✓".
- Freeze on Act, with a lock icon, while waiting for approval.

### ContextStack

- Blocks are stacked in order and colored by `kind`.
- A `skill_stub` is thin; it animates into a tall `skill_full` on `skill_loaded`.
- A fill bar shows `totalTokens / limit` with an "≈ N tokens" label.
- Clicking a block opens it in the InspectorDrawer.

### Timeline and ToolCards

- One card per event: model call, tool use (input JSON), tool result (output JSON, duration) and hook decision (shield).
- Card colors:
  - red for `isError`
  - orange when Break-it mode picked a wrong tool
  - MCP tools carry an "MCP" tag
- Split into horizontal lanes per agent when agents run in parallel.

### Other components

- **InspectorDrawer:** the full text of any block, plus tool definitions (name, description, schema) for the selected agent.
- **ApprovalModal:** appears on `hook_decision: ask`, showing the tool, its input and the reason, with Approve and Deny buttons that call `/approve`.
- **ItineraryView:** shows the raw JSON first, then animates into day cards with transport, hotel, weather icons, activities and a budget total.
- **ClosingScreen:** a static table mapping app concepts to Claude Code: agent loop → Claude Code itself, `load_skill` → `.claude/skills`, saved prompt → `.claude/commands`, conventions → `CLAUDE.md`, `PreToolUse` → Claude Code hooks, MCP → the same protocol.

### Replay

- Load a JSONL recording and re-emit its events through the same stores, with timing scaled by the speed slider.
- All animation durations must read the speed setting.
- Include a **side-by-side mode** for two recordings, used for prompt-vs-code enforcement.

---

## Claude Code coda files

- `CLAUDE.md`: short project conventions (stack, folder layout, "keep loop.ts readable").
- `.claude/skills/budget-travel-playbook/SKILL.md`: the same playbook the app agent uses. Budget split guidance (transport about 35–40%, stay about 35–40%, the rest for activities and food), rules like "avoid arrivals after midnight", and the itinerary format.
- `.claude/commands/plan-trip.md`: a slash command that plans a trip with the playbook, taking destination, days and budget as arguments.

---

## Milestones

Build in this order. **Each milestone must run and be verified before starting the next.**

1. **Skeleton.** Monorepo, shared types, `.env.example`, and an Act 1 run streaming events over SSE, printed in a bare Vue page.
2. **Loop and local tool (Act 2).** `runAgent` loop, `get_weather` with Open-Meteo, step mode and the recorder.
3. **Core visuals.** ActBar, LoopRing, ContextStack, Timeline and ToolCards, all driven by real events.
4. **MCP (Act 3).** The `mcp-travel-data` server with mock data and planted scenarios, the stdio client, the `mcp_handshake` event and the MCP node.
5. **Skill (Act 4).** `load_skill`, the skill stub in the system prompt, and the expand animation.
6. **Subagents (Act 5).** `delegate_task`, parallel execution, the `waitsOn` dependency, and the full Vue Flow graph with dagre, edge summaries and the node-selection behavior.
7. **Hooks and structured output (Act 6).** The hook registry, `book_trip`, ApprovalModal, `submit_itinerary` and ItineraryView.
8. **Teaching extras.** Break-it mode, the prompt-only-budget comparison with side-by-side replay, the InspectorDrawer and the ClosingScreen.
9. **Coda files and polish.** CLAUDE.md, the skill, the slash command, a README with run instructions, and one recorded run per act committed to `recordings/` as a fallback for the live demo.

---

## Instructions for Claude Code

- Work milestone by milestone. At the end of each, run it, confirm it works, and summarize what was built before moving on.
- Prefer clarity over cleverness. This code will be shown on screen to people new to agents, so use descriptive names and short comments that explain the *concept*, not the syntax.
- Do not use the Claude Agent SDK; the hand-written loop is intentional.
- Never hardcode the API key.
- If something in this plan is ambiguous or seems wrong, ask before deviating.