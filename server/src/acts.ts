// The same prompt runs in every act. Each act switches on one more capability.

export type ActFeatures = {
  weatherTool: boolean; // Act 2: a local tool
  mcp: boolean; // Act 3: tools discovered from an MCP server
  skill: boolean; // Act 4: a skill loaded on demand
  subagents: boolean; // Act 5: coordinator + subagents
  booking: boolean; // Act 6: book_trip behind a hook + human approval
};

export type RunFlags = {
  breakIt: boolean; // vague tool descriptions
  stepMode: boolean; // pause before every model call
  promptOnlyBudget: boolean; // budget rule in the prompt only, no hook
};

export const ACT_TITLES: Record<number, string> = {
  1: 'Plain LLM call',
  2: 'Agent loop + a local tool',
  3: 'MCP server',
  4: 'Skills',
  5: 'Subagents',
  6: 'Hooks + human in the loop',
};

export function featuresFor(act: number): ActFeatures {
  return {
    weatherTool: act >= 2,
    mcp: act >= 3,
    skill: act >= 4,
    subagents: act >= 5,
    booking: act >= 6,
  };
}
