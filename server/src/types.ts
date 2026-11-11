import type Anthropic from '@anthropic-ai/sdk';
import type { AgentEvent } from '@glass-box/shared';
import type { SystemPart } from './context.ts';
import type { HookRegistry } from './hooks.ts';

/** A tool = a definition the model reads + a function our code runs. */
export type AgentTool = {
  definition: Anthropic.Tool; // name, description, JSON schema: all the model ever sees
  source: 'local' | 'mcp';
  /** Break-it mode: the real name, when the model only sees "tool_3". */
  realName?: string;
  run: (input: any, caller: { agentId: string; toolUseId: string }) => Promise<unknown>;
};

/** Everything that makes one agent different from another. */
export type AgentConfig = {
  agentId: string;
  parentId?: string;
  role: string;
  model: string;
  system: SystemPart[];
  tools: AgentTool[];
  task?: string;
  waitsOn?: string;
  /** The delegate_task call that created this subagent. */
  parentToolUseId?: string;
  /** Resolves when the agent this one depends on (waitsOn) has finished. */
  ready?: Promise<unknown>;
};

/** Shared plumbing for one run: event stream, step gate, hooks, approvals. */
export type RunContext = {
  emit: (event: AgentEvent) => void;
  gate: () => Promise<void>;
  hooks: HookRegistry;
  waitForApproval: (toolUseId: string) => Promise<boolean>;
  /** Fires when the presenter presses Stop: cancels the model call in flight. */
  signal: AbortSignal;
};
