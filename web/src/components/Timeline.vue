<script setup lang="ts">
// Everything that happened, in order. One horizontal lane per agent, so parallel work is visible.
import { nextTick, ref, watch } from 'vue';
import { useRunStore } from '../stores/run';
import { useTimelineStore } from '../stores/timeline';
import ToolCard from './ToolCard.vue';

const run = useRunStore();
const timeline = useTimelineStore();
const laneEls = ref<Record<string, HTMLElement>>({});

// Keep the newest card in view in each lane.
watch(
  () => timeline.cards.length,
  async () => {
    await nextTick();
    for (const el of Object.values(laneEls.value)) el?.scrollTo({ left: el.scrollWidth, behavior: 'smooth' });
  },
);

const roleOf = (agentId: string) => run.agents[agentId]?.role ?? agentId;
</script>

<template>
  <section class="panel">
    <div class="panel-title">
      Timeline
      <span class="hint">{{ timeline.cards.length }} events</span>
    </div>
    <div class="lanes">
      <div
        v-for="lane in timeline.lanes"
        :key="lane"
        :class="['lane', { selected: lane === run.selectedAgentId }]"
        @click="run.agents[lane] && (run.selectedAgentId = lane)"
      >
        <div class="lane-label">{{ roleOf(lane) }}</div>
        <div :ref="(el) => el && (laneEls[lane] = el as HTMLElement)" class="cards">
          <ToolCard v-for="card in timeline.cardsFor(lane)" :key="card.id" :card="card" />
        </div>
      </div>
      <p v-if="!timeline.lanes.length" class="empty">Model calls, tool calls and results will appear here.</p>
    </div>
  </section>
</template>

<style scoped>
.hint { margin-left: auto; text-transform: none; letter-spacing: 0; }
.lanes { flex: 1; display: flex; flex-direction: column; gap: 6px; padding: 6px; overflow-y: auto; min-height: 0; }
.lane { display: flex; gap: 8px; min-height: 120px; flex: 1; border-radius: 8px; padding: 4px; border: 1px solid transparent; cursor: pointer; }
.lane.selected { border-color: var(--border); background: color-mix(in srgb, var(--accent) 5%, transparent); }
.lane-label { writing-mode: vertical-rl; transform: rotate(180deg); font-size: 11px; color: var(--muted); text-align: center; letter-spacing: 0.05em; }
.cards { display: flex; gap: 8px; overflow-x: auto; flex: 1; align-items: stretch; padding-bottom: 4px; }
.empty { color: var(--muted); padding: 8px; }
</style>
