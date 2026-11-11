<script setup lang="ts">
import { Handle, Position } from '@vue-flow/core';
import type { StepData } from '../../stores/flow';
import { openDecision } from '../../decision';

defineProps<{ data: StepData; selected: boolean; explain: boolean }>();
</script>

<template>
  <div :class="['card', data.kind, data.status, { selected }]">
    <Handle type="target" :position="Position.Top" />

    <!-- Header: a round avatar, the title, an optional tag -->
    <div class="head">
      <div class="avatar">
        <span>{{ data.icon }}</span>
        <i v-if="data.status === 'running'" class="spinner" />
      </div>
      <div class="titles">
        <div class="title">{{ data.title }}</div>
        <div v-if="data.subtitle" class="subtitle">{{ data.subtitle }}</div>
        <div v-else-if="data.kind === 'think' && data.status === 'running'" class="subtitle thinking">
          thinking<span>.</span><span>.</span><span>.</span>
        </div>
      </div>
      <span v-if="data.tag" :class="['tag', { mcp: data.tag === 'MCP' }]">{{ data.tag === 'MCP' ? '🔌 MCP' : data.tag }}</span>
    </div>

    <!-- 💭 What the model said, as a comic speech bubble -->
    <div v-if="data.quote" class="bubble">
      <b v-if="data.speaker">{{ data.speaker }}:</b> “{{ data.quote }}”
    </div>

    <!-- The fork in the road: the decision every turn ends with -->
    <div v-if="data.kind === 'think' && data.decision" class="fork">
      <div :class="['way', 'tools', { chosen: data.decision === 'tools' }]">🔧 Need tools<small>loop again</small></div>
      <div :class="['way', 'answer', { chosen: data.decision === 'answer' }]">🏁 Ready<small>answer &amp; stop</small></div>
    </div>

    <div v-if="explain && data.why" class="why">💡 {{ data.why }}</div>
    <!-- 🔎 Take this decision apart: what it had, what it picked, where it was decided, what we learn -->
    <button
      v-if="data.origin && (data.kind === 'tool' || (data.kind === 'think' && data.decision))"
      class="why-btn nodrag nopan"
      @click.stop="openDecision(data.origin.agentId, data.origin.turn, data.origin.toolUseId)"
    >
      🔎 {{ data.kind === 'tool' ? 'Why this tool?' : data.decision === 'tools' ? 'Why these tools?' : 'Why stop here?' }}
    </button>
    <div v-if="data.footer" class="footer">{{ data.footer }}</div>

    <Handle type="source" :position="Position.Bottom" />
  </div>
</template>

<style scoped>
.card {
  --c: var(--muted);
  width: 300px;
  padding: 10px 12px;
  border-radius: 16px;
  background: linear-gradient(160deg, color-mix(in srgb, var(--c) 18%, var(--panel-2)) 0%, var(--panel-2) 55%);
  border: 1.5px solid color-mix(in srgb, var(--c) 45%, var(--border));
  color: var(--text);
  cursor: pointer;
  text-align: left;
  box-shadow: 0 6px 18px rgb(0 0 0 / 0.35);
  animation: pop 0.45s cubic-bezier(0.2, 1.4, 0.4, 1);
}
.card.prompt { --c: var(--c-user); }
.card.agent { --c: var(--accent); }
.card.think { --c: var(--c-system); }
.card.tool { --c: var(--c-tool_use); }
.card.report { --c: var(--c-tool_result); }
.card.answer { --c: var(--c-assistant); border-width: 2px; }
.card.error { --c: var(--c-error); }
.card.running { animation: pop 0.45s cubic-bezier(0.2, 1.4, 0.4, 1), glow 1.6s ease-in-out infinite; }
.card.waiting { --c: var(--c-error); animation: alarm 0.9s ease-in-out infinite; }
.card.selected { outline: 3px solid var(--accent); outline-offset: 2px; }

.head { display: flex; gap: 10px; align-items: center; }
.avatar {
  position: relative;
  width: 40px;
  height: 40px;
  flex-shrink: 0;
  border-radius: 50%;
  display: grid;
  place-items: center;
  font-size: 22px;
  background: color-mix(in srgb, var(--c) 28%, var(--panel));
  border: 2px solid color-mix(in srgb, var(--c) 70%, transparent);
}
.card.prompt .avatar, .card.agent .avatar { width: 46px; height: 46px; font-size: 26px; }
.spinner {
  position: absolute;
  inset: -5px;
  border-radius: 50%;
  border: 3px solid transparent;
  border-top-color: var(--c);
  animation: spin 0.9s linear infinite;
}
.titles { flex: 1; min-width: 0; }
.title { font-weight: 800; font-size: 15px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.card.answer .title { font-size: 17px; color: var(--c-assistant); }
.subtitle { font-size: 12.5px; color: #c9cede; margin-top: 2px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.card.prompt .subtitle { white-space: normal; font-style: italic; }
.thinking span { animation: blink 1.2s infinite; }
.thinking span:nth-child(2) { animation-delay: 0.2s; }
.thinking span:nth-child(3) { animation-delay: 0.4s; }
.tag { font-size: 10.5px; padding: 2px 8px; border-radius: 999px; background: var(--panel); border: 1px solid var(--border); color: var(--muted); white-space: nowrap; }
.tag.mcp { color: var(--c-mcp); border-color: color-mix(in srgb, var(--c-mcp) 60%, transparent); }

/* Comic-style speech bubble with a little tail */
.bubble {
  position: relative;
  margin: 12px 0 2px;
  padding: 8px 10px;
  border-radius: 12px;
  background: #f4f1ff;
  color: #2b2350;
  font-size: 12.5px;
  line-height: 1.4;
  font-style: italic;
  animation: pop 0.4s cubic-bezier(0.2, 1.4, 0.4, 1);
}
.bubble::before {
  content: '';
  position: absolute;
  top: -8px;
  left: 18px;
  border: 8px solid transparent;
  border-top: 0;
  border-bottom-color: #f4f1ff;
}
.bubble b { font-style: normal; color: #5b45c9; }

/* The decision fork */
.fork { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; margin-top: 10px; }
.way {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 5px 4px;
  border-radius: 10px;
  font-size: 12.5px;
  font-weight: 700;
  border: 1.5px dashed var(--border);
  color: var(--muted);
  opacity: 0.45;
  transition: all 0.4s;
}
.way small { font-weight: 500; font-size: 10.5px; }
.way.chosen { opacity: 1; border-style: solid; transform: scale(1.04); }
.way.tools.chosen { border-color: var(--c-tool_use); background: color-mix(in srgb, var(--c-tool_use) 20%, transparent); color: #ffd58a; }
.way.answer.chosen { border-color: var(--c-assistant); background: color-mix(in srgb, var(--c-assistant) 20%, transparent); color: #9ff0c8; }

.why {
  margin-top: 9px;
  padding: 6px 8px;
  border-radius: 8px;
  background: rgb(0 0 0 / 0.22);
  font-size: 11.5px;
  line-height: 1.4;
  color: #aab0c6;
}
.why-btn {
  display: block;
  width: 100%;
  margin-top: 8px;
  padding: 5px 8px;
  border-radius: 9px;
  font-size: 12px;
  font-weight: 700;
  color: #e4defd;
  background: color-mix(in srgb, var(--c-system) 22%, var(--panel));
  border: 1px solid color-mix(in srgb, var(--c-system) 60%, transparent);
  cursor: pointer;
}
.why-btn:hover { background: color-mix(in srgb, var(--c-system) 40%, var(--panel)); }
.footer { font-size: 11px; color: var(--muted); margin-top: 6px; text-align: right; }

@keyframes pop { from { transform: scale(0.6); opacity: 0; } }
@keyframes spin { to { transform: rotate(360deg); } }
@keyframes blink { 0%, 100% { opacity: 0.2; } 50% { opacity: 1; } }
@keyframes glow { 50% { box-shadow: 0 0 26px 4px color-mix(in srgb, var(--c) 50%, transparent); } }
@keyframes alarm { 50% { box-shadow: 0 0 28px 6px color-mix(in srgb, var(--c-error) 65%, transparent); } }
</style>
