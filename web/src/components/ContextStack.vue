<script setup lang="ts">
// The context window: every block the model will see on its next call, in order.
import { computed, ref } from 'vue';
import type { Block } from '@glass-box/shared';
import { useContextStore } from '../stores/context';
import { useRunStore } from '../stores/run';

const emit = defineEmits<{ inspect: [block: Block] }>();
const run = useRunStore();
const context = useContextStore();

const current = computed(() => context.byAgent[run.selectedAgentId]);
const blocks = computed(() => current.value?.blocks ?? []);
const total = computed(() => current.value?.totalTokens ?? 0);
const loaded = computed(() => context.justLoaded[run.selectedAgentId]);
const isLoadedStub = (b: Block) => b.kind === 'skill_stub' && loaded.value && b.label.endsWith(loaded.value.skill);

// The real window (1M tokens) dwarfs a trip plan, so the bar can zoom to a demo scale.
// It's always labelled, so nobody leaves thinking the window is 10k.
const ZOOM = 10_000;
const zoomed = ref(true);
const scale = computed(() => (zoomed.value ? ZOOM : current.value?.limit ?? 1_000_000));
const fill = computed(() => Math.min(100, (total.value / scale.value) * 100));

const LABELS: Record<Block['kind'], string> = {
  system: 'System',
  user: 'User',
  assistant: 'Assistant',
  tool_use: 'Tool use',
  tool_result: 'Tool result',
  skill_stub: 'Skill (stub)',
  skill_full: 'Skill (loaded)',
};

/** Taller block = more tokens (square-root scale so small blocks stay visible). */
const height = (b: Block) => (b.kind === 'skill_stub' ? 16 : Math.min(150, 24 + Math.sqrt(b.tokens) * 3));
const preview = (b: Block) => b.content.replace(/\s+/g, ' ').slice(0, 140);
</script>

<template>
  <section class="panel">
    <div class="panel-title">
      Context window
      <span v-if="run.selectedAgent" class="who">{{ run.selectedAgent.role }}</span>
    </div>

    <div class="meter">
      <div class="bar"><div class="fill" :style="{ width: fill + '%' }" /></div>
      <div v-if="loaded" :key="loaded.seq" class="jump">+≈{{ loaded.tokens.toLocaleString() }} tokens · skill loaded</div>
      <div class="meter-text">
        <span>≈ {{ total.toLocaleString() }} tokens</span>
        <button class="scale" :title="'Toggle bar scale'" @click="zoomed = !zoomed">
          bar scale: {{ zoomed ? `zoomed to ${ZOOM.toLocaleString()}` : `real window ${scale.toLocaleString()}` }}
        </button>
      </div>
    </div>

    <TransitionGroup name="block" tag="ol" class="stack">
      <li
        v-for="(b, i) in blocks"
        :key="i + b.kind"
        :class="['block', b.kind, { expanded: b.kind === 'skill_full', loaded: isLoadedStub(b) }]"
        :style="{ height: height(b) + 'px' }"
        :title="b.label"
        @click="emit('inspect', b)"
      >
        <div class="head">
          <span class="kind">{{ LABELS[b.kind] }}</span>
          <span class="label">{{ b.label }}</span>
          <span v-if="isLoadedStub(b)" class="loaded-tag">loaded ↓</span>
          <span class="tokens">≈{{ b.tokens.toLocaleString() }}</span>
        </div>
        <div v-if="b.kind !== 'skill_stub'" class="preview">{{ preview(b) }}</div>
      </li>
    </TransitionGroup>
    <p v-if="!blocks.length" class="empty">Run a prompt to see what the model sees.</p>
  </section>
</template>

<style scoped>
.who { margin-left: auto; color: var(--text); text-transform: none; letter-spacing: 0; }
.meter { padding: 8px 12px; border-bottom: 1px solid var(--border); position: relative; }
.jump { position: absolute; right: 12px; top: -2px; font-size: 12px; font-weight: 700; color: var(--c-skill); animation: jump var(--t-slow) ease-out forwards; animation-duration: calc(3000ms / var(--speed)); pointer-events: none; }
@keyframes jump { 0% { opacity: 0; transform: translateY(8px); } 15% { opacity: 1; transform: none; } 80% { opacity: 1; } 100% { opacity: 0; } }
.loaded-tag { color: var(--c-skill); font-size: 11px; }
.block.loaded { opacity: 0.75; }
.bar { height: 10px; background: var(--panel-2); border-radius: 5px; overflow: hidden; }
.fill { height: 100%; background: linear-gradient(90deg, var(--c-assistant), var(--c-tool_use)); transition: width var(--t-med); min-width: 2px; }
.meter-text { display: flex; justify-content: space-between; align-items: center; margin-top: 4px; font-size: 12px; }
.scale { font-size: 11px; padding: 1px 6px; color: var(--muted); }
.stack { list-style: none; margin: 0; padding: 8px; overflow-y: auto; flex: 1; display: flex; flex-direction: column; gap: 4px; }
.block {
  --c: var(--muted);
  flex-shrink: 0;
  border-left: 4px solid var(--c);
  background: color-mix(in srgb, var(--c) 14%, var(--panel));
  border-radius: 4px;
  padding: 3px 8px;
  cursor: pointer;
  overflow: hidden;
  transition: height var(--t-slow) ease, background var(--t-med);
}
.block:hover { background: color-mix(in srgb, var(--c) 26%, var(--panel)); }
.block.system { --c: var(--c-system); }
.block.user { --c: var(--c-user); }
.block.assistant { --c: var(--c-assistant); }
.block.tool_use { --c: var(--c-tool_use); }
.block.tool_result { --c: var(--c-tool_result); }
.block.skill_stub, .block.skill_full { --c: var(--c-skill); }
.block.skill_stub { padding: 0 8px; font-size: 11px; }
.block.expanded { animation: grow var(--t-slow) ease-out; }
.head { display: flex; gap: 8px; align-items: baseline; font-size: 12px; }
.kind { color: var(--c); font-weight: 700; white-space: nowrap; }
.label { color: var(--text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1; }
.tokens { color: var(--muted); font-family: ui-monospace, Consolas, monospace; }
.preview { font-size: 11px; color: var(--muted); line-height: 1.35; overflow: hidden; }
.empty { color: var(--muted); padding: 12px; }
.block-enter-from { opacity: 0; transform: translateX(30px); }
.block-enter-active { transition: all var(--t-med) ease-out; }
@keyframes grow { from { height: 16px; box-shadow: 0 0 0 0 var(--c-skill); } 40% { box-shadow: 0 0 16px 2px var(--c-skill); } }
</style>
