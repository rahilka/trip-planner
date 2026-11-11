// MCP client: launches the travel-data server as a separate process and talks to it over stdio.
// The agent never knows these tools come from somewhere else. To the model, a tool is a tool.
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import type { AgentTool, RunContext } from '../types.ts';
import { describe } from '../tools/describe.ts';

const SERVER_DIR = fileURLToPath(new URL('../../../mcp-travel-data/', import.meta.url));
const SERVER_NAME = 'travel-data';

export type McpConnection = { tools: AgentTool[]; close: () => Promise<void> };

export async function connectTravelData(run: RunContext, breakIt: boolean): Promise<McpConnection> {
  // 1. Spawn the server process (node + tsx so it runs straight from TypeScript).
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: ['--import', 'tsx', 'src/index.ts'],
    cwd: SERVER_DIR,
    stderr: 'ignore',
  });
  const client = new Client({ name: 'agent-glass-box', version: '1.0.0' });
  // If the server process doesn't come up, fail fast with a clear message instead of hanging the run.
  const timeout = 20_000;
  const failed = (err: unknown): never => {
    void transport.close().catch(() => {});
    throw new Error(`The travel-data MCP server did not start within ${timeout / 1000} s (${err instanceof Error ? err.message : err}).`);
  };
  await client.connect(transport, { timeout }).catch(failed); // MCP "initialize" handshake

  // 2. DISCOVERY: ask the server what it can do. Nothing is hard-coded on our side.
  const { tools } = await client.listTools(undefined, { timeout }).catch(failed);
  run.emit({ type: 'mcp_handshake', server: SERVER_NAME, tools: tools.map((t) => ({ name: t.name, description: t.description ?? '' })) });

  // 3. Wrap each discovered tool so the agent loop can call it like any local tool.
  const agentTools: AgentTool[] = tools.map((t) => ({
    source: 'mcp',
    definition: {
      name: t.name,
      description: describe(breakIt, t.description ?? ''),
      input_schema: t.inputSchema as AgentTool['definition']['input_schema'],
    },
    run: async (input) => {
      const result = await client.callTool({ name: t.name, arguments: input });
      const text = (result.content as { type: string; text?: string }[]).map((c) => c.text ?? '').join('\n');
      if (result.isError) throw new Error(text); // becomes an is_error tool_result in the loop
      try {
        return JSON.parse(text);
      } catch {
        return text;
      }
    },
  }));

  return { tools: agentTools, close: () => client.close() };
}
