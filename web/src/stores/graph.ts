import { defineStore } from 'pinia';
import dagre from '@dagrejs/dagre';
import type { Edge, Node } from '@vue-flow/core';
import { useRunStore } from './run';

const SIZE: Record<string, { width: number; height: number }> = {
  agent: { width: 240, height: 112 },
  mcp: { width: 250, height: 150 },
  human: { width: 170, height: 84 },
};

const short = (text = '', max = 38) => {
  const line = text.replace(/[#*_`>|]/g, '').replace(/\s+/g, ' ').trim();
  return line.length > max ? line.slice(0, max - 1) + '…' : line;
};

/** Turns run state into Vue Flow nodes and edges, and lays them out left to right with dagre. */
export const useGraphStore = defineStore('graph', {
  state: () => ({ positions: {} as Record<string, { x: number; y: number }>, layoutKey: '' }),

  getters: {
    /** Which nodes exist, independent of their live status. A change here triggers a re-layout. */
    structure(): Node[] {
      const run = useRunStore();
      const nodes: Node[] = run.agentList.map((a) => ({ id: a.agentId, type: 'agent', position: { x: 0, y: 0 }, data: { agentId: a.agentId } }));
      for (const m of run.mcpServers) nodes.push({ id: `mcp:${m.server}`, type: 'mcp', position: { x: 0, y: 0 }, data: { server: m.server } });
      if (run.humanInvolved) nodes.push({ id: 'human', type: 'human', position: { x: 0, y: 0 }, data: {} });
      return nodes;
    },

    nodes(): Node[] {
      return this.structure.map((n) => ({ ...n, position: this.positions[n.id] ?? { x: 0, y: 0 } }));
    },

    edges(): Edge[] {
      const run = useRunStore();
      const edges: Edge[] = [];
      for (const a of run.agentList) {
        // Coordinator → subagent: the task goes down; when it finishes, the SUMMARY comes back up.
        if (a.parentId) {
          const done = a.status === 'done';
          edges.push({
            id: `${a.parentId}->${a.agentId}`,
            source: a.parentId,
            target: a.agentId,
            animated: !done,
            label: done ? `↩ ${short(a.summary)}` : `task: ${short(a.task)}`,
            class: done ? 'edge-summary' : 'edge-task',
          });
        }
        // Dependency: Activities waits on Weather.
        if (a.waitsOn && run.agents[a.waitsOn]) {
          const waiting = a.status === 'waiting' && !a.turn;
          edges.push({
            id: `${a.waitsOn}~>${a.agentId}`,
            source: a.waitsOn,
            target: a.agentId,
            class: 'edge-waits',
            label: waiting ? `waiting on ${run.agents[a.waitsOn].role}` : 'needs weather',
            animated: waiting,
          });
        }
        // Agent → MCP server: only for agents that actually called it. Lights up during a call.
        if (a.agentId in run.mcpPending) {
          for (const m of run.mcpServers) {
            const active = (run.mcpPending[a.agentId] ?? 0) > 0;
            edges.push({ id: `${a.agentId}->mcp:${m.server}`, source: a.agentId, target: `mcp:${m.server}`, class: active ? 'edge-mcp active' : 'edge-mcp', animated: active });
          }
        }
      }
      // Agent → human: red while an approval is pending.
      if (run.humanInvolved) {
        const asking = run.agentList.find((a) => a.frozen);
        edges.push({
          id: 'planner->human',
          source: run.agentList.find((a) => !a.parentId)?.agentId ?? 'planner',
          target: 'human',
          class: asking ? 'edge-human pending' : 'edge-human',
          animated: Boolean(asking),
          label: asking ? 'approval needed' : run.approvalOutcome ?? '',
        });
      }
      return edges;
    },
  },

  actions: {
    /** Re-runs dagre when nodes or edges are added or removed. Returns true if anything moved. */
    layout(): boolean {
      const key = this.structure.map((n) => n.id).join('|') + '#' + this.edges.map((e) => e.id).join('|');
      if (key === this.layoutKey) return false;
      this.layoutKey = key;

      const g = new dagre.graphlib.Graph();
      g.setGraph({ rankdir: 'LR', nodesep: 24, ranksep: 150 });
      g.setDefaultEdgeLabel(() => ({}));
      for (const n of this.structure) g.setNode(n.id, { ...SIZE[n.type ?? 'agent'] });
      for (const e of this.edges) g.setEdge(e.source, e.target);
      dagre.layout(g);

      const positions: Record<string, { x: number; y: number }> = {};
      for (const n of this.structure) {
        const p = g.node(n.id);
        const s = SIZE[n.type ?? 'agent'];
        positions[n.id] = { x: p.x - s.width / 2, y: p.y - s.height / 2 };
      }
      this.positions = positions;
      return true;
    },
    reset() {
      this.positions = {};
      this.layoutKey = '';
    },
  },
});
