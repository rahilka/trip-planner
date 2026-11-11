<script setup lang="ts">
// One fold-out section of the side panel. It glows while its concept is "in action".
import { ref, watch } from 'vue';
import { openLearn } from '../../learn';

const props = defineProps<{ icon: string; title: string; badge?: string; hint: string; active?: boolean; activeLabel?: string; color: string; open?: boolean; learn?: string }>();
// Starts open or closed as the parent suggests (the current act's new concept is open); a click toggles it.
const open = ref(props.open);
watch(() => props.open, (value) => (open.value = value));
</script>

<template>
  <section :class="['section', { active }]" :style="{ '--c': color }">
    <button class="head" :aria-expanded="open" @click="open = !open">
      <span class="icon">{{ icon }}</span>
      <span class="title">{{ title }}</span>
      <span v-if="badge" class="badge">{{ badge }}</span>
      <span v-if="active" class="live">● {{ activeLabel ?? 'live' }}</span>
      <span class="chev">{{ open ? '▾' : '▸' }}</span>
    </button>
    <div v-if="open" class="body">
      <p class="hint">
        {{ hint }}
        <button v-if="learn" class="ask" @click="openLearn(learn)">❓ Think of it like…</button>
      </p>
      <slot />
    </div>
  </section>
</template>

<style scoped>
.section {
  /* Never squash a section to fit: the list around it scrolls instead. */
  flex-shrink: 0;
  border-radius: 14px;
  background: var(--panel-2);
  border: 1px solid var(--border);
  overflow: hidden;
  transition: border-color 0.3s, box-shadow 0.3s;
  animation: slide-in 0.35s ease-out both;
}
.section.active { border-color: var(--c); box-shadow: 0 0 18px color-mix(in srgb, var(--c) 45%, transparent); }
.head {
  display: flex;
  gap: 8px;
  align-items: center;
  width: 100%;
  border: none;
  border-radius: 0;
  padding: 9px 11px;
  background: linear-gradient(90deg, color-mix(in srgb, var(--c) 24%, transparent), transparent);
  font-weight: 800;
  font-size: 13.5px;
  text-align: left;
}
.icon { font-size: 16px; }
.badge { font-weight: 500; font-size: 11.5px; color: var(--muted); }
.live { font-size: 10.5px; font-weight: 700; color: var(--c); animation: blink 1.2s infinite; }
.chev { margin-left: auto; color: var(--muted); }
.body { padding: 2px 10px 10px; }
.ask { display: inline-block; margin-left: 4px; padding: 1px 8px; border-radius: 999px; font-size: 11px; font-weight: 700; color: var(--c); background: transparent; border: 1px solid color-mix(in srgb, var(--c) 55%, transparent); }
.ask:hover { background: color-mix(in srgb, var(--c) 18%, transparent); }
.hint { font-size: 11.5px; color: var(--muted); margin: 6px 2px 8px; line-height: 1.4; }
@keyframes slide-in { from { opacity: 0; transform: translateX(16px); } }
@keyframes blink { 50% { opacity: 0.35; } }
</style>
