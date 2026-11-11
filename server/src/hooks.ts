// Hooks: code that runs BEFORE a tool executes and can allow, block, or ask a human.
// Unlike a rule in the prompt, the model cannot talk its way past a hook.

export type HookDecision = { decision: 'allow' | 'block' | 'ask'; reason: string };
export type PreToolUseHook = (agentId: string, tool: string, input: any) => HookDecision | undefined;

/**
 * Act 6 rule for book_trip, enforced in CODE:
 *   over budget → block (the model can't argue with an if-statement)
 *   otherwise   → ask a human before spending money
 */
export const budgetHook =
  (budgetEur: number): PreToolUseHook =>
  (_agentId, tool, input) => {
    if (tool !== 'book_trip') return undefined;
    const total = Number(input?.total_eur);
    if (!(total <= budgetEur)) return { decision: 'block', reason: `Total €${total} is over the €${budgetEur} budget.` };
    return { decision: 'ask', reason: `Booking spends €${total} of the €${budgetEur} budget. A human must approve.` };
  };

/** Pulls "€700" / "700 EUR" out of the prompt. */
export function budgetFromPrompt(prompt: string, fallback = 700): number {
  const match = prompt.match(/€\s?(\d[\d,.]*)|(\d[\d,.]*)\s?(?:€|eur|euro)/i);
  const value = Number((match?.[1] ?? match?.[2] ?? '').replace(/[,.]/g, ''));
  return value > 0 ? value : fallback;
}

export class HookRegistry {
  private preToolUse: PreToolUseHook[] = [];

  onPreToolUse(hook: PreToolUseHook) {
    this.preToolUse.push(hook);
    return this;
  }

  /** First hook with an opinion wins. `undefined` means no hook cared: the tool just runs. */
  runPreToolUse(agentId: string, tool: string, input: unknown): HookDecision | undefined {
    for (const hook of this.preToolUse) {
      const result = hook(agentId, tool, input);
      if (result) return result;
    }
    return undefined;
  }
}
