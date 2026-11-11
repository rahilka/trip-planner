<script setup lang="ts">
// The agent loop, drawn: Think → Act → Observe, around and around until stop_reason says "end_turn".
import { computed } from 'vue';
import { useRunStore } from '../stores/run';

const run = useRunStore();
const agent = computed(() => run.selectedAgent);

const C = 140; // centre
const R = 92; // ring radius
const PHASES = [
  { key: 'think', label: 'Think', hint: 'model call', mid: -90 },
  { key: 'act', label: 'Act', hint: 'tool use', mid: 30 },
  { key: 'observe', label: 'Observe', hint: 'tool result', mid: 150 },
] as const;

const point = (deg: number, r = R) => {
  const rad = (deg * Math.PI) / 180;
  return { x: C + r * Math.cos(rad), y: C + r * Math.sin(rad) };
};
const arc = (mid: number) => {
  const a = point(mid - 52);
  const b = point(mid + 52);
  return `M ${a.x} ${a.y} A ${R} ${R} 0 0 1 ${b.x} ${b.y}`;
};
// Little arrowheads between phases show the direction of travel.
const arrow = (deg: number) => {
  const tip = point(deg + 4);
  const l = point(deg - 4, R - 7);
  const r = point(deg - 4, R + 7);
  return `M ${l.x} ${l.y} L ${tip.x} ${tip.y} L ${r.x} ${r.y}`;
};

const phase = computed(() => agent.value?.phase ?? null);
const done = computed(() => phase.value === 'done');
const frozen = computed(() => agent.value?.frozen ?? false);
const stopLabel = computed(() => {
  const s = agent.value?.stopReason;
  if (!s) return phase.value === 'think' ? 'model is thinking…' : '';
  return s === 'tool_use' ? 'stop_reason: tool_use → keep looping' : `stop_reason: ${s}`;
});
</script>

<template>
  <section class="panel">
    <div class="panel-title">
      Agent loop
      <span v-if="agent" class="who">{{ agent.role }}</span>
    </div>
    <div class="body">
      <svg viewBox="0 0 280 280" class="ring" :class="{ done, frozen }">
        <circle :cx="C" :cy="C" :r="R" class="track" />
        <g v-for="p in PHASES" :key="p.key" :class="['phase', { active: phase === p.key && !done }]">
          <path :d="arc(p.mid)" class="seg" />
          <text :x="point(p.mid, R + 0).x" :y="point(p.mid, R + 0).y + (p.mid < 0 ? -18 : 28)" class="label">{{ p.label }}</text>
          <text :x="point(p.mid).x" :y="point(p.mid).y + (p.mid < 0 ? -6 : 40)" class="hint">{{ p.hint }}</text>
        </g>
        <path v-for="deg in [-30, 90, 210]" :key="deg" :d="arrow(deg)" class="arrow" />

        <g v-if="frozen" :transform="`translate(${point(30).x - 11}, ${point(30).y - 12})`" class="lock">
          <rect x="2" y="10" width="18" height="14" rx="3" />
          <path d="M6 10 V6 a5 5 0 0 1 10 0 V10" fill="none" />
        </g>

        <text :x="C" :y="C - 10" class="turn-label">{{ done ? '' : 'turn' }}</text>
        <text :x="C" :y="C + 26" class="turn">{{ done ? 'Done ✓' : agent?.turn ?? 0 }}</text>
      </svg>
      <div class="badge" :class="agent?.stopReason">{{ stopLabel || (agent ? 'waiting for first call…' : 'no agent yet') }}</div>
      <div v-if="frozen" class="frozen-note">🔒 Paused: waiting for human approval</div>
    </div>
  </section>
</template>

<style scoped>
.who { margin-left: auto; color: var(--text); text-transform: none; letter-spacing: 0; }
.body { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 8px; min-height: 0; }
.ring { width: 100%; max-height: 100%; flex: 1; min-height: 0; overflow: visible; }
.track { fill: none; stroke: var(--border); stroke-width: 2; stroke-dasharray: 3 6; }
.seg { fill: none; stroke: var(--panel-2); stroke-width: 16; stroke-linecap: round; transition: stroke var(--t-med), filter var(--t-med); }
.label { fill: var(--muted); font-size: 17px; font-weight: 700; text-anchor: middle; transition: fill var(--t-med); }
.hint { fill: var(--muted); font-size: 10px; text-anchor: middle; opacity: 0.7; }
.arrow { fill: none; stroke: var(--muted); stroke-width: 2; }
.phase.active .seg { stroke: var(--accent); filter: drop-shadow(0 0 8px var(--accent)); animation: pulse var(--t-slow) ease-in-out infinite; }
.phase.active .label { fill: var(--text); }
.done .seg { stroke: var(--c-assistant); opacity: 0.6; transition: stroke var(--t-slow); }
.frozen .phase.active .seg { animation: none; stroke: var(--c-error); filter: drop-shadow(0 0 6px var(--c-error)); }
.lock rect { fill: var(--c-error); }
.lock path { stroke: var(--c-error); stroke-width: 3; }
.turn-label { fill: var(--muted); font-size: 12px; text-anchor: middle; text-transform: uppercase; letter-spacing: 0.1em; }
.turn { fill: var(--text); font-size: 40px; font-weight: 800; text-anchor: middle; }
.done .turn { fill: var(--c-assistant); font-size: 30px; animation: pop var(--t-med) ease-out; }
.badge { margin-top: 6px; font-family: ui-monospace, Consolas, monospace; font-size: 12px; padding: 4px 10px; border-radius: 6px; background: var(--panel-2); color: var(--muted); }
.badge.tool_use { color: var(--c-tool_use); }
.badge.end_turn { color: var(--c-assistant); }
.badge.max_tokens, .badge.refusal { color: var(--c-error); }
.frozen-note { color: var(--c-error); font-size: 12px; margin-top: 4px; }
@keyframes pulse { 50% { opacity: 0.55; } }
@keyframes pop { from { transform: scale(0.6); opacity: 0; transform-origin: 140px 140px; } }
</style>
