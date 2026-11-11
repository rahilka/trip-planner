import { defineStore } from 'pinia';
import type { StreamedEvent } from '@glass-box/shared';

export type CardKind = 'model' | 'tool_use' | 'tool_result' | 'hook' | 'approval' | 'error';

export type Card = {
  id: string;
  agentId: string;
  kind: CardKind;
  title: string;
  subtitle?: string;
  body?: unknown;
  source?: 'local' | 'mcp';
  isError?: boolean;
  /** Break-it mode: the model reached for a tool that doesn't fit the job. */
  wrongTool?: boolean;
  decision?: 'allow' | 'block' | 'ask';
  ms?: number;
  toolUseId?: string;
  seq: number;
};

/** One card per interesting event, grouped into one lane per agent. */
export const useTimelineStore = defineStore('timeline', {
  state: () => ({ cards: [] as Card[], lanes: [] as string[], breakIt: false }),
  getters: {
    cardsFor: (state) => (agentId: string) => state.cards.filter((c) => c.agentId === agentId),
  },
  actions: {
    reset() {
      this.cards = [];
      this.lanes = [];
      this.breakIt = false;
    },
    add(card: Card) {
      if (!this.lanes.includes(card.agentId)) this.lanes.push(card.agentId);
      this.cards.push(card);
    },
    ingest(e: StreamedEvent) {
      const id = `${e.runId}-${e.seq}`;
      switch (e.type) {
        case 'run_started':
          this.breakIt = Boolean(e.flags.breakIt);
          return;
        case 'model_call':
          return this.add({ id, seq: e.seq, agentId: e.agentId, kind: 'model', title: `Model call · turn ${e.turn}`, subtitle: `≈ ${e.inputTokens.toLocaleString()} tokens in` });
        case 'model_response': {
          // Fill in the matching model card instead of adding a second one.
          const card = [...this.cards].reverse().find((c) => c.agentId === e.agentId && c.kind === 'model');
          if (card) {
            card.subtitle = `${card.subtitle} · ${e.outputTokens.toLocaleString()} out · ${e.stopReason}`;
            card.body = e.text || undefined;
          }
          return;
        }
        case 'tool_use':
          return this.add({ id, seq: e.seq, agentId: e.agentId, kind: 'tool_use', title: e.tool, subtitle: 'input', body: e.input, source: e.source, toolUseId: e.toolUseId });
        case 'tool_result':
          return this.add({ id, seq: e.seq, agentId: e.agentId, kind: 'tool_result', title: e.tool, subtitle: e.isError ? 'error' : 'result', body: e.output, isError: e.isError, ms: e.ms, toolUseId: e.toolUseId,
            // With vague descriptions, a failed call is (almost always) the model guessing wrong.
            wrongTool: this.breakIt && e.isError });
        case 'hook_decision':
          return this.add({ id, seq: e.seq, agentId: e.agentId, kind: 'hook', title: `PreToolUse · ${e.tool}`, subtitle: e.decision, body: e.reason, decision: e.decision, toolUseId: e.toolUseId });
        case 'approval_resolved': {
          const hook = this.cards.find((c) => c.kind === 'hook' && c.toolUseId === e.toolUseId);
          return this.add({ id, seq: e.seq, agentId: hook?.agentId ?? 'human', kind: 'approval', title: e.approved ? 'Human approved' : 'Human declined', isError: !e.approved });
        }
        case 'error':
          return this.add({ id, seq: e.seq, agentId: this.lanes[0] ?? 'run', kind: 'error', title: 'Error', body: e.message, isError: true });
      }
    },
  },
});
