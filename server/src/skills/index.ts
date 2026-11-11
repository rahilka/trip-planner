// Skills = instructions packaged as files. The agent starts with only each skill's
// NAME + one-line DESCRIPTION (cheap). It loads the full text only when it needs it.
// That's "progressive disclosure": pay for context only when it's useful.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export type Skill = { name: string; description: string; body: string };

const SKILLS_DIR = fileURLToPath(new URL('.', import.meta.url));

/** Reads every <skill>/SKILL.md and splits its YAML-ish frontmatter from the body. */
export function loadSkills(): Skill[] {
  return fs
    .readdirSync(SKILLS_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory() && fs.existsSync(path.join(SKILLS_DIR, d.name, 'SKILL.md')))
    .map((d) => {
      const raw = fs.readFileSync(path.join(SKILLS_DIR, d.name, 'SKILL.md'), 'utf8').replace(/\r\n/g, '\n');
      const [, front = '', body = raw] = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/) ?? [];
      const field = (key: string) => front.match(new RegExp(`^${key}:\\s*(.+)$`, 'm'))?.[1].trim() ?? '';
      return { name: field('name') || d.name, description: field('description'), body: body.trim() };
    });
}
