<script setup lang="ts">
// The coda: everything we built by hand is what Claude Code does for you.
import { useRunStore } from '../stores/run';

const run = useRunStore();
const ROWS = [
  { app: 'runAgent(): Think → Act → Observe', cc: 'Claude Code itself', note: 'the same loop, with file, shell and search tools' },
  { app: 'load_skill + SKILL.md', cc: '.claude/skills/', note: 'loaded only when relevant (progressive disclosure)' },
  { app: 'The demo prompt, saved', cc: '.claude/commands/', note: 'slash commands such as /plan-trip' },
  { app: 'Project conventions', cc: 'CLAUDE.md', note: 'always in context, like our system prompt' },
  { app: 'PreToolUse budget hook', cc: 'Claude Code hooks', note: 'code that runs before a tool: allow, block or ask' },
  { app: 'travel-data MCP server', cc: 'MCP servers', note: 'the same protocol, so this server plugs straight in' },
  { app: 'delegate_task + subagents', cc: 'Subagents', note: 'isolated contexts that return only a summary' },
];
</script>

<template>
  <Transition name="fade">
    <div v-if="run.showClosing" class="closing" @click.self="run.showClosing = false">
      <div class="inner">
        <h1>You just watched <span>Claude Code</span> from the inside.</h1>
        <table>
          <thead>
            <tr><th>In this app</th><th></th><th>In Claude Code</th></tr>
          </thead>
          <tbody>
            <tr v-for="(r, i) in ROWS" :key="r.cc" :style="{ animationDelay: `calc(${i} * 180ms / var(--speed))` }">
              <td><code>{{ r.app }}</code></td>
              <td class="arrow">→</td>
              <td><b>{{ r.cc }}</b><div class="note">{{ r.note }}</div></td>
            </tr>
          </tbody>
        </table>
        <p class="next">Next: open a terminal and run <code>claude</code> in this repo, then try <code>/plan-trip Paris 4 700</code>.</p>
        <button @click="run.showClosing = false">Back to the app</button>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.closing { position: fixed; inset: 0; background: var(--bg); z-index: 60; display: grid; place-items: center; padding: 16px; overflow: auto; }
.inner { width: min(1100px, 100%); }
h1 { font-size: clamp(24px, 3.4vw, 44px); margin: 0 0 28px; }
h1 span { color: var(--accent); }
table { width: 100%; border-collapse: collapse; font-size: clamp(14px, 1.4vw, 19px); }
th { text-align: left; color: var(--muted); font-weight: 500; padding: 8px 10px; border-bottom: 1px solid var(--border); }
td { padding: 12px 10px; border-bottom: 1px solid var(--border); vertical-align: top; }
tbody tr { animation: slide var(--t-med) ease-out both; }
code { color: var(--c-tool_use); }
.arrow { color: var(--accent); font-size: 1.4em; padding-top: 6px; }
.note { color: var(--muted); font-size: 0.8em; margin-top: 2px; }
.next { margin: 28px 0 16px; font-size: clamp(14px, 1.3vw, 18px); color: var(--muted); }
.fade-enter-from, .fade-leave-to { opacity: 0; }
.fade-enter-active, .fade-leave-active { transition: opacity var(--t-med); }
@keyframes slide { from { opacity: 0; transform: translateX(-20px); } }
</style>
