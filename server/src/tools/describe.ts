// Tool descriptions are prompts. "Break it" mode swaps them for vague ones
// so the audience can watch the model pick the wrong tool.
import type { AgentTool } from '../types.ts';

export const describe = (breakIt: boolean, good: string, vague = 'Gets data.') => (breakIt ? vague : good);

/** Break-it mode, part 2: the parameter descriptions go too. Only names and types remain. */
export function vagueParams(tool: AgentTool): AgentTool {
  const schema = structuredClone(tool.definition.input_schema) as { properties?: Record<string, { description?: string }> };
  for (const prop of Object.values(schema.properties ?? {})) delete prop.description;
  return { ...tool, definition: { ...tool.definition, input_schema: schema as AgentTool['definition']['input_schema'] } };
}

/** Break-it mode, part 3: opaque names. The model sees tool_1, tool_2… and has to guess. */
export function breakTools(tools: AgentTool[], firstNumber = 1): AgentTool[] {
  return tools.map((tool, i) => {
    const vague = vagueParams(tool);
    const realName = tool.realName ?? tool.definition.name;
    return { ...vague, realName, definition: { ...vague.definition, name: `tool_${firstNumber + i}` } };
  });
}
