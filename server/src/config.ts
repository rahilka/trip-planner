import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

// The API key lives in the repo-root .env (never committed). The Anthropic SDK
// reads ANTHROPIC_API_KEY from the environment, so we never pass it around.
dotenv.config({ path: fileURLToPath(new URL('../../.env', import.meta.url)), quiet: true });

export const config = {
  port: Number(process.env.PORT ?? 3001),
  coordinatorModel: process.env.COORDINATOR_MODEL ?? 'claude-sonnet-5-5',
  subagentModel: process.env.SUBAGENT_MODEL ?? 'claude-haiku-5-5',
  /** The models' real context window. The UI shows how much of it each agent uses. */
  contextWindow: Number(process.env.CONTEXT_WINDOW ?? 1_000_000),
  /** Safety stop: an agent loop never runs more turns than this. */
  maxTurns: 15,
  recordingsDir: fileURLToPath(new URL('../recordings/', import.meta.url)),
};
