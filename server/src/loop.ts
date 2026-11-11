import Anthropic from '@anthropic-ai/sdk';
import type { StopReason } from '@glass-box/shared';
import { config } from './config.ts';
import { toBlocks } from './context.ts';
import type { AgentConfig, AgentTool, RunContext } from './types.ts';

const anthropic = new Anthropic(); // reads ANTHROPIC_API_KEY from the environment

/**
 * THE AGENT LOOP. Every agent in this app, coordinator and subagents alike, is this function.
 *
 *   Think   → ask the model what to do next
 *   Act     → run the tools it asked for
 *   Observe → hand the results back, and go around again
 *
 * It stops when the model answers without asking for a tool (stop_reason "end_turn").
 */
export async function runAgent(agent: AgentConfig, messages: Anthropic.MessageParam[], run: RunContext) {
  const { agentId, model, system, tools } = agent;
  const snapshot = () => {
    const blocks = toBlocks(system, messages);
    const totalTokens = blocks.reduce((sum, b) => sum + b.tokens, 0);
    run.emit({ type: 'context_snapshot', agentId, blocks, totalTokens, limit: config.contextWindow });
    return totalTokens;
  };

  const toolDefs = tools.map((t) => ({ ...t.definition, description: t.definition.description ?? '', source: t.source }));
  run.emit({ type: 'agent_started', agentId, parentId: agent.parentId, role: agent.role, model, task: agent.task, waitsOn: agent.waitsOn, parentToolUseId: agent.parentToolUseId, tools: toolDefs });
  await agent.ready; // a dependency, e.g. Activities waits for Weather's report
  let contextTokens = snapshot();
  let tokensUsed = 0;

  for (let turn = 1; turn <= config.maxTurns; turn++) {
    await run.gate(); // step mode: pause here until the presenter clicks "Step"

    // THINK: the model sees the system prompt, the tool definitions and the messages. Nothing else.
    run.emit({ type: 'model_call', agentId, turn, inputTokens: contextTokens });
    const response = await anthropic.messages.create({
      model,
      max_tokens: 16000,
      thinking: { type: 'adaptive', display: 'summarized' }, // return a readable summary of its reasoning
      system: system.map((part) => ({ type: 'text' as const, text: part.text })),
      tools: tools.length ? tools.map((tool) => tool.definition) : undefined, // Act 1: no tools at all
      messages,
    }, { signal: run.signal }); // the Stop button cancels this request mid-flight
    tokensUsed += response.usage.input_tokens + response.usage.output_tokens;
    messages.push({ role: 'assistant', content: response.content });

    const text = response.content.flatMap((b) => (b.type === 'text' ? [b.text] : [])).join('\n');
    const thinking = response.content.flatMap((b) => (b.type === 'thinking' ? [b.thinking] : [])).join('\n').trim();
    run.emit({ type: 'model_response', agentId, turn, stopReason: toStopReason(response.stop_reason), text, thinking, outputTokens: response.usage.output_tokens });
    snapshot();

    // No tool requested → the agent is done. This is the ONLY normal way out of the loop.
    if (response.stop_reason !== 'tool_use') {
      run.emit({ type: 'agent_finished', agentId, summary: text, totalTokens: tokensUsed });
      return text;
    }

    // ACT: run every requested tool. Several tool calls in one response run in parallel.
    const toolUses = response.content.filter((b): b is Anthropic.ToolUseBlock => b.type === 'tool_use');
    const results = await Promise.all(toolUses.map((use) => callTool(use, agent, run)));

    // OBSERVE: all results go back together in a single user message.
    messages.push({ role: 'user', content: results });
    contextTokens = snapshot();
  }

  const summary = `Stopped after ${config.maxTurns} turns (safety limit).`;
  run.emit({ type: 'agent_finished', agentId, summary, totalTokens: tokensUsed });
  return summary;
}

/** Runs one tool call: hooks first, then the tool itself. Errors become results, never crashes. */
async function callTool(use: Anthropic.ToolUseBlock, agent: AgentConfig, run: RunContext): Promise<Anthropic.ToolResultBlockParam> {
  const { agentId } = agent;
  const tool: AgentTool | undefined = agent.tools.find((t) => t.definition.name === use.name);
  const name = tool?.realName ?? use.name; // break-it mode hides real names from the model, not from us
  const shown = tool?.realName ? `${use.name} = ${name}` : name;
  run.emit({ type: 'tool_use', agentId, toolUseId: use.id, tool: shown, source: tool?.source ?? 'local', input: use.input });
  const started = Date.now();
  const finish = (output: unknown, isError: boolean): Anthropic.ToolResultBlockParam => {
    run.emit({ type: 'tool_result', agentId, toolUseId: use.id, tool: shown, output, isError, ms: Date.now() - started });
    const content = typeof output === 'string' ? output : JSON.stringify(output);
    return { type: 'tool_result', tool_use_id: use.id, content, is_error: isError };
  };

  // HOOKS: our code gets a veto before the tool runs. The model cannot skip this.
  const hook = run.hooks.runPreToolUse(agentId, name, use.input);
  if (hook) {
    run.emit({ type: 'hook_decision', agentId, toolUseId: use.id, tool: shown, decision: hook.decision, reason: hook.reason });
    if (hook.decision === 'block') return finish(`Blocked by hook: ${hook.reason}`, true);
    if (hook.decision === 'ask') {
      const approved = await run.waitForApproval(use.id); // human in the loop
      run.emit({ type: 'approval_resolved', toolUseId: use.id, approved });
      if (!approved) return finish('The human declined this action.', true);
    }
  }

  if (!tool) return finish(`Unknown tool: ${use.name}`, true);
  try {
    return finish(await tool.run(use.input, { agentId, toolUseId: use.id }), false);
  } catch (err) {
    // A failing tool is information for the model, not a reason to crash.
    return finish(err instanceof Error ? err.message : String(err), true);
  }
}

function toStopReason(reason: Anthropic.Message['stop_reason']): StopReason {
  return reason === 'tool_use' || reason === 'end_turn' || reason === 'max_tokens' || reason === 'refusal' ? reason : 'other';
}
