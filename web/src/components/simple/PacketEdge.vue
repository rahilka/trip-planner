<script setup lang="ts">
// An arrow that shows information moving: while it's "active", glowing packets travel along it.
//   call     (orange) brain → tool: "please run this"
//   result   (teal)   tool → brain: "here is what I found"
//   delegate (purple) agent → agent: "here is a task for you"
import { computed } from 'vue';
import { BaseEdge, getSmoothStepPath, Position } from '@vue-flow/core';
import type { EdgeKind } from '../../stores/flow';

defineOptions({ inheritAttrs: false }); // Vue Flow passes many edge attributes we don't use

const props = defineProps<{
  id: string;
  sourceX: number;
  sourceY: number;
  targetX: number;
  targetY: number;
  sourcePosition: Position;
  targetPosition: Position;
  data: { kind: EdgeKind; active: boolean };
  markerEnd?: string;
}>();

const path = computed(
  () =>
    getSmoothStepPath({
      sourceX: props.sourceX,
      sourceY: props.sourceY,
      sourcePosition: props.sourcePosition,
      targetX: props.targetX,
      targetY: props.targetY,
      targetPosition: props.targetPosition,
      borderRadius: 16,
    })[0],
);
</script>

<template>
  <BaseEdge :id="id" :path="path" :marker-end="markerEnd" :class="['packet-edge', data.kind, { active: data.active }]" />
  <g v-if="data.active" :class="['packets', data.kind]">
    <circle v-for="i in 3" :key="i" r="5.5">
      <animateMotion :path="path" dur="1.6s" :begin="`${(i - 1) * 0.53}s`" repeatCount="indefinite" />
    </circle>
  </g>
</template>

<style>
.packet-edge { stroke: #4a5170 !important; stroke-width: 2.5 !important; transition: stroke 0.4s; }
.packet-edge.active.call { stroke: color-mix(in srgb, var(--c-tool_use) 70%, transparent) !important; }
.packet-edge.active.result { stroke: color-mix(in srgb, var(--c-tool_result) 70%, transparent) !important; }
.packet-edge.active.delegate { stroke: color-mix(in srgb, var(--accent) 80%, transparent) !important; stroke-dasharray: 8 6; }
.packets circle { filter: drop-shadow(0 0 6px currentColor); fill: currentColor; }
.packets.call { color: var(--c-tool_use); }
.packets.result { color: var(--c-tool_result); }
.packets.delegate { color: var(--accent); }
.packets.flow { color: var(--muted); }
</style>
