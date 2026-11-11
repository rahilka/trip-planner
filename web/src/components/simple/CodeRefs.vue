<script setup lang="ts">
// "📂 Where is this in the code?": a few hand-picked spots, each with a one-line why.
// The code itself stays folded until you ask for it, so the panel never turns into a wall of file names.
import { reactive, watch } from 'vue';

type Spot = { key: string; title: string; why: string; file: string; line: number; snippet: string; absolutePath: string };

const props = defineProps<{ keys: string[]; compact?: boolean }>();
const spots = reactive<Record<string, Spot | null>>({});
const open = reactive<Record<string, boolean>>({});

// Spots rarely change while the page is open: fetch each one once.
const cache = new Map<string, Promise<Spot | null>>();
const load = (key: string) => {
  if (!cache.has(key)) cache.set(key, fetch(`/api/code/${key}`).then((r) => (r.ok ? r.json() : null)).catch(() => null));
  return cache.get(key)!;
};
watch(
  () => props.keys.join(),
  () => props.keys.forEach(async (key) => (spots[key] = await load(key))),
  { immediate: true },
);

/** Opens the file at that line in VS Code (works on the presenter's machine). */
const vscodeLink = (s: Spot) => `vscode://file/${s.absolutePath.replace(/\\/g, '/')}:${s.line}`;
const numbered = (s: Spot) => s.snippet.split('\n').map((text, i) => ({ n: s.line + i, text }));
</script>

<template>
  <div :class="['refs', { compact }]">
    <template v-for="key in keys" :key="key">
      <div v-if="spots[key]" class="ref">
        <button class="ref-head" :aria-expanded="Boolean(open[key])" @click="open[key] = !open[key]">
          <span class="title">{{ spots[key]!.title }}</span>
          <code class="where">{{ spots[key]!.file.split('/').pop() }}:{{ spots[key]!.line }}</code>
          <span class="chev">{{ open[key] ? '▾' : '▸' }}</span>
        </button>
        <p class="why">{{ spots[key]!.why }}</p>
        <div v-if="open[key]" class="code">
          <div class="path">
            <span>{{ spots[key]!.file }}</span>
            <a :href="vscodeLink(spots[key]!)" title="Open this line in VS Code">Open in VS Code ↗</a>
          </div>
          <pre><code><span v-for="l in numbered(spots[key]!)" :key="l.n" class="line"><i>{{ l.n }}</i>{{ l.text }}
</span></code></pre>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.refs { display: flex; flex-direction: column; gap: 6px; }
.ref { border-radius: 10px; background: var(--panel-2); border: 1px solid var(--border); overflow: hidden; }
.ref-head {
  display: flex; align-items: center; gap: 8px; width: 100%; padding: 7px 10px; border: none; border-radius: 0;
  background: transparent; text-align: left; cursor: pointer;
}
.ref-head:hover { background: color-mix(in srgb, var(--accent) 10%, transparent); }
.title { font-weight: 700; font-size: 13px; flex: 1; }
.where {
  font-size: 11px; padding: 1px 7px; border-radius: 999px; white-space: nowrap;
  color: #c7d0ff; background: color-mix(in srgb, var(--accent) 16%, var(--panel)); border: 1px solid color-mix(in srgb, var(--accent) 45%, transparent);
}
.chev { color: var(--muted); }
.why { margin: 0; padding: 0 10px 8px; font-size: 12px; line-height: 1.45; color: #c9cede; }
.compact .why { font-size: 11.5px; }
.code { border-top: 1px solid var(--border); background: #0d0f16; }
.path { display: flex; justify-content: space-between; gap: 8px; padding: 5px 10px; font-size: 11px; color: var(--muted); font-family: ui-monospace, Consolas, monospace; }
.path a { color: var(--accent); text-decoration: none; white-space: nowrap; font-family: inherit; }
.path a:hover { text-decoration: underline; }
pre { margin: 0; padding: 4px 0 8px; font-size: 11.5px; line-height: 1.5; overflow-x: auto; color: #d6dbea; background: transparent; border-radius: 0; }
.line { display: block; padding-right: 10px; white-space: pre; }
.line i { display: inline-block; width: 34px; padding-right: 10px; text-align: right; color: #5b6176; font-style: normal; user-select: none; }
</style>
