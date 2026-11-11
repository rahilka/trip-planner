<script setup lang="ts">
// Side by side: two recordings replayed at once, e.g. "budget rule in the prompt" vs "budget rule in a hook".
// Each side is the full app in an iframe, so each gets its own independent stores.
import { computed, ref } from 'vue';

const props = defineProps<{ files: string[]; speed: number }>();
const nonce = ref(0); // bump to restart both replays together
const src = (file: string) => `/?replay=${encodeURIComponent(file)}&speed=${props.speed}&embed=1&n=${nonce.value}`;
const label = (file: string) => file.replace('.jsonl', '');
const pair = computed(() => props.files.slice(0, 2));
</script>

<template>
  <div class="compare">
    <header>
      <b>Side by side</b>
      <span v-for="f in pair" :key="f" class="chip">{{ label(f) }}</span>
      <button @click="nonce++">⏮ Restart both</button>
      <a href="/">✕ Exit</a>
    </header>
    <div class="panes">
      <iframe v-for="f in pair" :key="f + nonce" :src="src(f)" :title="label(f)" />
    </div>
  </div>
</template>

<style scoped>
.compare { height: 100vh; display: flex; flex-direction: column; }
header { display: flex; gap: 10px; align-items: center; padding: 8px 14px; border-bottom: 1px solid var(--border); background: var(--panel); flex-wrap: wrap; }
header a { color: var(--muted); margin-left: auto; }
.chip { color: var(--accent); }
.panes { flex: 1; display: grid; grid-template-columns: 1fr 1fr; gap: 6px; padding: 6px; min-height: 0; }
@media (max-width: 900px) { .panes { grid-template-columns: 1fr; } }
iframe { width: 100%; height: 100%; border: 1px solid var(--border); border-radius: 8px; background: var(--bg); }
</style>
