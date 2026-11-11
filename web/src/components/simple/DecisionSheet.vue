<script setup lang="ts">
// "🔎 Why?": one decision of the agent, taken apart in four steps.
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { buildDecision, decisionView, type Origin } from '../../decision';
import { openLearn } from '../../learn';
import CodeRefs from './CodeRefs.vue';
import { useRunStore } from '../../stores/run';

const run = useRunStore();
const decision = computed(() => (decisionView.open ? buildDecision(run.events, decisionView.agentId, decisionView.turn) : undefined));
const isTools = computed(() => decision.value?.stopReason === 'tool_use');
const turns = computed(() => run.events.filter((e) => e.type === 'model_response' && e.agentId === decisionView.agentId).length);
const usesMcp = computed(() => decision.value?.calls.some((c) => c.source === 'mcp'));
const usesLocal = computed(() => decision.value?.calls.some((c) => c.source === 'local'));
const showReasoning = ref(false);
/** 📂 The few code spots behind this decision: the API call, what the loop does next, and the tools it picked. */
const codeKeys = computed(() => {
  const d = decision.value;
  if (!d) return [];
  const picked = [...new Set(d.calls.map((c) => toolName(c.name)))];
  const toolKeys = picked.map((name) => (d.calls.find((c) => toolName(c.name) === name)?.source === 'mcp' ? `mcp.${name}` : `tool.${name}`));
  return [
    'loop.decide',
    isTools.value ? 'loop.runTools' : 'loop.stop',
    ...toolKeys.slice(0, 2),
    ...(picked.includes('book_trip') ? ['hook.budget'] : []),
  ];
});
watch(() => [decisionView.agentId, decisionView.turn], () => (showReasoning.value = false));

const ORIGIN: Record<Origin, { icon: string; label: string }> = {
  prompt: { icon: '📝', label: 'from your words' },
  result: { icon: '📬', label: 'from a tool result' },
  model: { icon: '🧩', label: 'the model worked it out' },
};
const firstSentence = (text: string) => (text.match(/^[^.!?]*[.!?]?/)?.[0] ?? text).trim();
const toolName = (name: string) => name.split(' = ').pop()!;

function goTurn(delta: number) {
  const next = decisionView.turn + delta;
  if (next >= 1 && next <= turns.value) Object.assign(decisionView, { turn: next, focusToolUseId: '' });
}
function onKey(e: KeyboardEvent) {
  if (!decisionView.open) return;
  if (e.key === 'Escape') decisionView.open = false;
  if (e.key === 'ArrowRight') goTurn(1);
  if (e.key === 'ArrowLeft') goTurn(-1);
}
onMounted(() => window.addEventListener('keydown', onKey));
onBeforeUnmount(() => window.removeEventListener('keydown', onKey));
</script>

<template>
  <Transition name="sheet">
    <div v-if="decisionView.open && decision" class="backdrop" @click.self="decisionView.open = false">
      <div class="sheet" role="dialog" aria-label="Why did the agent decide this?">
        <header>
          <div>
            <div class="eyebrow">🔎 Decision breakdown · {{ decision.role }} · turn {{ decision.turn }}</div>
            <h2>{{ isTools ? 'Why did it call these tools?' : 'Why did it stop and answer here?' }}</h2>
          </div>
          <button class="close" title="Close (Esc)" @click="decisionView.open = false">✕</button>
        </header>

        <div class="body" :key="`${decisionView.agentId}:${decision.turn}`">
          <!-- ① What it had -->
          <section class="step">
            <div class="num">1</div>
            <div class="content">
              <h3>📥 What the model had in front of it</h3>
              <div class="asked">
                <div class="label">{{ decision.isSubagent ? 'The task it was given' : 'Your request' }}</div>
                <p>“{{ decision.askedFor }}”</p>
              </div>
              <div v-if="decision.newResults.length" class="new-results">
                <div class="label">New since its last turn: the results it asked for</div>
                <div v-for="(r, i) in decision.newResults" :key="i" :class="['result', { error: r.isError }]">
                  <b>{{ r.isError ? '✗' : '✓' }} {{ r.name }}</b> <span>{{ r.summary }}</span>
                </div>
              </div>
              <div class="label">
                The tool menu: {{ decision.menu.length }} tool{{ decision.menu.length === 1 ? '' : 's' }}.
                It sees only each name and description, never the code.
              </div>
              <div v-if="!decision.menu.length" class="none">No tools at all, so it can only answer from memory.</div>
              <div class="menu">
                <div
                  v-for="t in decision.menu"
                  :key="t.name"
                  :class="['dish', { picked: t.picked, focus: decision.calls.some((c) => c.toolUseId === decisionView.focusToolUseId && c.name.split(' = ')[0] === t.name) }]"
                >
                  <div class="dish-head">
                    <code>{{ t.name }}</code>
                    <span v-if="t.source === 'mcp'" class="mini mcp">MCP</span>
                    <span v-if="t.picked" class="picked-tag">✓ picked{{ t.picked > 1 ? ` ×${t.picked}` : '' }}</span>
                    <span v-else class="skip-tag">not now</span>
                  </div>
                  <div class="dish-desc">{{ firstSentence(t.description) }}</div>
                </div>
              </div>
            </div>
          </section>

          <!-- ② What it decided -->
          <section class="step">
            <div class="num">2</div>
            <div class="content">
              <h3>🧠 What it decided</h3>
              <div class="verdict">
                <span :class="['fork', { on: isTools }]">🔧 Call tools</span>
                <span :class="['fork', 'answer', { on: !isTools }]">🏁 Answer now</span>
                <code class="stop">stop_reason: "{{ decision.stopReason }}"</code>
              </div>
              <div v-if="decision.said && isTools" class="bubble"><b>In its own words:</b> “{{ decision.said }}”</div>
              <div v-if="decision.thinking">
                <button class="link" @click="showReasoning = !showReasoning">💭 {{ showReasoning ? 'Hide' : 'Show' }} its reasoning summary</button>
                <p v-if="showReasoning" class="reasoning">{{ decision.thinking }}</p>
              </div>

              <template v-if="decision.calls.length">
                <div class="label">The calls it wrote, and where each input came from</div>
                <div class="legend">
                  <span v-for="(o, key) in ORIGIN" :key="key" :class="['chip', key]">{{ o.icon }} {{ o.label }}</span>
                </div>
                <div
                  v-for="c in decision.calls"
                  :key="c.toolUseId"
                  :class="['call', { focus: c.toolUseId === decisionView.focusToolUseId }]"
                >
                  <div class="call-head">
                    <code>{{ c.name }}</code>
                    <span v-if="c.source === 'mcp'" class="mini mcp">🔌 MCP server</span>
                    <span v-else class="mini">🔧 our code</span>
                  </div>
                  <div v-if="c.description" class="match">Matches its description: “{{ firstSentence(c.description) }}”</div>
                  <div class="inputs">
                    <span v-for="i in c.inputs" :key="i.key" :class="['chip', i.origin]" :title="ORIGIN[i.origin].label">
                      {{ ORIGIN[i.origin].icon }} <b>{{ i.key }}</b> = {{ i.value }}
                    </span>
                  </div>
                </div>
              </template>
            </div>
          </section>

          <!-- ③ Where it was decided -->
          <section class="step">
            <div class="num">3</div>
            <div class="content">
              <h3>📍 Where was this decided?</h3>
              <div class="pipeline">
                <div class="stage">
                  <div class="s-icon">📦</div>
                  <b>Our code sends</b>
                  <span>instructions + the conversation + {{ decision.menu.length }} tool descriptions</span>
                </div>
                <div class="arrow">→</div>
                <div class="stage here">
                  <div class="here-tag">decided HERE</div>
                  <div class="s-icon">🧠</div>
                  <b>The model (Claude)</b>
                  <span>
                    replies with <code>{{ decision.stopReason }}</code>{{ isTools ? ` + ${decision.calls.length} call${decision.calls.length === 1 ? '' : 's'}` : ' + the answer' }}
                  </span>
                </div>
                <div class="arrow">→</div>
                <div class="stage">
                  <div class="s-icon">⚙️</div>
                  <b>Our loop (loop.ts)</b>
                  <span>{{ isTools ? 'sees “tool_use” and runs exactly those calls' : 'sees “end_turn” and stops the loop' }}</span>
                </div>
                <template v-if="isTools">
                  <div class="arrow">→</div>
                  <div class="stage">
                    <div class="s-icon">{{ usesMcp ? '🔌' : '🔧' }}</div>
                    <b>{{ usesMcp && usesLocal ? 'MCP server + our functions' : usesMcp ? 'The MCP server' : 'Our functions' }}</b>
                    <span>do the work; results go back into the conversation</span>
                  </div>
                </template>
              </div>
              <p class="note">
                Our code never chooses a tool. The choice is made inside the model, in one API response. The loop only does
                what that response says.
              </p>
              <div class="code-label">📂 Where this is in the code (click one to see it)</div>
              <CodeRefs :keys="codeKeys" />
            </div>
          </section>

          <!-- ④ What we learn -->
          <section class="step">
            <div class="num">4</div>
            <div class="content">
              <h3>🎓 What we can learn from this</h3>
              <ul class="lessons">
                <li v-for="(l, i) in decision.lessons" :key="i" :style="{ animationDelay: `${i * 80}ms` }">
                  <span class="l-icon">{{ l.icon }}</span><span>{{ l.text }}</span>
                </li>
              </ul>
              <div class="more">
                <button @click="openLearn('tool')">📚 What is a tool?</button>
                <button v-if="usesMcp" @click="openLearn('tool-mcp')">📚 Tool vs MCP</button>
                <button @click="openLearn('agent')">📚 What is an agent?</button>
              </div>
            </div>
          </section>
        </div>

        <footer>
          <button :style="{ visibility: decision.turn > 1 ? 'visible' : 'hidden' }" @click="goTurn(-1)">← Turn {{ decision.turn - 1 }}</button>
          <span class="keys">← → other turns of this agent · Esc to close</span>
          <button :style="{ visibility: decision.turn < turns ? 'visible' : 'hidden' }" @click="goTurn(1)">Turn {{ decision.turn + 1 }} →</button>
        </footer>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.backdrop { position: fixed; inset: 0; z-index: 50; display: grid; place-items: center; padding: 16px; background: rgb(5 6 12 / 0.65); backdrop-filter: blur(3px); }
.sheet {
  width: min(900px, 100%); max-height: min(900px, 100%); display: flex; flex-direction: column;
  border-radius: 20px; background: linear-gradient(160deg, #171a2b, #13151f 60%); border: 1px solid var(--border);
  box-shadow: 0 30px 80px rgb(0 0 0 / 0.6); overflow: hidden;
}
header { display: flex; align-items: flex-start; gap: 12px; padding: 16px 20px 12px; border-bottom: 1px solid var(--border); }
.eyebrow { font-size: 11.5px; text-transform: uppercase; letter-spacing: 0.08em; color: var(--muted); font-weight: 700; }
h2 { margin: 4px 0 0; font-size: 22px; }
.close { margin-left: auto; border-radius: 999px; width: 32px; height: 32px; padding: 0; flex-shrink: 0; }
.body { overflow-y: auto; padding: 16px 20px 8px; }
.label { font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em; color: var(--muted); font-weight: 700; margin: 12px 0 6px; }

/* The numbered stepper down the left */
.step { display: grid; grid-template-columns: 34px 1fr; gap: 12px; position: relative; padding-bottom: 18px; animation: rise var(--t-med) ease-out both; }
.step:nth-child(2) { animation-delay: 90ms; }
.step:nth-child(3) { animation-delay: 180ms; }
.step:nth-child(4) { animation-delay: 270ms; }
.step:not(:last-child)::before { content: ''; position: absolute; left: 16px; top: 36px; bottom: 0; width: 2px; background: var(--border); }
.num {
  width: 34px; height: 34px; border-radius: 50%; display: grid; place-items: center; font-weight: 900;
  background: linear-gradient(135deg, var(--accent), var(--c-skill)); color: #fff;
}
h3 { margin: 6px 0 4px; font-size: 17px; }

.asked p { margin: 0; padding: 10px 12px; border-radius: 10px; background: color-mix(in srgb, var(--c-user) 12%, var(--panel)); border: 1px solid color-mix(in srgb, var(--c-user) 45%, transparent); font-style: italic; font-size: 14px; line-height: 1.5; }
.result { font-size: 12.5px; padding: 6px 10px; border-radius: 8px; background: var(--panel-2); margin-bottom: 4px; border-left: 3px solid var(--c-tool_result); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.result.error { border-left-color: var(--c-error); color: #fca5a5; }
.result span { color: var(--muted); margin-left: 6px; }
.none { font-size: 13px; color: var(--muted); font-style: italic; }

.menu { display: grid; grid-template-columns: repeat(auto-fill, minmax(230px, 1fr)); gap: 8px; }
.dish { padding: 8px 10px; border-radius: 10px; background: var(--panel); border: 1px dashed var(--border); opacity: 0.55; transition: all var(--t-fast); }
.dish.picked { opacity: 1; border: 1.5px solid var(--c-tool_use); background: color-mix(in srgb, var(--c-tool_use) 12%, var(--panel)); box-shadow: 0 0 14px color-mix(in srgb, var(--c-tool_use) 30%, transparent); }
.dish.focus { outline: 2px solid var(--accent); outline-offset: 2px; }
.dish-head { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.dish-head code { font-size: 12.5px; font-weight: 700; }
.dish-desc { font-size: 12px; color: #c9cede; margin-top: 4px; line-height: 1.4; }
.picked-tag { margin-left: auto; font-size: 11px; font-weight: 800; color: #ffd58a; }
.skip-tag { margin-left: auto; font-size: 11px; color: var(--muted); }
.mini { font-size: 10px; font-weight: 700; padding: 1px 7px; border-radius: 999px; border: 1px solid var(--border); color: var(--muted); }
.mini.mcp { color: var(--c-mcp); border-color: color-mix(in srgb, var(--c-mcp) 60%, transparent); }

.verdict { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; margin: 6px 0 10px; }
.fork { padding: 6px 12px; border-radius: 10px; font-weight: 700; font-size: 13.5px; border: 1.5px dashed var(--border); color: var(--muted); opacity: 0.5; }
.fork.on { opacity: 1; border-style: solid; border-color: var(--c-tool_use); background: color-mix(in srgb, var(--c-tool_use) 20%, transparent); color: #ffd58a; }
.fork.answer.on { border-color: var(--c-assistant); background: color-mix(in srgb, var(--c-assistant) 20%, transparent); color: #9ff0c8; }
.stop { font-size: 12px; color: var(--muted); }
.bubble { padding: 10px 12px; border-radius: 12px; background: #f4f1ff; color: #2b2350; font-size: 14px; line-height: 1.5; font-style: italic; }
.bubble b { font-style: normal; color: #5b45c9; }
.link { margin-top: 8px; border: none; background: transparent; padding: 0; color: var(--accent); font-weight: 600; font-size: 13px; }
.reasoning { font-size: 13px; line-height: 1.5; color: #c9cede; padding: 8px 12px; border-left: 3px solid var(--c-system); margin: 6px 0 0; white-space: pre-wrap; }

.legend { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 8px; }
.call { padding: 9px 11px; border-radius: 12px; background: var(--panel); border: 1px solid var(--border); margin-bottom: 8px; }
.call.focus { border-color: var(--accent); box-shadow: 0 0 16px rgb(124 140 255 / 0.4); }
.call-head { display: flex; align-items: center; gap: 8px; }
.call-head code { font-weight: 800; font-size: 13.5px; }
.match { font-size: 12.5px; color: #c9cede; margin: 4px 0 6px; }
.inputs { display: flex; gap: 6px; flex-wrap: wrap; }
.chip { font-size: 12px; padding: 3px 9px; border-radius: 999px; border: 1px solid; }
.chip.prompt { color: #9ccbff; border-color: color-mix(in srgb, var(--c-user) 60%, transparent); background: color-mix(in srgb, var(--c-user) 12%, transparent); }
.chip.result { color: #8ef0ef; border-color: color-mix(in srgb, var(--c-tool_result) 60%, transparent); background: color-mix(in srgb, var(--c-tool_result) 12%, transparent); }
.chip.model { color: #ffc58a; border-color: color-mix(in srgb, var(--c-wrong) 60%, transparent); background: color-mix(in srgb, var(--c-wrong) 12%, transparent); }

.pipeline { display: flex; align-items: stretch; gap: 6px; margin-top: 8px; flex-wrap: wrap; }
.stage {
  position: relative; flex: 1; min-width: 140px; display: flex; flex-direction: column; gap: 3px; padding: 10px; border-radius: 12px;
  background: var(--panel); border: 1px solid var(--border); font-size: 12.5px; text-align: center;
}
.stage span { color: #c9cede; line-height: 1.35; }
.s-icon { font-size: 22px; }
.stage.here { border: 2px solid var(--c-system); background: color-mix(in srgb, var(--c-system) 16%, var(--panel)); box-shadow: 0 0 20px color-mix(in srgb, var(--c-system) 40%, transparent); }
.here-tag { position: absolute; top: -10px; left: 50%; transform: translateX(-50%); font-size: 10px; font-weight: 800; padding: 1px 8px; border-radius: 999px; background: var(--c-system); color: #fff; white-space: nowrap; }
.arrow { align-self: center; color: var(--muted); font-size: 20px; font-weight: 800; }
.code-label { font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em; color: var(--muted); font-weight: 700; margin: 10px 0 6px; }
.note { font-size: 13.5px; line-height: 1.5; margin: 12px 0 6px; }
pre { margin: 0; padding: 10px 12px; border-radius: 10px; background: #0d0f16; border: 1px solid var(--border); font-size: 12px; white-space: pre-wrap; overflow-wrap: anywhere; color: #d6dbea; }

.lessons { list-style: none; margin: 6px 0 0; padding: 0; display: flex; flex-direction: column; gap: 6px; }
.lessons li {
  display: flex; gap: 10px; padding: 9px 12px; border-radius: 10px; font-size: 14px; line-height: 1.45;
  background: color-mix(in srgb, var(--c-tool_use) 8%, var(--panel)); border: 1px solid color-mix(in srgb, var(--c-tool_use) 30%, transparent);
  animation: rise var(--t-med) ease-out both;
}
.l-icon { font-size: 17px; }
.more { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 12px; }
.more button { border-radius: 999px; padding: 5px 12px; font-size: 12.5px; background: color-mix(in srgb, var(--c-skill) 12%, var(--panel)); border-color: color-mix(in srgb, var(--c-skill) 50%, transparent); }

footer { display: flex; align-items: center; justify-content: space-between; padding: 10px 18px; border-top: 1px solid var(--border); }
.keys { font-size: 12px; color: var(--muted); }

.sheet-enter-active, .sheet-leave-active { transition: opacity var(--t-fast); }
.sheet-enter-active .sheet { transition: transform var(--t-med) cubic-bezier(0.2, 1.3, 0.4, 1); }
.sheet-enter-from, .sheet-leave-to { opacity: 0; }
.sheet-enter-from .sheet { transform: scale(0.92) translateY(14px); }
@keyframes rise { from { opacity: 0; transform: translateY(8px); } }

@media (max-width: 700px) {
  .arrow { transform: rotate(90deg); width: 100%; text-align: center; }
  .stage { min-width: 100%; }
}
</style>
