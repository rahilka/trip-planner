import type Anthropic from '@anthropic-ai/sdk';
import type { Block } from '@glass-box/shared';

/** A piece of the system prompt. Skills appear here as one-line stubs. */
export type SystemPart = { kind: 'system' | 'skill_stub'; label: string; text: string };

/** Rough token estimate. Good enough for a picture; the UI labels it "≈". */
export const approxTokens = (text: string) => Math.ceil(text.length / 4);

const block = (kind: Block['kind'], label: string, content: string): Block => ({
  kind,
  label,
  content,
  tokens: approxTokens(content),
});

const asText = (value: unknown) => (typeof value === 'string' ? value : JSON.stringify(value, null, 2));

/**
 * Turns "what we send to the model" into a list of labelled blocks.
 * This is the context window: everything the model can see, and nothing else.
 */
export function toBlocks(system: SystemPart[], messages: Anthropic.MessageParam[]): Block[] {
  const blocks: Block[] = system.map((part) => block(part.kind, part.label, part.text));
  const toolNames = new Map<string, string>(); // tool_use id -> tool name

  for (const message of messages) {
    if (typeof message.content === 'string') {
      blocks.push(block(message.role, message.role === 'user' ? 'User' : 'Assistant', message.content));
      continue;
    }
    for (const part of message.content) {
      if (part.type === 'text' && part.text.trim()) {
        blocks.push(block(message.role, message.role === 'user' ? 'User' : 'Assistant', part.text));
      } else if (part.type === 'tool_use') {
        toolNames.set(part.id, part.name);
        blocks.push(block('tool_use', `→ ${part.name}`, asText(part.input)));
      } else if (part.type === 'tool_result') {
        const name = toolNames.get(part.tool_use_id) ?? 'tool';
        // A loaded skill is just a tool result, but we colour it differently.
        const kind = name === 'load_skill' && !part.is_error ? 'skill_full' : 'tool_result';
        blocks.push(block(kind, `← ${name}${part.is_error ? ' (error)' : ''}`, asText(part.content)));
      }
      // Thinking blocks are hidden by the API ("omitted"), so we don't draw them.
    }
  }
  return blocks;
}
