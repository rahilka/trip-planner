# Agent Glass Box: Trip Planner Demo

A simple agent, shown through glass walls. A trip-planner agent streams every internal step (model calls, tool calls, context, subagents, hooks) to a Vue app that draws it live.

The demo prompt used throughout the talk:

> Plan me 4 days in Paris from Skopje in early December, budget €700.

## Try it without an API key

You can watch real recorded runs of every act, with no key and no agent server:

```bash
npm install
npm run demo                  # web only, on http://localhost:5173
```

Pick a recording in the 📼 menu and press **▶ Play**. Pause, ⏭ step through, and click any box: it all works, because a recording is just the list of events a real run emitted, and the browser plays them back without calling the model.

The app decides by itself: if the server isn't running, or has no `ANTHROPIC_API_KEY`, it switches to **replay mode** and offers only the recordings. The 9 curated `server/recordings/demo-*.jsonl` files and the "📂 Where is this in the code?" snippets are bundled into the web app (`web/src/demos.ts`), so `npm run build -w web` also gives you a static site that works on any static host.

## Run it live

Requirements: Node 20+ and an Anthropic API key.

```bash
npm install
cp .env.example .env          # then set ANTHROPIC_API_KEY
npm run dev                   # server on :3001, web on http://localhost:5173
```

Optional settings in `.env`: `COORDINATOR_MODEL` (default `claude-sonnet-5-5`), `SUBAGENT_MODEL` (default `claude-haiku-5-5`) and `PORT`.

## The six acts

The same prompt runs in every act. Each act switches on one more capability.

| Act | Adds | What to point at |
|---|---|---|
| 1 | Plain LLM call, no tools | One model call. The answer **invents** weather and prices. |
| 2 | Local tool `get_weather` (Open-Meteo) | The loop ring goes Think → Act → Observe, and `stop_reason` moves from `tool_use` to `end_turn`. |
| 3 | MCP server `travel-data` | Its tools appear one by one at startup (`tools/list`). The Dec 1 flight search **fails (red card)** and the agent retries another date. It skips the 02:10 arrival. |
| 4 | Skill `budget-travel-playbook` | A thin skill stub sits in the context. `load_skill` expands it and the token bar jumps. |
| 5 | Coordinator + 4 subagents | Transport, Weather and Stay run **in parallel**. Activities waits on Weather (dashed edge). Click a node to see its **own** context. |
| 6 | `book_trip` + PreToolUse hook | The hook asks, the loop freezes, the approval modal opens. The structured trip plan turns into day cards. |

### The simple view (default page)

Type a prompt, pick an act, press ▶ Run. Each step appears as a box in a top-to-bottom flowchart, with two kinds of explanation:

- **💭 The model's own words.** Every agent is asked to say in one sentence why, before it calls a tool (`server/src/agents/narrate.ts`). When it answers directly, the box shows a summary of its reasoning, which the API returns with `thinking: { type: 'adaptive', display: 'summarized' }`.
- **ℹ What's happening and why.** Plain-language notes for each kind of step. Edit the wording in `web/src/explain.ts`.

What's on screen:

- **The agent loop ring** (top left) lights up 🧠 Think → 🔧 Act → 👀 Observe as they happen, with a turn counter, and lists the helper agents that are working.
- **Packets on the arrows** show information moving: 🟠 a request to a tool, 🟢 a result coming back, 🟣 a task for another agent.
- **Decision forks**: every 🧠 Think box ends with **🔧 Need tools → loop again** or **🏁 Ready → answer & stop**.
- **Subtitles** (bottom) narrate the current step in one sentence.
- **Teaching pace**: when replaying a 📼 saved run, ⏸ pauses and ⏭ Next advances one step. For live runs, tick 🐢 *Step by step* and press ⏭ *Next turn* before each model call.
- 🎉 Confetti when the final answer arrives.

Toggles: **💡 Explain** hides or shows the notes. **Show inside subagents** expands each subagent into its own loop. Click any box to see exactly what went in and out. The original dashboard is at `/?view=full`.

### Controls (detailed view)

- **Step mode** pauses before every model call. Press ⏭ Step to advance.
- **⚡ Break it** replaces tool descriptions with "Gets data.", removes parameter descriptions and renames tools to `tool_1…`. Cards show both names (`tool_2 = search_flights`). Teaching point: the model still copes, because parameter names give the tools away. The definition *is* the prompt.
- **Prompt-only budget** (Act 6) removes the hook and puts the budget rule in the prompt instead.
- **Speed** scales every animation and replay timing.
- **🔧 Tools** shows exactly what the selected agent is told about each tool. Clicking any context block shows its full text.
- **🎬 Coda** opens the closing screen that maps the app to Claude Code.

## Fallback recordings (no network needed except for the web app)

`server/recordings/demo-*.jsonl` holds one curated run per act, plus extras:

| File | Shows |
|---|---|
| `demo-act1-plain-llm` … `demo-act6-hooks-approval` | One run per act |
| `demo-act3-break-it` | Break-it mode |
| `demo-act6-budget-hook` / `demo-act6-budget-prompt-only` | €300 budget with "book it even if it's a bit over". The hook **blocks** the €463 booking; in prompt-only mode the model chose to obey the rule. |

Pick one in the ActBar and press ⏮ Replay, or use URL options:

- `/?replay=demo-act5-subagents.jsonl&speed=2` auto-plays a recording.
- `/?compare=demo-act6-budget-hook.jsonl,demo-act6-budget-prompt-only.jsonl` shows two recordings side by side.
- `/?coda=1` opens the closing screen.

Every live run is also saved to `server/recordings/<timestamp>-act<N>.jsonl`. These are git-ignored; rename one to `demo-*.jsonl` to keep it.

## Claude Code coda

This repo is also set up for Claude Code:

- `CLAUDE.md`: project conventions.
- `.claude/skills/budget-travel-playbook/SKILL.md`: the same playbook the app's agent loads.
- `.claude/commands/plan-trip.md`: try `/plan-trip Paris 4 700`.
- `.mcp.json`: registers the same `travel-data` MCP server, so Claude Code can call it too.

## How it's built

```
shared/            event schema (shared/src/events.ts): every visual is a projection of it
server/            Express + SSE; the hand-written agent loop (src/loop.ts)
  src/runs.ts        assembles each act: tools, skills, subagents, hooks
  src/agents/        trip planner, coordinator, subagent definitions
  src/tools/         get_weather, load_skill, delegate_task, submit_trip_plan, book_trip
  src/mcp/client.ts  spawns mcp-travel-data, tools/list, callTool
  src/hooks.ts       PreToolUse registry + the budget hook
mcp-travel-data/   standalone MCP server (stdio) with mock flights, hotels and activities
web/               Vue 3 + Pinia + Vue Flow; stores/run.ts ingests events, live or replayed
```

HTTP API: `GET /health` (live runs possible?), `POST /runs`, `GET /runs/:id/events` (SSE), `POST /runs/:id/step`, `POST /runs/:id/approve`, `POST /runs/:id/stop`, `GET /code/:key`, `GET /recordings`, `GET /recordings/:file`.

### Notes

- **Weather:** Open-Meteo forecasts reach about two weeks ahead. For dates further out, `get_weather` returns the same dates last year and says so.
- **Planted scenarios** live in `mcp-travel-data/data/`. There are no SKP→PAR flights on Dec 1, the cheapest outbound lands at 02:10, and hotels cost €45–€220.
- **Token counts** in the context stack are estimates (characters ÷ 4, shown with ≈). The bar defaults to a labelled 10k zoom; toggle it to see the real 1M window.
- **Cost:** an Act 6 run uses about 55–80k tokens (Sonnet coordinator + Haiku subagents). See [How much does it cost to run?](#how-much-does-it-cost-to-run) below.

## How much does it cost to run?

It's cheap. A full Act 6 run, the most expensive one, costs about **14 cents**. Walking through all six acts once costs about **50 cents** in total.

**Measured from the saved demo runs:**

| Act | Tokens per run | Cost per run |
|---|---|---|
| 1 · Just the model | ~1,800 | ~$0.02 |
| 2 · Agent loop + a tool | ~2,700 | ~$0.01 |
| 3 · + MCP server | ~21,000 | ~$0.07 |
| 4 · + Skill | ~21,000 | ~$0.08 |
| 5 · Subagents | ~74,000 | ~$0.14 |
| 6 · Hook & approval | ~53,000–70,000 | ~$0.09–$0.14 |
| **All 6 acts, once** | **~190,000** | **~$0.45** |

I priced it at today's list prices: **Sonnet 5.5** at $2 per million input tokens and $10 per million output, **Haiku 5.5** at $0.10 / $0.50. Prices can change, so the Anthropic pricing page has the final word.

**Why the cost jumps at Act 3 and again at Act 5:**
- **Act 3:** the agent makes four model calls instead of one or two. Every call re-sends the whole conversation, including all the flight and hotel results so far, so input tokens pile up.
- **Act 5:** there are about 20 model calls, because each of the four subagents runs its own loop. Those subagents use **Haiku**, which costs one-twentieth of Sonnet. That's why Act 5 is only about twice as expensive as Act 3, despite making many more calls.
- A live run can come out somewhat higher or lower than the saved one. For example, when the model retries a date with no flights, it takes an extra turn.

**What I'd tell your colleagues:**
- **It's cheap.** Trying everything costs well under a dollar, and even playing around a lot (say, 20 runs of Act 6) stays under about $3.
- **They need their own API key** in `.env`, and the costs go on that key's account. It's sensible to **set a monthly spend limit** in the Anthropic Console, in case something loops or someone leaves it running.
- **Acts 1 and 2 are almost free.** Acts 5 and 6 are the expensive ones.
- **⏹ Stop** cancels a run straight away, so a mistaken run doesn't cost the full amount.
- **For a group workshop,** recordings are free to watch: pick one from the 📼 menu, or put `?replay=demo-act6-budget-hook.jsonl` in the address. No API call at all. Without a key at all, `npm run demo` is enough (see "Try it without an API key").

To make it even cheaper, the next step would be **prompt caching**. The instructions and tool list are re-sent on every turn, and caching them would make that repeated part about 10× cheaper. It isn't switched on now, to keep `loop.ts` simple for the slide.

## Step-by-step: how this was built

Here's how the project is built, in the order you'd build it yourself. Each step adds one layer on top of the one before.

---

### 0. The big picture

```
 Browser (Vue app, port 5173)
   │  POST /api/runs  → start a run
   │  GET  /api/runs/:id/events  ← live stream of "what the agent is doing" (SSE)
   ▼
 Server (Node + Express, port 3001)
   │  runs the AGENT LOOP (our own code, ~110 lines)
   ├──► Anthropic API (Claude): "here's the conversation + tools, what next?"
   ├──► Our local tools (TypeScript functions)
   ├──► Open-Meteo (free weather web API, no key)
   └──► MCP server "travel-data" (a separate Node process, over stdio)
```

There is one key idea. **The server emits an "event" for every step the agent takes** (model call, tool call, hook decision…). **The browser draws those events.** Everything you see on the page is built from that stream.

---

### Step 1: Project setup (a monorepo)

It's one repo with **npm workspaces**: four small packages that live together.

| Folder | What it is |
|---|---|
| `shared/` | The event types, used by both server and browser |
| `server/` | The agent: loop, tools, hooks, subagents, the HTTP API |
| `mcp-travel-data/` | Our own MCP server (flights, hotels, activities) |
| `web/` | The Vue app you see in the browser |

Packages at the root:
- **`typescript`**: everything is written in TypeScript.
- **`concurrently`**: `npm run dev` starts server and web together, with coloured logs.

The API key lives in **`.env`** at the root (`ANTHROPIC_API_KEY=…`). That file is git-ignored and never committed.

---

### Step 2: The contract between server and browser (`shared/src/events.ts`)

Before writing any agent code, we defined **the list of events**, for example:

`run_started` → `agent_started` → `model_call` → `model_response` → `tool_use` → `hook_decision` → `tool_result` → `agent_finished` → `run_finished`

(plus `mcp_handshake`, `skill_loaded`, `step_waiting`, `run_stopped`, `error`…)

**Why first:** server and browser both import this file, so TypeScript catches it if one side changes and the other doesn't. It's the "API contract".

---

### Step 3: The server basics (`server/`)

| Package | Why |
|---|---|
| **`express`** | A small HTTP server: start a run, stream its events, Next/Approve/Stop buttons |
| **`@anthropic-ai/sdk`** | The official Anthropic SDK, for calling Claude |
| **`dotenv`** | Reads `ANTHROPIC_API_KEY` from `.env` |
| **`tsx`** | Runs TypeScript directly, with no build step |

The endpoints are in `server/src/index.ts`:
- `POST /runs`: start a run.
- `GET /runs/:id/events`: **Server-Sent Events (SSE)**, a one-way live stream from server to browser. It's simpler than WebSockets because we only push in one direction.
- `POST /runs/:id/step | approve | stop`: the buttons.
- `GET /code/:key`: the 📂 code spots.

---

### Step 4: The heart: the agent loop (`server/src/loop.ts`)

This is the most important file, and **we wrote it by hand on purpose.** There's no Agent SDK and no "tool runner", because the point of the demo is to *see* the loop.

```
for each turn:
  1. THINK:   call Claude with (instructions + conversation + tool list)
  2. If Claude did NOT ask for a tool (stop_reason = "end_turn") → done, return the answer
  3. ACT:     run every tool it asked for (in parallel), checking hooks first
  4. OBSERVE: add the results to the conversation → next turn
```

How you'd explain it:
- **The model decides; our code executes.** Claude never runs anything. It only *replies* "please call `search_flights` with these inputs".
- **Turn safety limit:** at most 15 turns, so it can't loop forever.
- **Errors never crash the run:** a failing tool becomes a result that says "this failed", and the model decides what to do next.
- **Models** (in `config.ts`): **Claude Sonnet 5.5** for the main agent/coordinator, **Claude Haiku 5.5** (cheaper, faster) for subagents. Adaptive "thinking" is on, so we can show its reasoning summary.

---

### Step 5: The "acts": one capability at a time (`server/src/acts.ts` + `runs.ts`)

The same prompt runs in every act; each act switches on **one more feature**:

| Act | Adds | Teaches |
|---|---|---|
| 1 | nothing, just one model call | A model alone only guesses |
| 2 | the loop + 1 local tool | What an agent is |
| 3 | an MCP server | Tools can come from another program |
| 4 | a skill | Load know-how only when needed |
| 5 | subagents | Delegate work to specialists |
| 6 | a hook + human approval | Code-level guardrails |

`runs.ts` is where each act is **assembled**: it picks the tools, connects MCP, loads skills, builds the agent and registers the hook.

---

### Step 6: Local tools (our own TypeScript functions)

A tool = **a definition the model reads** (name, description, input schema) + **a function our code runs**. They're all in `server/src/tools/`:

| Tool | File | Act | What it does |
|---|---|---|---|
| `get_weather` | `tools/getWeather.ts` | 2+ | Calls **Open-Meteo**, a free public weather API (HTTP, no key). Falls back to last year's weather for far-future dates |
| `load_skill` | `tools/loadSkill.ts` | 4+ | Loads a skill's full text into the context |
| `delegate_task` | `tools/delegateTask.ts` | 5+ | Starts a subagent and returns its report |
| `submit_trip_plan` | `tools/submitItinerary.ts` | 5+ | Final plan as **strict JSON** (structured output) |
| `book_trip` | `tools/bookTrip.ts` | 6 | **Mock** booking: no real money, no real API |

The type for "a tool" is in `server/src/types.ts` (`AgentTool`).

**Teaching point:** the model only ever sees the **name + description + schema**, never the function body. `tools/describe.ts` has the "break-it" mode, which deliberately gives the tools vague descriptions to show how much descriptions matter.

---

### Step 7: MCP: our own server, not an external one

**We do NOT use any external/third-party MCP server.** We wrote our own, `mcp-travel-data/`, so the demo:
- works offline,
- has predictable data,
- includes some "planted" surprises (no flights on Dec 1, a 2 a.m. arrival, hotels from €45 to €220).

**The server side** (`mcp-travel-data/src/index.ts`):
- Packages: **`@modelcontextprotocol/sdk`**, the official MCP SDK, and **`zod`** to define each tool's inputs.
- It registers 3 tools: `search_flights`, `search_hotels`, `search_activities`.
- The data is plain JSON files in `mcp-travel-data/data/` (mock data).
- It talks over **stdio** (standard input/output), not HTTP.

**The client side** (`server/src/mcp/client.ts`). On every run (Act 3+), our server:
1. **Starts the MCP server as a separate process** (`node --import tsx src/index.ts`).
2. Does the MCP handshake and asks **"what tools do you have?"** (`listTools`). Nothing is hard-coded on our side.
3. Wraps each discovered tool so the loop can call it **exactly like a local tool**.

**Teaching point:** to the model, an MCP tool and a local tool look identical. MCP only changes *where the code lives* and *who can reuse it*.

**Bonus:** `.mcp.json` at the root registers the same server for **Claude Code**. So in the final part of the talk you can show that this exact server also works inside Claude Code, without any changes.

---

### Step 8: Skills (`server/src/skills/` + `tools/loadSkill.ts`)

- The skill is a markdown file: `server/src/skills/budget-travel-playbook/SKILL.md`. It has a short header (name + one-line description) and then the full playbook.
- `skills/index.ts` reads the skill files.
- **Only the name + description go into the prompt.** The model loads the full text with the `load_skill` tool when it decides it's relevant ("progressive disclosure").
- We **implemented this mechanism ourselves**, copying how Claude Code skills work. There's also a copy in `.claude/skills/` plus a `/plan-trip` command in `.claude/commands/`, so the same skill works in Claude Code for that final part of the talk.

---

### Step 9: Subagents (`server/src/agents/`)

| File | What it is |
|---|---|
| `agents/tripPlanner.ts` | The single agent's instructions (Acts 1–4) |
| `agents/coordinator.ts` | The coordinator's instructions (Acts 5–6): "plan and delegate, never search yourself" |
| `agents/subagents.ts` | The 4 specialists: Transport Scout, Weather Analyst, Stay Finder, Activities Curator. Each has its own short prompt and **only the tools it needs** |
| `agents/narrate.ts` | "Before calling a tool, say in one sentence why". That's where the 💭 speech bubbles come from |

How it works:
- The coordinator gets the `delegate_task` tool. Calling it **runs the same `runAgent` loop again**, with a subagent's prompt, tools and **an empty conversation**.
- Only the subagent's **final short report** goes back to the coordinator, so the coordinator's context stays small.
- Dependencies: the Activities Curator waits for the Weather Analyst's report.

**Teaching point:** there's only one loop function. A subagent is just "the loop, called again, with different settings".

---

### Step 10: Hooks + human approval (`server/src/hooks.ts`)

- We **implemented this ourselves**: a `HookRegistry` with a "PreToolUse" hook, the same idea as Claude Code hooks.
- In `loop.ts`, **before every tool runs**, our code asks the hooks. The answer can be:
  - **allow:** nothing happens,
  - **block:** the tool never runs and the model gets told why,
  - **ask:** the loop **pauses** until a human clicks Approve or Deny in the browser (`waitForApproval`).
- The budget rule `budgetHook` is a plain `if`: over budget → block, otherwise → ask.
- The "prompt only" variant skips the hook and writes the rule in the prompt instead, so you can show the difference ("asking nicely" vs "a hard limit").

---

### Step 11: Run controls and recordings (`server/src/runs.ts`, `recorder.ts`)

- **Step by step:** before each model call the loop waits at a "gate" until you press **Next turn**.
- **Stop:** cancels the Claude request in flight and starts no new turn.
- **Recorder:** every run is saved as a `.jsonl` file (one event per line) in `server/recordings/`. The `demo-*.jsonl` files are backups for the talk, so you can still demo without internet (`?replay=…`).

---

### Step 12: The frontend (`web/`)

| Package | Why |
|---|---|
| **`vue`** + **`vite`** + `@vitejs/plugin-vue` | The UI framework and the dev server |
| **`pinia`** | State "stores" |
| **`@vue-flow/core`** (+ `background`, `controls`, `minimap`) | The flowchart: boxes and arrows |
| **`@dagrejs/dagre`** | Auto-layout: places the boxes top to bottom without overlaps |
| `vue-tsc` | Type-checks Vue files |

How the data flows:
1. `stores/run.ts` is **the hub**. It opens the event stream (`EventSource`) and passes each event on.
2. `stores/flow.ts` **turns events into boxes and arrows**: `model_call` → a 🧠 Think box, `tool_use` → a 🔧 tool box, and so on.
3. The components in `components/simple/` draw them:

| Component | What it shows |
|---|---|
| `StepNode` | Each box |
| `PacketEdge` | The arrows with moving dots |
| `LoopHud` | The Think → Act → Observe ring |
| `SidePanel` | Tools / MCP / Skills / Subagents / Hooks |
| `StepDetails` | The panel when you click a box |
| `ApprovalModal` | The approval popup |

The learning layer:

| File | What it holds |
|---|---|
| `explain.ts` | The 💡 notes under the boxes |
| `learn.ts` + `LearnSheet.vue` | The 📚 cheat sheet (analogies, "for developers", comparisons) |
| `decision.ts` + `DecisionSheet.vue` | The 🔎 "Why?" breakdown, rebuilt from the events |
| `server/src/codeRefs.ts` + `CodeRefs.vue` | The 📂 "where in the code" spots |

Vite **proxies `/api` to the server** (`web/vite.config.ts`), so the browser only talks to one address.

---

### Quick answers for common questions

- **"Do you use an agent framework / LangChain / the Agent SDK?"** No. Just the plain Anthropic SDK and our own ~110-line loop, so everyone can see the mechanism.
- **"Do you use external MCP servers?"** No. We use one MCP server that we wrote ourselves, running locally as a separate process over stdio.
- **"What external services are called?"** Only two: the **Anthropic API** (needs the key) and **Open-Meteo** (free, no key). Flights, hotels, activities and booking are all mock data.
- **"Where do I add a new tool?"**
  - Local: a new file in `server/src/tools/`, then add it to the tool list in `runs.ts`.
  - MCP: `server.registerTool(...)` in `mcp-travel-data/src/index.ts`. The agent discovers it automatically on the next run.
- **"Where is the 'decision'?"** In one place: the `anthropic.messages.create(...)` call in `loop.ts`. Everything after it just follows what the model replied.
- **"How do I run it?"** Put `ANTHROPIC_API_KEY` in `.env`, then run `npm install` and `npm run dev` from the root, and open http://localhost:5173.

