<script setup lang="ts">
// The simple view: type a prompt, press Run, watch the agent's decisions appear as a flowchart.
import { computed, nextTick, ref, watch } from 'vue';
import { VueFlow, useVueFlow, type NodeMouseEvent } from '@vue-flow/core';
import { Background } from '@vue-flow/background';
import { Controls } from '@vue-flow/controls';
import { MiniMap } from '@vue-flow/minimap';
import '@vue-flow/core/dist/style.css';
import '@vue-flow/controls/dist/style.css';
import '@vue-flow/minimap/dist/style.css';
import { useFlowStore } from '../../stores/flow';
import { useRunStore } from '../../stores/run';
import CaptionBar from './CaptionBar.vue';
import Confetti from './Confetti.vue';
import LoopHud from './LoopHud.vue';
import PacketEdge from './PacketEdge.vue';
import StepDetails from './StepDetails.vue';
import StepNode from './StepNode.vue';
import SidePanel from './SidePanel.vue';
import LearnSheet from './LearnSheet.vue';
import HeroLoop from './HeroLoop.vue';
import DecisionSheet from './DecisionSheet.vue';
import { openLearn } from '../../learn';
import { DEMOS } from '../../demos';

const run = useRunStore();
const flow = useFlowStore();
const { fitView, setCenter, findNode, onNodesChange } = useVueFlow('steps');

const ACTS = [
  { n: 1, label: '1 · Just the model (no tools)' },
  { n: 2, label: '2 · Agent loop + a tool' },
  { n: 3, label: '3 · + MCP server' },
  { n: 4, label: '4 · + Skill' },
  { n: 5, label: '5 · Agent asks other agents' },
  { n: 6, label: '6 · + Hook & your approval' },
];

// ---------- Layout & camera ----------
// Lay boxes out top-to-bottom using their real rendered sizes, then keep the newest box in view.
// Measure boxes straight from the page (always current, unlike cached sizes).
const measure = (id: string) => {
  const el = document.querySelector<HTMLElement>(`.simple .vue-flow__node[data-id="${CSS.escape(id)}"]`);
  return el ? { width: el.offsetWidth, height: el.offsetHeight } : findNode(id)?.dimensions;
};
let pending: ReturnType<typeof setTimeout> | undefined;
let followPending = false;
function relayout(followNewest: boolean) {
  followPending ||= followNewest;
  clearTimeout(pending);
  // A short debounce: let new boxes render (so they can be measured), then lay out once.
  pending = setTimeout(async () => {
    flow.layout(measure);
    await nextTick();
    if (followPending) await follow();
    followPending = false;
    // Boxes that just got new text are re-measured a moment later: tidy up once more.
    setTimeout(() => flow.layout(measure), 350);
  }, 40);
}
watch(() => flow.nodes.length, () => relayout(true));
// A box grows when the model's words or the decision arrive (or ℹ is toggled): make room for it.
watch(
  () => flow.nodes.map((n) => flow.estimateHeight(n.data)).join() + flow.showExplain,
  () => relayout(false),
);
// Boxes change size when the model's words arrive: re-layout so nothing overlaps.
onNodesChange((changes) => {
  if (changes.some((c) => c.type === 'dimensions')) relayout(false);
});

async function follow() {
  const newest = flow.nodes[flow.nodes.length - 1];
  if (!newest) return;
  const top = Math.min(...flow.nodes.map((n) => n.position.y));
  const bottom = Math.max(...flow.nodes.map((n) => n.position.y + (measure(n.id)?.height ?? 120)));
  const fits = (bottom - top) * 0.8 < (document.querySelector('.simple main')?.clientHeight ?? 800) - 120;
  if (fits) return fitView({ padding: 0.2, duration: 500, maxZoom: 0.9 });
  const column = flow.node('prompt')?.position.x ?? newest.position.x; // keep the main column centred
  const h = measure(newest.id)?.height ?? 120;
  return setCenter(column + 150, newest.position.y + h / 2 + 40, { zoom: 0.8, duration: 600 });
}

async function toggleSubagents() {
  flow.expandSubagents = !flow.expandSubagents;
  flow.rebuild(run.events);
  relayout(true);
}
function toggleExplain() {
  flow.showExplain = !flow.showExplain;
}
const onNodeClick = ({ node }: NodeMouseEvent) => (flow.selectedId = node.id);

// ---------- Recordings ----------
// Real runs saved earlier. Watching one never calls the model, so it needs no server and no API key.
// Replay-only mode: the server is not there, or has no key. Then recordings are all we offer.
const replayOnly = computed(() => run.liveAvailable === false);
const selectedDemo = ref(DEMOS[0].file);
const playDemo = () => void run.replay(selectedDemo.value);
/** Live mode: picking from the 📼 menu plays it straight away, then the menu resets to its title. */
function pickRecording(event: Event) {
  const select = event.target as HTMLSelectElement;
  if (select.value) void run.replay(select.value);
  select.value = '';
}

// ---------- Teaching pace ----------
const replaying = computed(() => run.mode === 'replay' && run.running);
const liveStepping = computed(() => run.mode === 'live' && run.running && run.stepMode);

/** One plain sentence for the bottom bar. */
const status = computed(() => {
  if (run.error) return `⚠ ${run.error}`;
  if (run.pendingApproval) return '🛡 Waiting for your approval…';
  const again = replayOnly.value ? '▶ Play' : '▶ Run';
  if (run.stopped) return run.running ? '⏹ Stopping…' : `⏹ Stopped by you. Press ${again} to start again.`;
  if (!run.running) {
    if (run.totalTokens) return `✓ Done in ${(run.durationMs / 1000).toFixed(1)} s · ${run.totalTokens.toLocaleString()} tokens`;
    return replayOnly.value ? '📼 Replay mode: pick a recorded run and press ▶ Play (no API key needed).' : 'Ready.';
  }
  if (replaying.value) return run.paused ? '⏸ Paused: press ⏭ to go one step further' : '📼 Replaying a saved run';
  if (liveStepping.value) return run.waitingForStep ? '⏸ Waiting for you: press ⏭ Next turn' : '🐢 Step mode: working… (the button lights up when it is your turn)';
  return '● Live';
});
</script>

<template>
  <div class="simple">
    <header>
      <div class="brand">🤖 Agent <span>Glass Box</span></div>
      <!-- Replay-only: choose a recorded run. Live: choose what the agent may use, and type a task. -->
      <template v-if="replayOnly">
        <select v-model="selectedDemo" :disabled="run.running" title="A real run, recorded earlier">
          <option v-for="d in DEMOS" :key="d.file" :value="d.file">📼 {{ d.label }}</option>
        </select>
        <input :value="run.mode === 'replay' ? run.prompt : 'The task is in the recording: press ▶ Play'" class="prompt" disabled />
      </template>
      <template v-else>
        <select v-model.number="run.act" :disabled="run.running" title="What the agent is allowed to use">
          <option v-for="a in ACTS" :key="a.n" :value="a.n">{{ a.label }}</option>
        </select>
        <input v-model="run.prompt" class="prompt" :disabled="run.running" @keydown.enter="!run.running && run.start()" />
      </template>
      <button v-if="!run.running && replayOnly" class="run" @click="playDemo">▶ Play</button>
      <button v-else-if="!run.running" class="run" @click="run.start()">▶ Run</button>
      <button v-else class="stop" :disabled="run.stopped" title="Stop the agent: no new turns, the model call in flight is cancelled" @click="run.stop()">
        ⏹ {{ run.stopped ? 'Stopping…' : 'Stop' }}
      </button>
      <select v-if="!replayOnly" class="recordings" :disabled="run.running" title="Watch a run recorded earlier (no model calls)" @change="pickRecording">
        <option value="">📼 Recordings…</option>
        <option v-for="d in DEMOS" :key="d.file" :value="d.file">{{ d.label }}</option>
      </select>
      <button class="learn" title="What is an agent, a tool, MCP…? Everyday analogies and comparisons" @click="openLearn()">📚 Learn</button>
    </header>

    <div class="bar">
      <div class="key">
        <span><i class="pk call" /> request to a tool</span>
        <span><i class="pk result" /> result comes back</span>
        <span><i class="pk delegate" /> task for another agent</span>
      </div>
      <label class="toggle"><input type="checkbox" :checked="flow.showExplain" @change="toggleExplain" /> 💡 Explain</label>
      <label class="toggle"><input type="checkbox" :checked="flow.expandSubagents" @change="toggleSubagents" /> 🔍 Inside subagents</label>
      <label v-if="!replayOnly" class="toggle" title="Live runs: pause before every model call">
        <input v-model="run.stepMode" type="checkbox" :disabled="run.running" /> 🐢 Step by step
      </label>

      <div class="pace">
        <template v-if="replaying">
          <button v-if="!run.paused" title="Pause" @click="run.pauseReplay()">⏸</button>
          <button v-else title="Play" @click="run.resumeReplay()">▶</button>
          <button title="One step further" @click="run.stepReplay()">⏭ Next</button>
        </template>
        <template v-else-if="liveStepping">
          <button v-if="run.waitingForStep" class="next" title="Let the model take its next turn" @click="run.step()">⏭ Next turn</button>
          <button v-else disabled title="The model or a tool is working; the button lights up when it is your turn">⏳ working…</button>
        </template>
      </div>
    </div>

    <main>
      <VueFlow
        id="steps"
        :nodes="flow.nodes"
        :edges="flow.edges"
        :nodes-draggable="false"
        :nodes-connectable="false"
        :min-zoom="0.15"
        :max-zoom="1.5"
        @node-click="onNodeClick"
      >
        <Background pattern-color="#2c3350" :gap="26" :size="1.6" />
        <Controls v-if="flow.nodes.length" position="bottom-left" :show-interactive="false" />
        <!-- Bottom-left, beside the zoom buttons, so the side panel on the right can use the full height -->
        <MiniMap v-if="flow.nodes.length" position="bottom-left" :style="{ marginLeft: '58px' }" pannable zoomable mask-color="rgb(13 15 20 / 0.7)" />
        <template #node-step="{ id, data }">
          <StepNode :data="data" :selected="id === flow.selectedId" :explain="flow.showExplain" />
        </template>
        <template #edge-packet="edge">
          <PacketEdge v-bind="edge" />
        </template>
      </VueFlow>

      <div v-if="!flow.nodes.length" class="hero">
        <div class="kicker">A live look inside an AI agent</div>
        <h1>See every decision an AI agent makes.</h1>
        <p v-if="replayOnly" class="lead">
          Pick a recorded run, press <b>▶ Play</b>, and watch it decide what to do next, which tools to use, and when it’s done.
          These are real runs, saved earlier: no API key needed.
        </p>
        <p v-else class="lead">Give it a task, press <b>▶ Run</b>, and watch it decide what to do next, which tools to use, and when it’s done.</p>
        <HeroLoop />
        <ol class="how">
          <li><span>1</span><div>Pick {{ replayOnly ? 'a recording' : 'an act' }}</div><small>each one adds a new idea</small></li>
          <li><span>2</span><div>Press <b>{{ replayOnly ? '▶ Play' : '▶ Run' }}</b></div><small>{{ replayOnly ? 'pause or step through any time' : 'the agent starts working' }}</small></li>
          <li><span>3</span><div>Click <b>🔎 Why?</b></div><small>on any step, to see its reasoning</small></li>
        </ol>
        <button class="hero-learn" @click="openLearn('agent')">📚 New to agents? Start here: “an agent is like a travel agent at a desk…”</button>
      </div>

      <LoopHud />
      <SidePanel />
      <CaptionBar />
      <Confetti />
      <StepDetails />
    </main>
    <LearnSheet />
    <DecisionSheet />

    <footer>
      <span>{{ status }}</span>
      <span class="tip">Click any box to see what went in and out, and where it is in the code.</span>
      <button v-if="run.itinerary" @click="run.showItinerary = true">📋 Show trip plan</button>
    </footer>
  </div>
</template>

<style scoped>
.simple { height: 100vh; display: flex; flex-direction: column; }
header { display: flex; gap: 10px; align-items: center; padding: 12px 16px; background: linear-gradient(90deg, #171a2b, #1b1530); border-bottom: 1px solid var(--border); flex-wrap: wrap; }
.brand { font-weight: 800; font-size: 19px; }
.brand span { background: linear-gradient(90deg, var(--accent), var(--c-skill)); -webkit-background-clip: text; background-clip: text; color: transparent; }
.stop { font-weight: 800; font-size: 15px; padding: 9px 18px; border-radius: 10px; color: #fff; background: linear-gradient(90deg, #ef4444, #f97316); border-color: transparent; animation: stop-pulse 1.6s ease-in-out infinite; }
.stop:disabled { animation: none; opacity: 0.6; }
@keyframes stop-pulse { 50% { box-shadow: 0 0 18px rgb(239 68 68 / 0.6); } }
.learn { font-weight: 700; padding: 9px 14px; border-radius: 10px; background: color-mix(in srgb, var(--c-skill) 18%, var(--panel)); border-color: color-mix(in srgb, var(--c-skill) 60%, transparent); }
.learn:hover { background: color-mix(in srgb, var(--c-skill) 30%, var(--panel)); }
.hero-learn { margin-top: 10px; pointer-events: auto; border-radius: 999px; padding: 8px 16px; font-size: 14px; background: color-mix(in srgb, var(--c-skill) 14%, var(--panel)); border-color: color-mix(in srgb, var(--c-skill) 55%, transparent); }
.prompt { flex: 1; min-width: 240px; font-size: 15px; padding: 9px 12px; border-radius: 10px; }
header select { border-radius: 10px; padding: 8px 10px; }
header select.recordings { color: var(--muted); }
.run {
  padding: 9px 22px;
  font-size: 15px;
  font-weight: 800;
  border: none;
  border-radius: 10px;
  color: #0d0f14;
  background: linear-gradient(90deg, var(--accent), var(--c-skill));
  box-shadow: 0 4px 16px color-mix(in srgb, var(--accent) 45%, transparent);
}
.run:hover:not(:disabled) { transform: translateY(-1px); }
.bar { display: flex; gap: 16px; align-items: center; padding: 7px 16px; font-size: 13px; color: var(--muted); border-bottom: 1px solid var(--border); flex-wrap: wrap; background: var(--panel); }
.key { display: flex; gap: 14px; flex-wrap: wrap; }
.pk { display: inline-block; width: 10px; height: 10px; border-radius: 50%; margin-right: 5px; vertical-align: -1px; box-shadow: 0 0 6px currentColor; }
.pk.call { background: var(--c-tool_use); color: var(--c-tool_use); }
.pk.result { background: var(--c-tool_result); color: var(--c-tool_result); }
.pk.delegate { background: var(--accent); color: var(--accent); }
.toggle { display: flex; gap: 6px; align-items: center; color: var(--text); cursor: pointer; }
.pace { display: flex; gap: 6px; }
.pace button { padding: 4px 12px; }
.pace .next { background: var(--c-tool_use); border-color: var(--c-tool_use); color: #0d0f14; font-weight: 700; animation: nudge 1.4s ease-in-out infinite; }
main { flex: 1; position: relative; min-height: 0; background: radial-gradient(1200px 700px at 50% 0%, #1a1f36 0%, var(--bg) 70%); }
.hero { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; pointer-events: none; padding: 16px; }
.kicker { font-size: 12px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; color: var(--accent); }
.hero h1 {
  font-size: clamp(26px, 3.2vw, 42px); margin: 8px 0 10px; line-height: 1.15; letter-spacing: -0.01em;
  background: linear-gradient(90deg, #fff 30%, #c9c3ff); -webkit-background-clip: text; background-clip: text; color: transparent;
}
.lead { max-width: 560px; margin: 0 0 6px; font-size: 16px; line-height: 1.5; color: #c9cede; }
.how { display: flex; gap: 10px; flex-wrap: wrap; justify-content: center; list-style: none; padding: 0; margin: 4px 0 14px; }
.how li {
  display: grid; grid-template-columns: auto auto; column-gap: 8px; align-items: center; text-align: left;
  padding: 8px 14px 8px 10px; border-radius: 12px; background: var(--panel-2); border: 1px solid var(--border); font-size: 14px;
}
.how li span {
  grid-row: span 2; width: 26px; height: 26px; border-radius: 50%; display: grid; place-items: center; font-weight: 800; font-size: 13px;
  background: linear-gradient(135deg, var(--accent), var(--c-skill)); color: #fff;
}
.how small { color: var(--muted); font-size: 11.5px; }
footer { display: flex; gap: 16px; align-items: center; padding: 8px 16px; border-top: 1px solid var(--border); background: var(--panel); font-size: 13.5px; }
.tip { color: var(--muted); font-style: italic; margin-left: auto; }
@keyframes nudge { 50% { box-shadow: 0 0 16px 2px color-mix(in srgb, var(--c-tool_use) 60%, transparent); } }
</style>

<style>
/* Vue Flow theming for the flowchart (global: edges live inside the library's SVG). */
.simple .vue-flow__node { padding: 0; border: none; background: transparent; transition: transform 0.45s cubic-bezier(0.3, 1.2, 0.5, 1); }
.simple .vue-flow__handle { opacity: 0; }
.simple .vue-flow__controls { box-shadow: none; bottom: 70px; }
.simple .vue-flow__controls-button { background: var(--panel-2); border-color: var(--border); fill: var(--text); }
.simple .vue-flow__minimap { background: var(--panel); border: 1px solid var(--border); border-radius: 8px; bottom: 70px; }
</style>
