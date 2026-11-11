<script setup lang="ts">
import { computed } from 'vue';
import { Handle, Position } from '@vue-flow/core';
import { useRunStore } from '../../stores/run';

const run = useRunStore();
const pending = computed(() => run.agentList.some((a) => a.frozen));
</script>

<template>
  <div :class="['human-node', { pending }]">
    <Handle type="target" :position="Position.Left" />
    <span class="icon">🙋</span>
    <div>
      <div class="name">Human</div>
      <div class="sub">{{ pending ? 'decision needed' : run.approvalOutcome ?? 'approves bookings' }}</div>
    </div>
  </div>
</template>

<style scoped>
.human-node {
  width: 170px;
  display: flex;
  gap: 10px;
  align-items: center;
  padding: 12px;
  border-radius: 40px;
  background: var(--panel-2);
  border: 2px solid var(--border);
  color: var(--text);
}
.human-node.pending { border-color: var(--c-error); animation: alarm calc(900ms / var(--speed)) ease-in-out infinite; }
.icon { font-size: 26px; }
.name { font-weight: 700; }
.sub { font-size: 11px; color: var(--muted); }
.pending .sub { color: var(--c-error); }
@keyframes alarm { 50% { box-shadow: 0 0 20px 3px color-mix(in srgb, var(--c-error) 60%, transparent); } }
</style>
