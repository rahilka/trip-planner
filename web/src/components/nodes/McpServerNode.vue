<script setup lang="ts">
// An MCP server: a separate process. Its tools were DISCOVERED at startup (tools/list), not hard-coded.
import { ref, watch } from 'vue';
import { Handle, Position } from '@vue-flow/core';

const props = defineProps<{
  server: string;
  tools: { name: string; description: string }[];
  /** Increments on every MCP tool call; each tick replays the flash animation. */
  calls: number;
}>();

const flashKey = ref(0);
watch(() => props.calls, () => flashKey.value++);
</script>

<template>
  <div class="mcp-node">
    <Handle type="target" :position="Position.Left" />
    <div v-if="flashKey" :key="flashKey" class="glow" />
    <div class="head">
      <span class="plug">🔌</span>
      <div>
        <div class="name">{{ server }}</div>
        <div class="kind">MCP server · stdio · separate process</div>
      </div>
      <span v-if="calls" class="calls">{{ calls }} calls</span>
    </div>
    <div class="handshake">tools/list →</div>
    <ul class="tools">
      <li v-for="(t, i) in tools" :key="t.name" :style="{ animationDelay: `calc(${i} * 500ms / var(--speed))` }" :title="t.description">
        {{ t.name }}
      </li>
    </ul>
  </div>
</template>

<style scoped>
.mcp-node {
  border: 1px solid var(--c-mcp);
  border-radius: 10px;
  background: color-mix(in srgb, var(--c-mcp) 8%, var(--panel-2));
  padding: 10px 12px;
  width: 250px;
  color: var(--text);
}
.mcp-node { position: relative; }
.glow { position: absolute; inset: -1px; border-radius: 10px; pointer-events: none; animation: flash var(--t-slow) ease-out forwards; }
.head { display: flex; gap: 8px; align-items: center; }
.plug { font-size: 20px; }
.name { font-weight: 700; color: var(--c-mcp); font-size: 15px; }
.kind { font-size: 11px; color: var(--muted); }
.calls { margin-left: auto; font-size: 11px; color: var(--c-mcp); }
.handshake { font-size: 11px; color: var(--muted); margin: 6px 0 2px; font-family: ui-monospace, Consolas, monospace; }
.tools { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 3px; }
.tools li {
  font-family: ui-monospace, Consolas, monospace;
  font-size: 12px;
  padding: 2px 8px;
  border-radius: 4px;
  background: var(--panel);
  border-left: 3px solid var(--c-mcp);
  opacity: 0;
  animation: appear var(--t-med) ease-out forwards;
}
@keyframes appear { from { opacity: 0; transform: translateX(-10px); } to { opacity: 1; transform: none; } }
@keyframes flash { 0% { box-shadow: 0 0 0 0 var(--c-mcp); } 30% { box-shadow: 0 0 18px 2px var(--c-mcp); } 100% { box-shadow: none; } }
</style>
