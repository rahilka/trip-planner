<script setup lang="ts">
import { onMounted, ref, watch } from 'vue';
import { useRunStore } from '../stores/run';

const run = useRunStore();
const ACTS: Record<number, string> = {
  1: 'Plain LLM call',
  2: 'Loop + local tool',
  3: 'MCP server',
  4: 'Skills',
  5: 'Subagents',
  6: 'Hooks + human',
};

const recordings = ref<{ file: string }[]>([]);
const selectedRecording = ref('');
const compareWith = ref('');
const openCompare = () =>
  (location.href = `/?compare=${encodeURIComponent(selectedRecording.value)},${encodeURIComponent(compareWith.value)}&speed=${run.speed}`);
async function loadRecordings() {
  try {
    recordings.value = await (await fetch('/api/recordings')).json();
    if (!selectedRecording.value) selectedRecording.value = recordings.value[0]?.file ?? '';
  } catch {
    recordings.value = [];
  }
}
onMounted(loadRecordings);
watch(() => run.running, (running) => !running && loadRecordings());
</script>

<template>
  <header class="actbar">
    <a class="brand" href="/" title="Back to the simple view">Agent <span>Glass Box</span></a>

    <nav class="acts">
      <button
        v-for="(title, n) in ACTS"
        :key="n"
        :class="{ active: run.act === Number(n) }"
        :title="title"
        :disabled="run.running"
        @click="run.act = Number(n)"
      >
        <b>{{ n }}</b> {{ title }}
      </button>
    </nav>

    <input v-model="run.prompt" class="prompt" :disabled="run.running" />

    <div class="controls">
      <button class="primary" :disabled="run.running" @click="run.start()">▶ Run</button>
      <button :disabled="!run.running || !run.stepMode || run.mode !== 'live'" @click="run.step()">⏭ Step</button>
      <select v-model="selectedRecording" :disabled="run.running" title="Saved runs">
        <option v-for="r in recordings" :key="r.file" :value="r.file">{{ r.file.replace('.jsonl', '') }}</option>
      </select>
      <button :disabled="run.running || !selectedRecording" @click="run.replay(selectedRecording)">⏮ Replay</button>
      <select v-model="compareWith" :disabled="run.running" title="Second recording for side-by-side">
        <option value="">compare with…</option>
        <option v-for="r in recordings" :key="r.file" :value="r.file">{{ r.file.replace('.jsonl', '') }}</option>
      </select>
      <button :disabled="!selectedRecording || !compareWith" @click="openCompare">⧉ Side by side</button>
      <span class="sep" />
      <button :disabled="!run.selectedAgent" title="Tool definitions of the selected agent" @click="run.inspector = { kind: 'tools' }">🔧 Tools</button>
      <button title="Closing screen" @click="run.showClosing = true">🎬 Coda</button>
    </div>

    <div class="toggles">
      <label title="Playback and animation speed">
        Speed <input v-model.number="run.speed" type="range" min="0.25" max="4" step="0.25" /> {{ run.speed }}×
      </label>
      <label><input v-model="run.stepMode" type="checkbox" :disabled="run.running" /> Step mode</label>
      <label class="break"><input v-model="run.breakIt" type="checkbox" :disabled="run.running" /> ⚡ Break it</label>
      <label><input v-model="run.promptOnlyBudget" type="checkbox" :disabled="run.running" /> Prompt-only budget</label>
    </div>
  </header>
</template>

<style scoped>
.actbar {
  display: grid;
  grid-template-columns: auto 1fr;
  grid-template-areas: 'brand acts' 'prompt prompt' 'controls toggles';
  gap: 8px 16px;
  padding: 10px 14px;
  background: var(--panel);
  border-bottom: 1px solid var(--border);
}
@media (min-width: 1400px) {
  .actbar { grid-template-columns: auto auto 1fr; grid-template-areas: 'brand acts prompt' 'controls controls toggles'; }
}
.brand { color: var(--text); text-decoration: none; grid-area: brand; font-weight: 700; font-size: 18px; align-self: center; }
.brand span { color: var(--accent); }
.acts { grid-area: acts; display: flex; gap: 6px; flex-wrap: wrap; }
.acts button { padding: 4px 10px; font-size: 13px; }
.acts button b { color: var(--accent); margin-right: 2px; }
.acts button.active { background: var(--accent); color: #0d0f14; border-color: var(--accent); }
.acts button.active b { color: inherit; }
.prompt { grid-area: prompt; width: 100%; font-size: 15px; }
.controls { grid-area: controls; display: flex; gap: 6px; align-items: center; flex-wrap: wrap; }
.sep { width: 1px; height: 22px; background: var(--border); margin: 0 4px; }
.controls select { max-width: 200px; }
.toggles { grid-area: toggles; display: flex; gap: 16px; align-items: center; justify-content: flex-end; color: var(--muted); flex-wrap: wrap; }
.toggles label { display: flex; align-items: center; gap: 6px; }
.break { color: var(--c-wrong); }
</style>
