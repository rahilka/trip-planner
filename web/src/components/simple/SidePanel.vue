<script setup lang="ts">
// The "what does the agent have?" side panel: Tools, MCP servers, Skills, Subagents, Hooks.
// Each section only appears once that concept exists in the current act, and glows while it is used.
import { computed, ref } from 'vue';
import { AGENT_ICON } from '../../stores/flow';
import { useContextStore } from '../../stores/context';
import { useRunStore, type AgentState } from '../../stores/run';
import PanelSection from './PanelSection.vue';

const run = useRunStore();
const context = useContextStore();
const open = ref(true);

const TOOL_ICON: Record<string, string> = {
  get_weather: '🌦️',
  search_flights: '✈️',
  search_hotels: '🏨',
  search_activities: '🎟️',
  load_skill: '📖',
  delegate_task: '🤝',
  submit_trip_plan: '📋',
  submit_itinerary: '📋', // older recordings
  book_trip: '💳',
};
const firstSentence = (text: string) => (text.match(/^[^.!?]*[.!?]?/)?.[0] ?? text).trim();
const root = computed(() => run.agentList.find((a) => !a.parentId));
/** The concept this act introduces: its section starts open, the others start folded. */
const focus = computed(() => (['tools', 'tools', 'mcp', 'skills', 'subagents', 'hooks'] as const)[run.act - 1] ?? 'tools');

// ---------- 🧰 Tools ----------
// One card per agent (repeat runs of the same subagent, like "weather-2", share the first card).
const toolAgents = computed(() => run.agentList.filter((a) => !/-\d+$/.test(a.agentId)));
const runsOf = (a: AgentState) => run.agentList.filter((x) => x.agentId === a.agentId || x.agentId.startsWith(`${a.agentId}-`));
const sum = (table: Record<string, number>, a: AgentState, tool: string) => runsOf(a).reduce((n, x) => n + (table[`${x.agentId}|${tool}`] ?? 0), 0);
const toolCount = computed(() => new Set(run.agentList.flatMap((a) => a.tools.map((t) => t.name))).size);
const toolsActive = computed(() => Object.values(run.activeTools).some((n) => n > 0));

// ---------- 🔌 MCP ----------
const mcpActive = computed(() => Object.values(run.mcpPending).some((n) => n > 0));

// ---------- 📖 Skills ----------
// The skill stubs live in the system prompt; we read them from the root agent's context window.
const skills = computed(() => {
  const blocks = root.value ? context.byAgent[root.value.agentId]?.blocks ?? [] : [];
  return blocks
    .filter((b) => b.kind === 'skill_stub')
    .map((b) => ({
      name: b.label,
      description: b.content.match(/: (.*?)(?: \(call load_skill.*)?$/)?.[1] ?? b.content,
      stubTokens: b.tokens,
      loadedTokens: run.skillsLoaded[b.label],
    }));
});

// ---------- 🤝 Subagents ----------
// Who the coordinator CAN ask: read from its delegate_task tool (the enum of agents + their roles).
const delegateTool = computed(() =>
  root.value?.tools.find((t) => (t.input_schema as { properties?: { agent?: unknown } })?.properties?.agent),
);
const subagents = computed(() => {
  const tool = delegateTool.value;
  if (!tool) return [];
  const names = ((tool.input_schema as { properties: { agent: { enum?: string[] } } }).properties.agent.enum ?? []) as string[];
  const roles = Object.fromEntries([...tool.description.matchAll(/"(\w+)" = ([^,.]+)/g)].map((m) => [m[1], m[2].trim()]));
  return names.map((name) => {
    const runs = run.agentList.filter((a) => a.agentId === name || a.agentId.startsWith(`${name}-`));
    const working = runs.some((a) => a.status !== 'done');
    return {
      name,
      role: roles[name] ?? runs[0]?.role ?? name,
      icon: AGENT_ICON[name] ?? '🤖',
      runs: runs.length,
      status: !runs.length ? 'idle' : working ? (runs.some((a) => a.status === 'waiting') ? 'waiting' : 'working') : 'done',
      tokens: runs.reduce((n, a) => n + a.tokens, 0),
    };
  });
});
const subagentsActive = computed(() => subagents.value.some((s) => s.status === 'working'));

// ---------- 🛡 Hooks ----------
const hooksShown = computed(() => run.act >= 6 && Boolean(root.value));
const hookDecisions = computed(() => run.events.flatMap((e) => (e.type === 'hook_decision' ? [e] : [])));
const hookActive = computed(() => Boolean(run.pendingApproval));
</script>

<template>
  <aside v-if="root" :class="['side', { closed: !open }]">
    <button class="toggle" :title="open ? 'Hide this panel' : 'Show what the agent has'" @click="open = !open">
      {{ open ? '›' : '‹ What the agent has' }}
    </button>

    <div v-if="open" class="sections">
      <!-- 🧰 TOOLS -->
      <PanelSection
        icon="🧰"
        title="Tools"
        learn="tool"
        :open="focus === 'tools'"
        :badge="`${toolCount}`"
        color="var(--c-tool_use)"
        :active="toolsActive"
        hint="Functions an agent is allowed to call. The model reads each name + description and picks; our code runs them."
      >
        <div v-for="a in toolAgents" :key="a.agentId" class="group">
          <div class="group-name">{{ AGENT_ICON[a.agentId] ?? '🤖' }} {{ a.role }}</div>
          <p v-if="!a.tools.length" class="none">No tools: it can only answer from what it already knows.</p>
          <ul v-else>
            <li
              v-for="t in a.tools"
              :key="t.name"
              :class="{ busy: sum(run.activeTools, a, t.name) > 0, used: sum(run.toolCalls, a, t.name) > 0 }"
              :title="t.description"
            >
              <span class="ico">{{ TOOL_ICON[t.name] ?? '🔧' }}</span>
              <code>{{ t.name }}</code>
              <span v-if="t.source === 'mcp'" class="mini mcp">MCP</span>
              <span v-if="sum(run.toolCalls, a, t.name)" class="calls">×{{ sum(run.toolCalls, a, t.name) }}</span>
              <div class="desc">{{ firstSentence(t.description) }}</div>
            </li>
          </ul>
        </div>
      </PanelSection>

      <!-- 🔌 MCP SERVERS -->
      <PanelSection
        v-if="run.mcpServers.length"
        icon="🔌"
        title="MCP servers"
        learn="mcp"
        :open="focus === 'mcp'"
        :badge="`${run.mcpServers.length}`"
        color="var(--c-mcp)"
        :active="mcpActive"
        hint="A separate program that offers tools over a standard protocol. The agent asked it “what can you do?” when it connected and got back this list."
      >
        <div v-for="m in run.mcpServers" :key="m.server" :class="['card', { glow: mcpActive }]">
          <div class="card-title">🔌 {{ m.server }} <span class="mini">stdio · own process</span></div>
          <div class="chips">
            <span v-for="t in m.tools" :key="t.name" class="chip">{{ t.name }}</span>
          </div>
          <div class="meta">{{ run.mcpCalls }} call{{ run.mcpCalls === 1 ? '' : 's' }} so far</div>
        </div>
      </PanelSection>

      <!-- 📖 SKILLS -->
      <PanelSection
        v-if="skills.length"
        icon="📖"
        title="Skills"
        learn="skill"
        :open="focus === 'skills'"
        active-label="loaded"
        :badge="`${skills.length}`"
        color="var(--c-skill)"
        :active="skills.some((s) => s.loadedTokens)"
        hint="Packaged know-how. Only a one-line description sits in the prompt; the agent loads the full text when it decides it’s relevant."
      >
        <div v-for="s in skills" :key="s.name" :class="['card', { loaded: s.loadedTokens }]">
          <div class="card-title">📖 {{ s.name }}</div>
          <div class="desc">{{ firstSentence(s.description) }}</div>
          <div v-if="s.loadedTokens" class="state on">📖 Loaded: the full playbook is in context (+≈{{ s.loadedTokens.toLocaleString() }} tokens)</div>
          <div v-else class="state">📄 Only the description is in context (≈{{ s.stubTokens }} tokens)</div>
        </div>
      </PanelSection>

      <!-- 🤝 SUBAGENTS -->
      <PanelSection
        v-if="subagents.length"
        icon="🤝"
        title="Subagents"
        learn="subagent"
        :open="focus === 'subagents'"
        :badge="`${subagents.length}`"
        color="var(--accent)"
        :active="subagentsActive"
        hint="Specialists the coordinator can hand a task to. Each one starts with an empty memory and only sends back a short report."
      >
        <ul>
          <li v-for="s in subagents" :key="s.name" :class="['agent', s.status]">
            <span class="ico">{{ s.icon }}</span>
            <span class="role">{{ s.role }}</span>
            <span class="status">{{ s.status === 'idle' ? 'idle' : s.status === 'working' ? '⚙️ working' : s.status === 'waiting' ? '⏳ waiting' : '✓ done' }}</span>
            <div class="desc">
              {{ s.runs ? `asked ${s.runs}× · ${s.tokens ? s.tokens.toLocaleString() + ' tokens' : 'working…'}` : 'not asked yet' }}
            </div>
          </li>
        </ul>
      </PanelSection>

      <!-- 🛡 HOOKS -->
      <PanelSection
        v-if="hooksShown"
        icon="🛡"
        title="Hooks"
        learn="hook"
        :open="focus === 'hooks'"
        :badge="run.flags.promptOnlyBudget ? 'off' : '1'"
        color="var(--c-hook)"
        :active="hookActive"
        hint="Code that runs BEFORE a tool and can allow, block, or ask a human. The model can’t talk its way past it."
      >
        <div v-if="run.flags.promptOnlyBudget" class="card warn">
          <div class="card-title">⚠️ No hook in this run</div>
          <div class="desc">The budget rule is only written in the prompt. Whether it’s followed is up to the model.</div>
        </div>
        <div v-else class="card">
          <div class="card-title">🛡 Before <code>book_trip</code></div>
          <div class="rule"><span class="tag block">over budget</span> → block</div>
          <div class="rule"><span class="tag ask">within budget</span> → ask you</div>
          <div v-for="d in hookDecisions" :key="d.seq" :class="['decision', d.decision]">
            {{ d.decision === 'block' ? '⛔ Blocked' : d.decision === 'ask' ? '🙋 Asked you' : '✓ Allowed' }}: {{ d.reason }}
          </div>
          <div v-if="!hookDecisions.length" class="meta">Not triggered yet.</div>
        </div>
      </PanelSection>
    </div>
  </aside>
</template>

<style scoped>
.side {
  position: absolute;
  top: 14px;
  right: 14px;
  bottom: 14px;
  width: 290px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  z-index: 5;
  pointer-events: none;
}
.side > * { pointer-events: auto; }
.side.closed { width: auto; bottom: auto; }
.toggle {
  align-self: flex-end;
  padding: 3px 10px;
  border-radius: 999px;
  font-size: 13px;
  background: color-mix(in srgb, var(--panel) 90%, transparent);
}
.sections { display: flex; flex-direction: column; gap: 8px; overflow-y: auto; overscroll-behavior: contain; min-height: 0; flex: 0 1 auto; padding-right: 4px; scrollbar-width: thin; }
.group { margin-bottom: 8px; }
.group-name { font-size: 12px; font-weight: 700; margin: 4px 2px 5px; }
.none { font-size: 12px; color: var(--muted); font-style: italic; margin: 0; padding: 8px; border: 1px dashed var(--border); border-radius: 10px; }
ul { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 5px; }
li {
  display: grid;
  grid-template-columns: auto 1fr auto auto;
  align-items: center;
  column-gap: 6px;
  padding: 6px 8px;
  border-radius: 10px;
  background: var(--panel);
  border: 1px solid var(--border);
  transition: all 0.3s;
}
.ico { font-size: 15px; }
code { font-size: 12px; overflow: hidden; text-overflow: ellipsis; }
.calls { font-size: 11px; font-weight: 700; color: var(--c-tool_use); }
.desc { grid-column: 1 / -1; font-size: 10.5px; color: var(--muted); line-height: 1.35; margin-top: 2px; }
li.used { border-color: color-mix(in srgb, var(--c-tool_use) 45%, var(--border)); }
li.busy { border-color: var(--c-tool_use); background: color-mix(in srgb, var(--c-tool_use) 20%, var(--panel)); box-shadow: 0 0 14px color-mix(in srgb, var(--c-tool_use) 55%, transparent); transform: scale(1.03); }
.mini { font-size: 9.5px; font-weight: 600; padding: 1px 6px; border-radius: 999px; border: 1px solid var(--border); color: var(--muted); }
.mini.mcp { color: var(--c-mcp); border-color: color-mix(in srgb, var(--c-mcp) 60%, transparent); }

.card { padding: 8px 10px; border-radius: 10px; background: var(--panel); border: 1px solid var(--border); margin-bottom: 6px; transition: all 0.3s; }
.card.glow { border-color: var(--c-mcp); box-shadow: 0 0 14px color-mix(in srgb, var(--c-mcp) 45%, transparent); }
.card.loaded { border-color: var(--c-skill); background: color-mix(in srgb, var(--c-skill) 12%, var(--panel)); }
.card.warn { border-color: var(--c-wrong); background: color-mix(in srgb, var(--c-wrong) 10%, var(--panel)); }
.card-title { font-size: 12.5px; font-weight: 700; display: flex; gap: 6px; align-items: center; flex-wrap: wrap; }
.card .desc { margin-top: 4px; }
.chips { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 6px; }
.chip { font-family: ui-monospace, Consolas, monospace; font-size: 11px; padding: 2px 7px; border-radius: 999px; background: color-mix(in srgb, var(--c-mcp) 14%, var(--panel-2)); border: 1px solid color-mix(in srgb, var(--c-mcp) 40%, transparent); }
.meta { font-size: 11px; color: var(--muted); margin-top: 6px; }
.state { font-size: 11px; margin-top: 6px; color: var(--muted); }
.state.on { color: #f7b6d6; font-weight: 600; }

li.agent { grid-template-columns: auto 1fr auto; }
.role { font-size: 12.5px; font-weight: 600; }
.status { font-size: 11px; color: var(--muted); }
li.agent.working { border-color: var(--accent); box-shadow: 0 0 12px color-mix(in srgb, var(--accent) 45%, transparent); }
li.agent.working .status { color: var(--accent); font-weight: 700; }
li.agent.done .status { color: var(--c-assistant); }
li.agent.idle { opacity: 0.6; }

.rule { font-size: 12px; margin-top: 6px; }
.tag { font-size: 10.5px; padding: 1px 7px; border-radius: 999px; font-weight: 700; }
.tag.block { background: color-mix(in srgb, var(--c-error) 25%, transparent); color: #fca5a5; }
.tag.ask { background: color-mix(in srgb, var(--c-tool_use) 25%, transparent); color: #ffd58a; }
.decision { font-size: 11.5px; margin-top: 8px; padding: 6px 8px; border-radius: 8px; background: var(--panel-2); line-height: 1.35; }
.decision.block { color: #fca5a5; }
.decision.ask { color: #ffd58a; }
</style>
