<script setup lang="ts">
// The start screen's picture: the agent loop itself. A dot travels Think → Act → Observe and around again;
// each station lights up as the dot reaches it. When there is nothing left to do, the agent leaves the loop with an answer.
const C = { x: 190, y: 160 };
const R = 96;
const at = (deg: number) => ({ x: C.x + R * Math.cos((deg * Math.PI) / 180), y: C.y + R * Math.sin((deg * Math.PI) / 180) });
const STATIONS = [
  { key: 'think', icon: '🧠', label: 'Think', hint: 'the model decides', deg: -90, color: 'var(--c-system)' },
  { key: 'act', icon: '🔧', label: 'Act', hint: 'our code runs tools', deg: 30, color: 'var(--c-tool_use)' },
  { key: 'observe', icon: '👀', label: 'Observe', hint: 'results go back', deg: 150, color: 'var(--c-tool_result)' },
].map((s, i) => ({ ...s, ...at(s.deg), delay: i }));
</script>

<template>
  <svg class="loop" viewBox="0 0 400 300" role="img" aria-label="The agent loop: think, act, observe, repeat until done, then answer">
    <defs>
      <marker id="hero-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
        <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--c-assistant)" />
      </marker>
    </defs>

    <!-- The track, and a dot running round it -->
    <circle :cx="C.x" :cy="C.y" :r="R" class="track" />
    <g class="runner-orbit" :style="{ transformOrigin: `${C.x}px ${C.y}px` }">
      <circle :cx="C.x" :cy="C.y - R" r="7" class="runner" />
    </g>

    <!-- In the middle: what the loop is -->
    <text :x="C.x" :y="C.y - 6" class="mid-small">the agent loop</text>
    <text :x="C.x" :y="C.y + 16" class="mid-big">repeat until done</text>

    <!-- The way out: no more tools needed → answer -->
    <path :d="`M ${C.x + 40} ${C.y - R - 4} C ${C.x + 110} ${C.y - R - 30}, ${C.x + 150} ${C.y - R - 10}, ${C.x + 160} ${C.y - R + 22}`" class="exit" marker-end="url(#hero-arrow)" />
    <g :transform="`translate(${C.x + 162} ${C.y - R + 40})`" class="answer">
      <rect x="-44" y="-15" width="88" height="30" rx="15" />
      <text y="5">✅ Answer</text>
    </g>
    <text :x="C.x + 112" :y="C.y - R - 22" class="exit-label">done?</text>

    <!-- The three stations -->
    <g v-for="s in STATIONS" :key="s.key" class="station" :style="{ '--c': s.color, '--i': s.delay }">
      <circle :cx="s.x" :cy="s.y" r="27" class="bubble" />
      <text :x="s.x" :y="s.y + 8" class="icon">{{ s.icon }}</text>
      <!-- "Think" sits on top, so its words go above the bubble; the others go below -->
      <text :x="s.x" :y="s.y + (s.deg < 0 ? -52 : 46)" class="label">{{ s.label }}</text>
      <text :x="s.x" :y="s.y + (s.deg < 0 ? -37 : 61)" class="hint">{{ s.hint }}</text>
    </g>
  </svg>
</template>

<style scoped>
/* One trip round the loop; everything is timed off it (and off --speed, like every animation here). */
.loop { --lap: calc(6s / var(--speed, 1)); width: min(460px, 92vw); height: auto; overflow: visible; }
.track { fill: none; stroke: var(--border); stroke-width: 3; stroke-dasharray: 2 9; stroke-linecap: round; }
.runner-orbit { animation: orbit var(--lap) linear infinite; }
.runner { fill: #fff; filter: drop-shadow(0 0 6px var(--accent)) drop-shadow(0 0 12px var(--accent)); }
.mid-small { fill: var(--muted); font-size: 11px; text-anchor: middle; text-transform: uppercase; letter-spacing: 0.12em; }
.mid-big { fill: var(--text); font-size: 17px; font-weight: 800; text-anchor: middle; }

.bubble { fill: color-mix(in srgb, var(--c) 18%, var(--panel)); stroke: color-mix(in srgb, var(--c) 55%, transparent); stroke-width: 2; }
.station .bubble { animation: light var(--lap) ease-in-out infinite; animation-delay: calc(var(--lap) * var(--i) / 3); }
.icon { font-size: 24px; text-anchor: middle; }
.label { fill: var(--text); font-size: 15px; font-weight: 800; text-anchor: middle; }
.hint { fill: var(--muted); font-size: 11.5px; text-anchor: middle; }

.exit { fill: none; stroke: var(--c-assistant); stroke-width: 2; stroke-dasharray: 5 5; opacity: 0.8; animation: dash calc(1.2s / var(--speed, 1)) linear infinite; }
.exit-label { fill: var(--c-assistant); font-size: 11.5px; font-weight: 700; text-anchor: middle; }
.answer rect { fill: color-mix(in srgb, var(--c-assistant) 16%, var(--panel)); stroke: var(--c-assistant); stroke-width: 1.5; }
.answer text { fill: #9ff0c8; font-size: 13px; font-weight: 800; text-anchor: middle; }

@keyframes orbit { to { transform: rotate(360deg); } }
@keyframes light {
  0%, 22% { stroke: var(--c); stroke-width: 3.5; filter: drop-shadow(0 0 10px var(--c)); }
  34%, 100% { stroke-width: 2; filter: none; }
}
@keyframes dash { to { stroke-dashoffset: -10; } }
@media (prefers-reduced-motion: reduce) {
  .runner-orbit, .station .bubble, .exit { animation: none; }
}
</style>
