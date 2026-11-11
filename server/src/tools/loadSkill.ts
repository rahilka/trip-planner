import { approxTokens, type SystemPart } from '../context.ts';
import type { Skill } from '../skills/index.ts';
import type { AgentTool, RunContext } from '../types.ts';
import { describe } from './describe.ts';

/** What goes in the system prompt: one line per skill. The full text stays on disk. */
export const skillStubs = (skills: Skill[]): SystemPart[] =>
  skills.map((s) => ({
    kind: 'skill_stub',
    label: s.name,
    text: `Available skill "${s.name}": ${s.description} (call load_skill to read it)`,
  }));

export const loadSkillTool = (skills: Skill[], run: RunContext, breakIt: boolean): AgentTool => ({
  source: 'local',
  definition: {
    name: 'load_skill',
    description: describe(breakIt, 'Load the full instructions of an available skill by name. Use it when a skill is relevant to the task.'),
    input_schema: {
      type: 'object',
      properties: { name: { type: 'string', enum: skills.map((s) => s.name), description: 'Skill name' } },
      required: ['name'],
    },
  },
  run: async ({ name }: { name: string }, { agentId }) => {
    const skill = skills.find((s) => s.name === name);
    if (!skill) throw new Error(`No skill called "${name}". Available: ${skills.map((s) => s.name).join(', ')}`);
    run.emit({ type: 'skill_loaded', agentId, skill: skill.name, tokens: approxTokens(skill.body) });
    return skill.body; // only NOW does the full playbook enter the context window
  },
});
