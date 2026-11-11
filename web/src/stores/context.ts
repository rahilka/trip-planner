import { defineStore } from 'pinia';
import type { Block, StreamedEvent } from '@glass-box/shared';

export type AgentContext = { blocks: Block[]; totalTokens: number; limit: number };

/** The latest context window of every agent. Each agent has its OWN, which is the point. */
export const useContextStore = defineStore('context', {
  state: () => ({
    byAgent: {} as Record<string, AgentContext>,
    /** Skills that were just loaded, so the stack can play the "expand" animation. */
    justLoaded: {} as Record<string, { skill: string; tokens: number; seq: number }>,
  }),
  actions: {
    reset() {
      this.byAgent = {};
      this.justLoaded = {};
    },
    ingest(e: StreamedEvent) {
      if (e.type === 'context_snapshot') {
        this.byAgent[e.agentId] = { blocks: e.blocks, totalTokens: e.totalTokens, limit: e.limit };
      } else if (e.type === 'skill_loaded') {
        this.justLoaded[e.agentId] = { skill: e.skill, tokens: e.tokens, seq: e.seq };
      }
    },
  },
});
