<script setup lang="ts">
// 🎉 A little celebration when the agent delivers its final answer. Pure CSS, no library.
import { ref, watch } from 'vue';
import { useFlowStore } from '../../stores/flow';

const flow = useFlowStore();
const COLORS = ['#7c8cff', '#3ecf8e', '#f5a524', '#ec6aa8', '#22d3ee', '#9b87f5'];
type Piece = { id: number; left: number; delay: number; color: string; size: number; spin: number; drift: number };
const pieces = ref<Piece[]>([]);
let timer: ReturnType<typeof setTimeout> | undefined;

watch(
  () => flow.celebrate,
  (n) => {
    if (!n) return;
    pieces.value = Array.from({ length: 90 }, (_, i) => ({
      id: n * 1000 + i,
      left: Math.random() * 100,
      delay: Math.random() * 0.6,
      color: COLORS[i % COLORS.length],
      size: 6 + Math.random() * 7,
      spin: Math.random() * 720 - 360,
      drift: Math.random() * 160 - 80,
    }));
    clearTimeout(timer);
    timer = setTimeout(() => (pieces.value = []), 4200);
  },
);
</script>

<template>
  <div v-if="pieces.length" class="confetti" aria-hidden="true">
    <i
      v-for="p in pieces"
      :key="p.id"
      :style="{
        left: p.left + '%',
        width: p.size + 'px',
        height: p.size * 0.45 + 'px',
        background: p.color,
        animationDelay: p.delay + 's',
        '--spin': p.spin + 'deg',
        '--drift': p.drift + 'px',
      }"
    />
  </div>
</template>

<style scoped>
.confetti { position: absolute; inset: 0; overflow: hidden; pointer-events: none; z-index: 8; }
i { position: absolute; top: -20px; border-radius: 2px; animation: fall 3.4s cubic-bezier(0.25, 0.6, 0.4, 1) forwards; }
@keyframes fall {
  to { transform: translate(var(--drift), 110vh) rotate(var(--spin)); opacity: 0.2; }
}
</style>
