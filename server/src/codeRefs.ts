// "📂 Where is this in the code?": the server reads the hand-picked spots (shared/src/codeSpots.ts) from disk.
// Only those files can be read: never arbitrary paths (and never .env).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SPOTS, cutSpot, type CodeSpot } from '@glass-box/shared/codeSpots';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));

export function readSpot(key: string): (CodeSpot & { absolutePath: string }) | undefined {
  const spot = SPOTS[key];
  if (!spot) return undefined;
  const absolutePath = path.join(ROOT, spot.file);
  try {
    const found = cutSpot(key, fs.readFileSync(absolutePath, 'utf8'));
    return found && { ...found, absolutePath };
  } catch {
    return undefined;
  }
}
