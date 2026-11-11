<script setup lang="ts">
// The system at a glance: agents, the MCP server, the human. Click a node to look inside that agent.
import { nextTick, watch } from 'vue';
import { VueFlow, useVueFlow, type NodeMouseEvent } from '@vue-flow/core';
import { Background } from '@vue-flow/background';
import { Controls } from '@vue-flow/controls';
import '@vue-flow/core/dist/style.css';
import '@vue-flow/controls/dist/style.css';
import { useGraphStore } from '../stores/graph';
import { useRunStore } from '../stores/run';
import AgentNode from './nodes/AgentNode.vue';
import HumanNode from './nodes/HumanNode.vue';
import McpServerNode from './nodes/McpServerNode.vue';

const run = useRunStore();
const graph = useGraphStore();
const { fitView } = useVueFlow('agents');

// Re-layout whenever a node or edge is added, then glide the camera to fit everything.
watch(
  () => [graph.structure.length, graph.edges.length],
  async () => {
    if (!graph.layout()) return;
    await nextTick();
    await fitView({ padding: 0.18, duration: 700 / run.speed, maxZoom: 1.1 });
  },
);

function onNodeClick({ node }: NodeMouseEvent) {
  if (node.type === 'agent') run.selectedAgentId = node.id;
}
</script>

<template>
  <section class="panel">
    <div class="panel-title">
      Agents
      <span class="hint">click an agent to see its loop and context</span>
    </div>
    <div class="flow">
      <VueFlow
        id="agents"
        :nodes="graph.nodes"
        :edges="graph.edges"
        :nodes-draggable="false"
        :nodes-connectable="false"
        :min-zoom="0.2"
        :max-zoom="1.5"
        @node-click="onNodeClick"
      >
        <Background pattern-color="#2a2f42" :gap="22" />
        <Controls position="bottom-left" :show-interactive="false" />
        <template #node-agent="{ data }">
          <AgentNode :agent-id="data.agentId" />
        </template>
        <template #node-mcp="{ data }">
          <McpServerNode
            :server="data.server"
            :tools="run.mcpServers.find((m) => m.server === data.server)?.tools ?? []"
            :calls="run.mcpCalls"
          />
        </template>
        <template #node-human>
          <HumanNode />
        </template>
      </VueFlow>
      <p v-if="!graph.structure.length" class="empty">Press ▶ Run to start an agent.</p>
    </div>
  </section>
</template>

<style scoped>
.hint { margin-left: auto; text-transform: none; letter-spacing: 0; }
.flow { flex: 1; position: relative; min-height: 0; }
.empty { position: absolute; inset: 0; display: grid; place-items: center; color: var(--muted); margin: 0; pointer-events: none; }
</style>

<style>
/* Vue Flow theming (global: the edge elements live inside the library's SVG). */
.vue-flow__node { padding: 0; border: none; background: transparent; }
.vue-flow__handle { width: 6px; height: 6px; background: var(--border); border: none; }
.vue-flow__edge-path { stroke: var(--muted); stroke-width: 2; }
.vue-flow__edge-text { fill: var(--text); font-size: 11px; }
.vue-flow__edge-textbg { fill: var(--panel); }
.vue-flow__edge.edge-task .vue-flow__edge-path { stroke: var(--accent); }
.vue-flow__edge.edge-summary .vue-flow__edge-path { stroke: var(--c-assistant); }
.vue-flow__edge.edge-summary .vue-flow__edge-text { fill: var(--c-assistant); }
.vue-flow__edge.edge-waits .vue-flow__edge-path { stroke: var(--c-tool_use); stroke-dasharray: 6 6; }
.vue-flow__edge.edge-waits .vue-flow__edge-text { fill: var(--c-tool_use); }
.vue-flow__edge.edge-mcp .vue-flow__edge-path { stroke: color-mix(in srgb, var(--c-mcp) 35%, transparent); }
.vue-flow__edge.edge-mcp.active .vue-flow__edge-path { stroke: var(--c-mcp); stroke-width: 3; filter: drop-shadow(0 0 4px var(--c-mcp)); }
.vue-flow__edge.edge-human .vue-flow__edge-path { stroke: var(--border); }
.vue-flow__edge.edge-human.pending .vue-flow__edge-path { stroke: var(--c-error); stroke-width: 3; }
.vue-flow__edge.edge-human .vue-flow__edge-text { fill: var(--c-error); }
.vue-flow__controls { box-shadow: none; }
.vue-flow__controls-button { background: var(--panel-2); border-color: var(--border); fill: var(--text); }
</style>
