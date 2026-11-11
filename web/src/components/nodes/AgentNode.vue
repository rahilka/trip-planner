<script setup lang="ts">
import { computed } from 'vue';
import { Handle, Position } from '@vue-flow/core';
import { useContextStore } from '../../stores/context';
import { useRunStore } from '../../stores/run';

const props = defineProps<{ agentId: string }>();
const run = useRunStore();
const context = useContextStore();

const agent = computed(() => run.agents[props.agentId]);
const isRoot = computed(() => !agent.value?.parentId);
const selected = computed(() => run.selectedAgentId === props.agentId);
const active = computed(() => agent.value?.status === 'thinking' || agent.value?.status === 'acting');
const contextTokens = computed(() => context.byAgent[props.agentId]?.totalTokens ?? 0);
const ICON: Record<string, string> = { planner: '🧭', transport: '✈️', weather: '🌦️', stay: '🏨', activities: '🎟️' };
const icon = computed(() => ICON[props.agentId.replace(/-\d+$/, '')] ?? '🤖');
</script>

<template>
  <div v-if="agent" :class="['agent-node', agent.status, { root: isRoot, selected, active }]">
    <Handle type="target" :position="Position.Left" />
    <div class="top">
      <span class="icon">{{ icon }}</span>
      <div class="titles">
        <div class="role">{{ agent.role }}</div>
        <div class="model">{{ agent.model }}</div>
      </div>
      <span v-if="isRoot && agent.agentId === 'planner' && run.agentList.length > 1" class="chip coord">coordinator</span>
    </div>
    <div class="bottom">
      <span class="chip status">{{ agent.status }}</span>
      <span v-if="agent.turn" class="turn">turn {{ agent.turn }}</span>
      <span class="tokens" :title="agent.tokens ? 'tokens billed (in + out, all turns)' : 'current context size'">
        {{ agent.tokens ? `${agent.tokens.toLocaleString()} tok` : `≈${contextTokens.toLocaleString()} ctx` }}
      </span>
    </div>
    <Handle type="source" :position="Position.Right" />
  </div>
</template>

<style scoped>
.agent-node {
  width: 240px;
  min-height: 100px;
  padding: 10px 12px;
  border-radius: 12px;
  background: var(--panel-2);
  border: 1px solid var(--border);
  color: var(--text);
  cursor: pointer;
  transition: border-color var(--t-med), box-shadow var(--t-med);
}
.agent-node.root { border-width: 2px; }
.agent-node.selected { border-color: var(--accent); box-shadow: 0 0 0 2px color-mix(in srgb, var(--accent) 45%, transparent); }
.agent-node.active { animation: pulse var(--t-slow) ease-in-out infinite; }
.agent-node.waiting { border-style: dashed; }
.agent-node.done { opacity: 0.85; }
.top { display: flex; gap: 8px; align-items: center; }
.icon { font-size: 22px; }
.titles { flex: 1; min-width: 0; }
.role { font-weight: 700; font-size: 15px; }
.model { color: var(--muted); font-size: 11px; font-family: ui-monospace, Consolas, monospace; }
.coord { color: var(--accent); font-size: 10px; }
.bottom { display: flex; gap: 8px; align-items: center; margin-top: 10px; font-size: 12px; }
.status { color: var(--muted); }
.thinking .status { color: var(--accent); }
.acting .status { color: var(--c-tool_use); }
.waiting .status { color: var(--c-error); }
.done .status { color: var(--c-assistant); }
.turn { color: var(--muted); }
.tokens { margin-left: auto; color: var(--muted); font-family: ui-monospace, Consolas, monospace; font-size: 11px; }
@keyframes pulse {
  0%, 100% { box-shadow: 0 0 0 0 color-mix(in srgb, var(--accent) 0%, transparent); }
  50% { box-shadow: 0 0 22px 4px color-mix(in srgb, var(--accent) 55%, transparent); }
}
</style>
