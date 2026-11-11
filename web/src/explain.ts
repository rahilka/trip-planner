// Plain-language explanations shown under each box in the flowchart (the "ℹ" lines).
// All the wording lives here, so it's easy to edit for your audience.

const firstSentence = (text: string) => (text.match(/^[^.!?]*[.!?]?/)?.[0] ?? text).trim();

export const explain = {
  prompt(act: number) {
    if (act === 1) return 'Your words go to the model together with short instructions (the system prompt). No tools are attached.';
    return 'Your words go to the model together with the agent’s instructions (the system prompt) and the list of tools it may use.';
  },

  agent(act: number, toolCount: number) {
    if (act === 1) return 'With no tools this is just ONE model call: it can only answer from what it learned in training.';
    if (act >= 5) return 'An agent = model + instructions + tools, in a loop. This one is a coordinator: it plans and delegates, it never searches itself.';
    return `An agent = model + instructions + ${toolCount} tool${toolCount === 1 ? '' : 's'}, running in a loop: think → act → observe, until it decides it’s done.`;
  },

  subagent() {
    return 'A specialist with its own instructions, its own tools and a fresh, empty memory. It only knows the task it was given.';
  },

  thinking() {
    return 'The model reads everything so far (instructions, your prompt, earlier results) and decides the next step.';
  },

  decided(stopReason: string, act: number, toolCount: number) {
    if (stopReason === 'tool_use') return 'It needs information it doesn’t have, so it asks for tools (stop_reason: tool_use). The loop goes around again.';
    if (stopReason === 'end_turn' && act === 1) return 'No tools to call, so it answers right away from memory: the prices and weather are educated guesses.';
    if (stopReason === 'end_turn') return toolCount ? 'It has what it needs, so it writes the answer (stop_reason: end_turn). The loop ends.' : 'It answers directly (stop_reason: end_turn).';
    if (stopReason === 'max_tokens') return 'It ran out of output space (max_tokens) before finishing.';
    return `The model stopped (${stopReason}).`;
  },

  tool(realName: string, description: string | undefined, source: 'local' | 'mcp') {
    if (realName === 'delegate_task') return 'The coordinator doesn’t do this work itself: it writes a complete, self-contained task for a specialist.';
    if (realName === 'load_skill') return 'Its instructions only had the skill’s one-line description. It judged the skill relevant, so it now loads the full playbook.';
    if (realName === 'submit_trip_plan' || realName === 'submit_itinerary') return 'Structured output: the plan must match a strict JSON schema, so the app can trust and display it.';
    if (realName === 'book_trip') return 'This spends money, so before it runs, OUR CODE (a hook) checks it, not the model.';
    if (!description || description === 'Gets data.') return 'The description only says “Gets data.”, so the model had to guess from the name and parameters.';
    const from = source === 'mcp' ? ' (from the MCP server)' : '';
    return `Chosen because its description${from} says: “${firstSentence(description)}”`;
  },

  result(isError: boolean, realName: string) {
    if (isError && realName === 'book_trip') return 'It did not run. The reason goes back to the model as a message.';
    if (isError) return 'It failed. The error text goes back to the model as information, and the model decides how to recover.';
    return 'The result is added to the conversation. The model reads it on its next turn.';
  },

  hook(decision: string) {
    if (decision === 'block') return 'Blocked by code: the total is over budget. No prompt or argument from the model can change that.';
    if (decision === 'ask') return 'The hook asks YOU. The agent loop is paused until you approve or deny.';
    return 'The hook allowed it.';
  },

  stopped() {
    return 'Our code is always in charge of the loop: it cancels the request in flight and starts no new turn. Every real agent needs this off switch.';
  },

  report() {
    return 'Only this short report goes back. The subagent’s tool calls and results stay in its own context.';
  },

  answer(act: number) {
    if (act === 1) return 'One call, one answer. Nothing was checked against real data.';
    return 'No more tools requested, so the loop ends here.';
  },
};
