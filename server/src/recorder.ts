import fs from 'node:fs';
import path from 'node:path';
import type { StreamedEvent } from '@glass-box/shared';
import { config } from './config.ts';

/** Appends every event of a run to recordings/<timestamp>-act<N>.jsonl, for replay. */
export class Recorder {
  readonly file: string;

  constructor(act: number) {
    fs.mkdirSync(config.recordingsDir, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    this.file = path.join(config.recordingsDir, `${stamp}-act${act}.jsonl`);
  }

  append(event: StreamedEvent) {
    fs.appendFileSync(this.file, JSON.stringify(event) + '\n');
  }
}

export function listRecordings() {
  if (!fs.existsSync(config.recordingsDir)) return [];
  return fs
    .readdirSync(config.recordingsDir)
    .filter((f) => f.endsWith('.jsonl'))
    .sort()
    .reverse()
    .map((file) => ({ file, size: fs.statSync(path.join(config.recordingsDir, file)).size }));
}

export function readRecording(file: string): string | undefined {
  const safeName = path.basename(file); // no path traversal
  const full = path.join(config.recordingsDir, safeName);
  return safeName.endsWith('.jsonl') && fs.existsSync(full) ? fs.readFileSync(full, 'utf8') : undefined;
}
