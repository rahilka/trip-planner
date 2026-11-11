<script setup lang="ts">
import { computed } from 'vue';
import type { Card } from '../stores/timeline';

const props = defineProps<{ card: Card }>();

const ICONS: Record<Card['kind'], string> = {
  model: '🧠',
  tool_use: '🔧',
  tool_result: '📥',
  hook: '🛡️',
  approval: '🙋',
  error: '⚠️',
};

const body = computed(() => {
  const b = props.card.body;
  if (b === undefined) return '';
  return typeof b === 'string' ? b : JSON.stringify(b, null, 2);
});
</script>

<template>
  <article
    :class="['card', card.kind, card.decision, { error: card.isError && !card.wrongTool, wrong: card.wrongTool, mcp: card.source === 'mcp' }]"
  >
    <header>
      <span class="icon">{{ ICONS[card.kind] }}</span>
      <span class="title">{{ card.title }}</span>
      <span v-if="card.source === 'mcp'" class="chip tag-mcp">MCP</span>
      <span v-if="card.wrongTool" class="chip tag-wrong">bad guess</span>
      <span v-if="card.ms !== undefined" class="ms">{{ card.ms }} ms</span>
    </header>
    <div v-if="card.subtitle" class="subtitle">{{ card.subtitle }}</div>
    <pre v-if="body" class="body">{{ body }}</pre>
  </article>
</template>

<style scoped>
.card {
  --c: var(--muted);
  width: 240px;
  flex-shrink: 0;
  max-height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--panel-2);
  border: 1px solid var(--border);
  border-top: 3px solid var(--c);
  border-radius: 8px;
  padding: 6px 8px;
  animation: enter var(--t-med) ease-out;
}
.card.model { --c: var(--c-assistant); }
.card.tool_use { --c: var(--c-tool_use); }
.card.tool_result { --c: var(--c-tool_result); }
.card.hook { --c: var(--c-hook); }
.card.hook.block { --c: var(--c-error); }
.card.hook.ask { --c: var(--c-tool_use); }
.card.approval { --c: var(--c-assistant); }
.card.wrong { --c: var(--c-wrong); background: color-mix(in srgb, var(--c-wrong) 14%, var(--panel-2)); }
.card.error { --c: var(--c-error); background: color-mix(in srgb, var(--c-error) 14%, var(--panel-2)); }
header { display: flex; gap: 6px; align-items: center; font-weight: 600; font-size: 13px; }
.title { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1; }
.ms { color: var(--muted); font-size: 11px; font-weight: 400; }
.tag-mcp { color: var(--c-mcp); }
.tag-wrong { color: var(--c-wrong); }
.subtitle { color: var(--muted); font-size: 11px; margin-top: 2px; }
.body { margin: 4px 0 0; font-size: 11px; line-height: 1.35; white-space: pre-wrap; word-break: break-word; overflow-y: auto; color: #c9cede; min-height: 0; }
@keyframes enter { from { opacity: 0; transform: translateY(12px) scale(0.97); } }
</style>
