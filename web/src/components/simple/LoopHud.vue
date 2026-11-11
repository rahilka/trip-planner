<script setup lang="ts">
// The agent loop, always in view: Think → Act → Observe, lit up as it happens.
import { computed } from 'vue';
import { openLearn } from '../../learn';
import { AGENT_ICON } from '../../stores/flow';
import { useRunStore, type AgentState } from '../../stores/run';

const run = useRunStore();
const root = computed(() => run.agentList.find((a) => !a.parentId));
const helpers = computed(() => run.agentList.filter((a) => a.parentId && a.status !== 'done' && a.status !== 'idle'));

const C = 70;
const R = 50;
const PHASES = [
  { key: 'think', label: 'Think', icon: '🧠', mid: -90 },
  { key: 'act', label: 'Act', icon: '🔧', mid: 30 },
  { key: 'observe', label: 'Observe', icon: '👀', mid: 150 },
] as const;
const point = (deg: number, r = R) => ({ x: C + r * Math.cos((deg * Math.PI) / 180), y: C + r * Math.sin((deg * Math.PI) / 180) });
const arc = (mid: number) => {
  const a = point(mid - 50);
  const b = point(mid + 50);
  return `M ${a.x} ${a.y} A ${R} ${R} 0 0 1 ${b.x} ${b.y}`;
};
const phaseOf = (a?: AgentState) => (a?.frozen ? 'act' : a?.phase ?? null);
const icon = (a: AgentState) => AGENT_ICON[a.agentId.replace(/-\d+$/, '')] ?? '🤖';
const phaseIcon = (a: AgentState) => (a.phase === 'think' ? '🧠' : a.phase === 'act' ? '🔧' : a.phase === 'observe' ? '👀' : '…');
</script>

<template>
  <div v-if="root" class="hud">
    <div class="caption">The agent loop <button class="ask" title="What is an agent? Think of it like…" @click="openLearn('agent')">❓</button></div>
    <svg viewBox="0 0 140 140" :class="{ done: root.phase === 'done', frozen: root.frozen }">
      <circle :cx="C" :cy="C" :r="R" class="track" />
      <g v-for="p in PHASES" :key="p.key" :class="['seg', { on: phaseOf(root) === p.key }]">
        <path :d="arc(p.mid)" />
        <text :x="point(p.mid, R + (p.mid < 0 ? -1 : 2)).x" :y="point(p.mid, R).y + (p.mid < 0 ? 5 : 6)" class="emoji">{{ p.icon }}</text>
      </g>
      <!-- A little runner going round while the loop is busy -->
      <circle v-if="root.phase && root.phase !== 'done' && !root.frozen" r="5" class="runner">
        <animateMotion dur="2.4s" repeatCount="indefinite" :path="`M ${C} ${C - R} A ${R} ${R} 0 1 1 ${C - 0.01} ${C - R}`" />
      </circle>
      <text :x="C" :y="C - 4" class="small">{{ root.phase === 'done' ? '' : 'turn' }}</text>
      <text :x="C" :y="C + 18" class="big">{{ root.phase === 'done' ? '✓' : root.turn }}</text>
    </svg>
    <div class="labels">
      <span v-for="p in PHASES" :key="p.key" :class="{ on: phaseOf(root) === p.key }">{{ p.label }}</span>
    </div>
    <div class="state">
      {{ root.frozen ? '🔒 paused for your approval' : run.waitingForStep ? '⏸ waiting for you: press Next' : root.phase === 'done' ? 'loop finished' : root.phase === 'think' ? 'the model is deciding…' : root.phase === 'act' ? 'tools are running…' : root.phase === 'observe' ? 'reading the results…' : 'starting…' }}
    </div>
    <div v-if="helpers.length" class="helpers">
      <div class="h-title">Helpers working now</div>
      <div v-for="a in helpers" :key="a.agentId" class="helper">{{ icon(a) }} {{ a.role }} <span>{{ phaseIcon(a) }}</span></div>
    </div>
  </div>
</template>

<style scoped>
.hud {
  position: absolute;
  top: 14px;
  left: 14px;
  width: 190px;
  padding: 10px 12px 12px;
  border-radius: 16px;
  background: color-mix(in srgb, var(--panel) 88%, transparent);
  border: 1px solid var(--border);
  backdrop-filter: blur(6px);
  box-shadow: 0 10px 30px rgb(0 0 0 / 0.4);
  z-index: 5;
  text-align: center;
}
.ask { padding: 0 5px; font-size: 11px; border-radius: 999px; vertical-align: 1px; background: transparent; }
.caption { font-size: 11px; text-transform: uppercase; letter-spacing: 0.1em; color: var(--muted); }
svg { width: 140px; height: 140px; overflow: visible; }
.track { fill: none; stroke: var(--border); stroke-width: 2; stroke-dasharray: 3 5; }
.seg path { fill: none; stroke: var(--panel-2); stroke-width: 12; stroke-linecap: round; transition: stroke 0.3s; }
.seg.on path { stroke: var(--accent); filter: drop-shadow(0 0 6px var(--accent)); }
.frozen .seg.on path { stroke: var(--c-error); filter: drop-shadow(0 0 6px var(--c-error)); }
.done .seg path { stroke: color-mix(in srgb, var(--c-assistant) 60%, transparent); }
.emoji { font-size: 16px; text-anchor: middle; }
.runner { fill: #fff; filter: drop-shadow(0 0 5px var(--accent)); }
.small { fill: var(--muted); font-size: 10px; text-anchor: middle; text-transform: uppercase; }
.big { fill: var(--text); font-size: 26px; font-weight: 800; text-anchor: middle; }
.done .big { fill: var(--c-assistant); }
.labels { display: flex; justify-content: space-around; font-size: 12px; color: var(--muted); margin-top: -4px; }
.labels .on { color: var(--text); font-weight: 800; }
.state { font-size: 12px; margin-top: 6px; color: #c9cede; min-height: 16px; }
.helpers { margin-top: 10px; border-top: 1px solid var(--border); padding-top: 8px; text-align: left; }
.h-title { font-size: 10.5px; color: var(--muted); text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 4px; }
.helper { font-size: 12px; display: flex; justify-content: space-between; padding: 2px 0; }
</style>
