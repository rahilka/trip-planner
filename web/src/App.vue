<script setup lang="ts">
import { computed } from 'vue';
import type { Block } from '@glass-box/shared';
import ActBar from './components/ActBar.vue';
import AgentGraph from './components/AgentGraph.vue';
import ApprovalModal from './components/ApprovalModal.vue';
import ClosingScreen from './components/ClosingScreen.vue';
import CompareView from './components/CompareView.vue';
import ContextStack from './components/ContextStack.vue';
import InspectorDrawer from './components/InspectorDrawer.vue';
import ItineraryView from './components/ItineraryView.vue';
import LoopRing from './components/LoopRing.vue';
import Timeline from './components/Timeline.vue';
import SimpleView from './components/simple/SimpleView.vue';
import { useRunStore } from './stores/run';

const run = useRunStore();

// URL options (handy as a fallback during the live demo):
//   ?replay=<recording>&speed=2   auto-play a saved run
//   ?compare=<a>,<b>              replay two recordings side by side
//   &embed=1                      compact mode used inside the side-by-side view
//   ?coda=1                       open the closing screen
//   ?view=full                    the detailed dashboard (default is the simple flowchart)
const params = new URLSearchParams(location.search);
const compare = params.get('compare')?.split(',').filter(Boolean) ?? [];
const embed = params.get('embed') === '1';
// Default is the simple flowchart; ?view=full opens the detailed dashboard.
const full = params.get('view') === 'full' || embed;
const replayFile = params.get('replay') ?? '';
// Popups would hide the flowchart / the comparison, so only open the itinerary on request there.
if (embed || !full) run.autoOpenItinerary = false;
if (params.get('coda') === '1') run.showClosing = true;
if (params.get('speed')) run.speed = Number(params.get('speed'));
if (replayFile && !compare.length) void run.replay(replayFile);
// Live runs need the server and an API key. Without them the app offers recordings only.
if (!compare.length) void run.checkLive();

// Every animation reads --speed, so the speed slider slows or speeds up the whole show.
const rootStyle = computed(() => ({ '--speed': String(run.speed) }));
const flagsLabel = computed(() => {
  const started = run.events.find((e) => e.type === 'run_started');
  if (!started || started.type !== 'run_started') return '';
  const f = started.flags;
  const parts = [f.breakIt && '⚡ break it', f.stepMode && 'step mode'];
  if (started.act >= 6) parts.push(f.promptOnlyBudget ? 'budget rule: PROMPT only' : 'budget rule: HOOK (code)');
  return parts.filter(Boolean).join(' · ') || 'default';
});
const inspect = (block: Block) => (run.inspector = { kind: 'block', block });
</script>

<template>
  <CompareView v-if="compare.length" :files="compare" :speed="run.speed" :style="rootStyle" />

  <div v-else-if="!full" :style="rootStyle">
    <SimpleView />
    <ApprovalModal />
    <ItineraryView />
  </div>

  <div v-else :class="['app', { embed }]" :style="rootStyle">
    <ActBar v-if="!embed" />
    <div v-else class="embed-bar">
      <b>Act {{ run.act }}</b> · {{ flagsLabel }} · <span class="muted">{{ replayFile.replace('.jsonl', '') }}</span>
    </div>
    <div v-if="run.error" class="error-banner">⚠ {{ run.error }}</div>
    <main class="grid">
      <AgentGraph class="graph" />
      <LoopRing class="loop" />
      <ContextStack class="context" @inspect="inspect" />
      <Timeline class="timeline" />
    </main>
    <ApprovalModal />
    <ItineraryView />
    <InspectorDrawer />
    <ClosingScreen />
    <footer class="status">
      <span>{{ run.mode === 'replay' ? '⏮ replay' : run.running ? '● live' : 'idle' }}</span>
      <button v-if="run.itinerary && !run.showItinerary" class="link" @click="run.showItinerary = true">📋 show trip plan</button>
      <span v-if="run.totalTokens">total {{ run.totalTokens.toLocaleString() }} tokens · {{ (run.durationMs / 1000).toFixed(1) }} s</span>
    </footer>
  </div>
</template>

<style>
@import './styles.css';
</style>

<style scoped>
.app { height: 100vh; display: flex; flex-direction: column; }
/* Inside the side-by-side view each half is narrow, so scale the whole app down. */
.app.embed { zoom: 0.62; height: calc(100vh / 0.62); }
.grid {
  flex: 1;
  min-height: 0;
  display: grid;
  gap: 10px;
  padding: 10px;
  grid-template-columns: 1.7fr 0.85fr 1fr;
  grid-template-rows: 1.35fr 1fr;
  grid-template-areas: 'graph loop context' 'timeline timeline timeline';
}
@media (max-width: 1100px) {
  .grid { grid-template-columns: 1fr 1fr; grid-template-rows: 1.2fr 1fr 1fr; grid-template-areas: 'graph graph' 'loop context' 'timeline timeline'; }
}
.graph { grid-area: graph; }
.loop { grid-area: loop; }
.context { grid-area: context; }
.timeline { grid-area: timeline; }
.embed-bar { padding: 8px 14px; background: var(--panel); border-bottom: 1px solid var(--border); font-size: 15px; }
.muted { color: var(--muted); }
.error-banner { background: color-mix(in srgb, var(--c-error) 20%, var(--panel)); color: #fecaca; padding: 6px 14px; font-size: 13px; }
.link { padding: 0 8px; font-size: 12px; }
.status { display: flex; justify-content: space-between; align-items: center; padding: 4px 14px; font-size: 12px; color: var(--muted); border-top: 1px solid var(--border); }
</style>
