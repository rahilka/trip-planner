<script setup lang="ts">
// "📚 Learn": a cheat sheet. Each concept gets an everyday analogy, then the X-vs-Y comparisons people ask about.
import { computed, onBeforeUnmount, onMounted } from 'vue';
import { COMPARISONS, CONCEPTS, comparisonsFor, conceptById, learn, openLearn } from '../../learn';
import { useRunStore } from '../../stores/run';

const run = useRunStore();

const concept = computed(() => CONCEPTS.find((c) => c.id === learn.topic) ?? CONCEPTS[1]);
const comparison = computed(() => COMPARISONS.find((c) => c.id === learn.topic) ?? COMPARISONS[1]);
const left = computed(() => conceptById(comparison.value.left));
const right = computed(() => conceptById(comparison.value.right));
// The everyday picture and the dev equivalent lead; the detailed rows follow.
const allRows = computed(() => [
  { label: '🏠 In everyday life', ...comparison.value.life },
  { label: '👩‍💻 In dev terms', ...comparison.value.devTerms },
  ...comparison.value.rows,
]);

function showTab(tab: 'what' | 'vs') {
  learn.tab = tab;
  learn.topic = tab === 'what' ? concept.value.id : comparison.value.id;
}
function step(delta: number) {
  const list: { id: string }[] = learn.tab === 'what' ? CONCEPTS : COMPARISONS;
  const i = list.findIndex((x) => x.id === learn.topic);
  learn.topic = list[(i + delta + list.length) % list.length].id;
}
function tryAct(act?: number) {
  if (!act || run.running) return;
  run.act = act;
  learn.open = false;
}
const otherSide = (c: { left: string; right: string }) => conceptById(c.left === concept.value.id ? c.right : c.left);

function onKey(e: KeyboardEvent) {
  if (!learn.open) return;
  if (e.key === 'Escape') learn.open = false;
  if (e.key === 'ArrowRight') step(1);
  if (e.key === 'ArrowLeft') step(-1);
}
onMounted(() => window.addEventListener('keydown', onKey));
onBeforeUnmount(() => window.removeEventListener('keydown', onKey));
</script>

<template>
  <Transition name="sheet">
    <div v-if="learn.open" class="backdrop" @click.self="learn.open = false">
      <div class="sheet" role="dialog" aria-label="Agent cheat sheet">
        <header>
          <div class="title">📚 Agent cheat sheet</div>
          <div class="tabs" role="tablist">
            <button role="tab" :aria-selected="learn.tab === 'what'" :class="{ on: learn.tab === 'what' }" @click="showTab('what')">What is…?</button>
            <button role="tab" :aria-selected="learn.tab === 'vs'" :class="{ on: learn.tab === 'vs' }" @click="showTab('vs')">What’s the difference?</button>
          </div>
          <button class="close" title="Close (Esc)" @click="learn.open = false">✕</button>
        </header>

        <!-- ───────── What is…? ───────── -->
        <div v-if="learn.tab === 'what'" class="what">
          <nav>
            <button
              v-for="c in CONCEPTS"
              :key="c.id"
              :class="{ on: c.id === concept.id }"
              :style="{ '--c': c.color }"
              @click="learn.topic = c.id"
            >
              <span class="nav-icon">{{ c.icon }}</span>
              <span>{{ c.name }}</span>
              <span v-if="c.act === run.act" class="new">this act</span>
            </button>
          </nav>

          <article :key="concept.id" class="card" :style="{ '--c': concept.color }">
            <div class="analogy">
              <div class="bubble">{{ concept.icon }}</div>
              <div class="approx">≈</div>
              <div class="bubble like">{{ concept.likeIcon }}</div>
              <div class="analogy-text">
                <div class="name">{{ concept.name }}</div>
                <div class="like-line">Think of it like <b>{{ concept.like.charAt(0).toLowerCase() + concept.like.slice(1) }}</b>.</div>
              </div>
            </div>
            <p class="think">{{ concept.really }}</p>

            <!-- Two ways in: a scene from everyday life, or the thing developers already use -->
            <div class="lens" role="tablist">
              <button role="tab" :aria-selected="learn.lens === 'life'" :class="{ on: learn.lens === 'life' }" @click="learn.lens = 'life'">🏠 Everyday life</button>
              <button role="tab" :aria-selected="learn.lens === 'dev'" :class="{ on: learn.lens === 'dev' }" @click="learn.lens = 'dev'">👩‍💻 For developers</button>
            </div>

            <div v-if="learn.lens === 'life'" class="life">
              <blockquote class="story">{{ concept.story }}</blockquote>
              <div class="label">Who’s who</div>
              <ul class="mapping">
                <li v-for="([everyday, ai], i) in concept.mapping" :key="everyday" :style="{ animationDelay: `${i * 70}ms` }">
                  <span class="m-life">{{ everyday }}</span>
                  <span class="m-arrow">→</span>
                  <span class="m-ai">{{ ai }}</span>
                </li>
              </ul>
            </div>

            <div v-else class="devlens">
              <div class="known">You already know: <b>{{ concept.dev.known }}</b></div>
              <div class="code-pair">
                <figure>
                  <figcaption>What you write today</figcaption>
                  <pre><code>{{ concept.dev.before }}</code></pre>
                </figure>
                <figure class="ai">
                  <figcaption>With an agent</figcaption>
                  <pre><code>{{ concept.dev.after }}</code></pre>
                </figure>
              </div>
              <div class="same"><b>✅ Same:</b> {{ concept.dev.same }}</div>
              <div class="different">
                <b>🔀 Different:</b>
                <ul>
                  <li v-for="d in concept.dev.different" :key="d">{{ d }}</li>
                </ul>
              </div>
              <div class="qa"><b>🧪 Testing tip:</b> {{ concept.dev.qa }}</div>
            </div>

            <div class="see">
              <span>👀 {{ concept.see }}</span>
              <button v-if="concept.act" :disabled="run.running" @click="tryAct(concept.act)">Pick Act {{ concept.act }} →</button>
            </div>

            <div v-if="comparisonsFor(concept.id).length" class="diff">
              <div class="label">How is it different from…</div>
              <div class="diff-chips">
                <button v-for="c in comparisonsFor(concept.id)" :key="c.id" :style="{ '--c': otherSide(c).color }" @click="openLearn(c.id)">
                  {{ otherSide(c).icon }} {{ otherSide(c).name }}?
                </button>
              </div>
            </div>
          </article>
        </div>

        <!-- ───────── What's the difference? ───────── -->
        <div v-else class="vs">
          <div class="pairs">
            <button v-for="c in COMPARISONS" :key="c.id" :class="{ on: c.id === comparison.id }" @click="learn.topic = c.id">
              {{ conceptById(c.left).icon }} {{ conceptById(c.left).name }} <i>vs</i> {{ conceptById(c.right).icon }} {{ conceptById(c.right).name }}
            </button>
          </div>

          <article :key="comparison.id" class="versus">
            <div class="faceoff">
              <div class="side" :style="{ '--c': left.color }">
                <div class="big">{{ left.icon }}</div>
                <div class="side-name">{{ left.name }}</div>
                <div class="side-like">{{ left.likeIcon }} {{ left.like }}</div>
              </div>
              <div class="vs-badge">VS</div>
              <div class="side" :style="{ '--c': right.color }">
                <div class="big">{{ right.icon }}</div>
                <div class="side-name">{{ right.name }}</div>
                <div class="side-like">{{ right.likeIcon }} {{ right.like }}</div>
              </div>
            </div>
            <div class="tagline">“{{ comparison.tagline }}”</div>

            <div class="rows">
              <template v-for="(r, i) in allRows" :key="r.label">
                <div class="row-label" :style="{ animationDelay: `${i * 70}ms` }">{{ r.label }}</div>
                <div :class="['row', { lead: i < 2 }]" :style="{ animationDelay: `${i * 70}ms` }">
                  <div class="cell" :style="{ '--c': left.color }">{{ r.left }}</div>
                  <div class="cell" :style="{ '--c': right.color }">{{ r.right }}</div>
                </div>
              </template>
            </div>

            <div class="rule">💡 <b>Rule of thumb:</b> {{ comparison.rule }}</div>
            <div class="see">
              <span>👀 {{ comparison.see }}</span>
              <button v-if="comparison.act" :disabled="run.running" @click="tryAct(comparison.act)">Pick Act {{ comparison.act }} →</button>
            </div>
          </article>
        </div>

        <footer>
          <button @click="step(-1)">← Previous</button>
          <span class="keys">← → to move · Esc to close</span>
          <button @click="step(1)">Next →</button>
        </footer>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.backdrop {
  position: fixed;
  inset: 0;
  z-index: 50;
  display: grid;
  place-items: center;
  padding: 16px;
  background: rgb(5 6 12 / 0.65);
  backdrop-filter: blur(3px);
}
.sheet {
  width: min(960px, 100%);
  max-height: min(900px, 100%);
  display: flex;
  flex-direction: column;
  border-radius: 20px;
  background: linear-gradient(160deg, #171a2b, #13151f 60%);
  border: 1px solid var(--border);
  box-shadow: 0 30px 80px rgb(0 0 0 / 0.6);
  overflow: hidden;
}
header { display: flex; align-items: center; gap: 14px; padding: 14px 18px; border-bottom: 1px solid var(--border); flex-wrap: wrap; }
.title { font-weight: 800; font-size: 18px; }
.tabs { display: flex; gap: 4px; padding: 3px; border-radius: 999px; background: var(--panel-2); border: 1px solid var(--border); }
.tabs button { border: none; border-radius: 999px; padding: 6px 14px; background: transparent; font-weight: 600; font-size: 13px; color: var(--muted); }
.tabs button.on { background: var(--accent); color: #fff; }
.close { margin-left: auto; border-radius: 999px; width: 32px; height: 32px; padding: 0; }
.label { font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em; color: var(--muted); font-weight: 700; margin-bottom: 4px; }

/* ── What is…? ── */
.what { display: grid; grid-template-columns: 240px 1fr; min-height: 0; flex: 1; }
nav { display: flex; flex-direction: column; gap: 4px; padding: 12px; border-right: 1px solid var(--border); overflow-y: auto; }
nav button {
  display: flex; align-items: center; gap: 8px; text-align: left;
  border: 1px solid transparent; border-radius: 10px; padding: 8px 10px; background: transparent; font-size: 14px;
}
nav button:hover { background: var(--panel-2); }
nav button.on { background: color-mix(in srgb, var(--c) 18%, var(--panel)); border-color: var(--c); font-weight: 700; }
.nav-icon { font-size: 18px; }
.new { white-space: nowrap; margin-left: auto; font-size: 10px; font-weight: 700; color: var(--c); border: 1px solid var(--c); border-radius: 999px; padding: 0 6px; }

.card { padding: 22px 26px; overflow-y: auto; animation: rise var(--t-med) ease-out; }
.analogy { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
.bubble {
  width: 64px; height: 64px; border-radius: 50%; display: grid; place-items: center; font-size: 34px;
  background: color-mix(in srgb, var(--c) 22%, var(--panel)); border: 2px solid var(--c);
  box-shadow: 0 0 22px color-mix(in srgb, var(--c) 40%, transparent);
}
.bubble.like { background: var(--panel-2); border-style: dashed; animation: wobble 2.4s ease-in-out infinite; }
.approx { font-size: 28px; color: var(--muted); font-weight: 800; }
.analogy-text { margin-left: 6px; flex: 1; min-width: 220px; }
.name { font-size: 26px; font-weight: 800; color: var(--c); }
.like-line { font-size: 17px; margin-top: 2px; }
.think { font-size: 16px; line-height: 1.55; margin: 16px 0 18px; padding-left: 14px; border-left: 3px solid var(--c); color: #dfe3f0; }

/* Lens switch: 🏠 everyday life / 👩‍💻 for developers */
.lens { display: inline-flex; gap: 4px; padding: 3px; border-radius: 12px; background: var(--panel-2); border: 1px solid var(--border); margin-bottom: 12px; }
.lens button { border: none; border-radius: 9px; padding: 7px 14px; font-weight: 700; font-size: 13.5px; background: transparent; color: var(--muted); }
.lens button.on { background: color-mix(in srgb, var(--c) 30%, var(--panel)); color: var(--text); box-shadow: inset 0 0 0 1px var(--c); }
.life, .devlens { animation: rise var(--t-med) ease-out; }
.story {
  margin: 0 0 14px; padding: 14px 16px; border-radius: 14px; font-size: 15px; line-height: 1.6;
  background: color-mix(in srgb, var(--c) 9%, var(--panel)); border: 1px dashed color-mix(in srgb, var(--c) 55%, transparent);
}
.mapping { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 6px; }
.mapping li { display: grid; grid-template-columns: 1fr auto 1fr; gap: 10px; align-items: center; animation: rise var(--t-med) ease-out both; }
.m-life { padding: 7px 12px; border-radius: 10px; background: var(--panel-2); border: 1px solid var(--border); font-size: 13.5px; text-align: right; }
.m-arrow { color: var(--c); font-weight: 900; font-size: 18px; }
.m-ai { padding: 7px 12px; border-radius: 10px; font-size: 13.5px; font-weight: 600; background: color-mix(in srgb, var(--c) 16%, var(--panel)); border: 1px solid color-mix(in srgb, var(--c) 55%, transparent); }
.known { font-size: 16px; margin-bottom: 10px; }
.known b { color: var(--c); }
.code-pair { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
figure { margin: 0; border-radius: 12px; overflow: hidden; border: 1px solid var(--border); background: #0d0f16; }
figcaption { font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em; font-weight: 700; padding: 6px 10px; color: var(--muted); background: var(--panel-2); }
figure.ai { border-color: color-mix(in srgb, var(--c) 60%, transparent); }
figure.ai figcaption { color: var(--c); background: color-mix(in srgb, var(--c) 14%, var(--panel-2)); }
pre { margin: 0; padding: 10px 12px; font-size: 12px; line-height: 1.5; white-space: pre-wrap; overflow-wrap: anywhere; color: #d6dbea; }
.same, .different, .qa { font-size: 14px; line-height: 1.5; margin-top: 10px; }
.different ul { margin: 4px 0 0; padding-left: 20px; }
.different li { margin: 3px 0; }
.qa { padding: 9px 12px; border-radius: 10px; background: color-mix(in srgb, var(--c-tool_result) 10%, var(--panel)); border: 1px solid color-mix(in srgb, var(--c-tool_result) 40%, transparent); }
.see { display: flex; align-items: center; gap: 12px; margin-top: 14px; font-size: 13.5px; color: #c9cede; flex-wrap: wrap; }
.see span { flex: 1; min-width: 200px; }
.see button { border-radius: 999px; padding: 6px 14px; font-weight: 700; background: color-mix(in srgb, var(--accent) 25%, var(--panel)); border-color: var(--accent); }
.diff { margin-top: 18px; }
.diff-chips { display: flex; gap: 8px; flex-wrap: wrap; }
.diff-chips button { border-radius: 999px; padding: 6px 12px; border-color: color-mix(in srgb, var(--c) 60%, transparent); background: color-mix(in srgb, var(--c) 10%, var(--panel)); }
.diff-chips button:hover { background: color-mix(in srgb, var(--c) 25%, var(--panel)); }

/* ── What's the difference? ── */
.vs { display: flex; flex-direction: column; min-height: 0; flex: 1; }
.pairs { display: flex; flex-wrap: wrap; justify-content: center; gap: 6px; padding: 12px 18px; border-bottom: 1px solid var(--border); flex-shrink: 0; }
.pairs button { white-space: nowrap; border-radius: 999px; padding: 6px 12px; font-size: 13px; }
.pairs button i { color: var(--muted); font-style: normal; font-size: 11px; margin: 0 3px; }
.pairs button.on { background: color-mix(in srgb, var(--accent) 25%, var(--panel)); border-color: var(--accent); font-weight: 700; }
.versus { padding: 14px 24px 18px; overflow-y: auto; animation: rise var(--t-med) ease-out; }
.faceoff { display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; gap: 14px; }
.side {
  text-align: center; padding: 10px 14px; border-radius: 16px;
  background: color-mix(in srgb, var(--c) 14%, var(--panel)); border: 2px solid color-mix(in srgb, var(--c) 70%, transparent);
}
.side:first-child { animation: from-left var(--t-med) ease-out; }
.side:last-child { animation: from-right var(--t-med) ease-out; }
.big { font-size: 30px; line-height: 1.1; }
.side-name { font-size: 20px; font-weight: 800; color: var(--c); }
.side-like { font-size: 13px; color: #c9cede; margin-top: 4px; }
.vs-badge {
  width: 48px; height: 48px; border-radius: 50%; display: grid; place-items: center; font-weight: 900;
  background: linear-gradient(135deg, var(--accent), var(--c-skill)); color: #fff; box-shadow: 0 0 20px rgb(124 140 255 / 0.5);
  animation: pop var(--t-med) ease-out;
}
.tagline { text-align: center; font-size: 17px; font-style: italic; margin: 10px 0 4px; color: #dfe3f0; }
.rows { display: flex; flex-direction: column; gap: 4px; }
.row-label { text-align: center; font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em; color: var(--muted); font-weight: 700; margin-top: 4px; animation: rise var(--t-med) ease-out both; }
.row { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; animation: rise var(--t-med) ease-out both; }
.cell { padding: 6px 12px; border-radius: 10px; font-size: 14px; line-height: 1.4; background: var(--panel-2); border-left: 4px solid var(--c); }
.row .cell:first-child { text-align: right; border-left: none; border-right: 4px solid var(--c); }
.row.lead .cell { background: color-mix(in srgb, var(--c) 12%, var(--panel)); font-weight: 600; }
.rule {
  margin-top: 12px; padding: 12px 14px; border-radius: 12px; font-size: 15px; line-height: 1.45;
  background: color-mix(in srgb, var(--c-tool_use) 12%, var(--panel)); border: 1px solid color-mix(in srgb, var(--c-tool_use) 50%, transparent);
}

footer { display: flex; align-items: center; justify-content: space-between; padding: 10px 18px; border-top: 1px solid var(--border); }
.keys { font-size: 12px; color: var(--muted); }

.sheet-enter-active, .sheet-leave-active { transition: opacity var(--t-fast); }
.sheet-enter-active .sheet { transition: transform var(--t-med) cubic-bezier(0.2, 1.3, 0.4, 1); }
.sheet-enter-from, .sheet-leave-to { opacity: 0; }
.sheet-enter-from .sheet { transform: scale(0.92) translateY(14px); }
@keyframes rise { from { opacity: 0; transform: translateY(8px); } }
@keyframes from-left { from { opacity: 0; transform: translateX(-24px); } }
@keyframes from-right { from { opacity: 0; transform: translateX(24px); } }
@keyframes pop { 0% { transform: scale(0); } 70% { transform: scale(1.2); } }
@keyframes wobble { 50% { transform: rotate(-6deg) scale(1.05); } }

@media (max-width: 700px) {
  .what { grid-template-columns: 1fr; }
  nav { flex-direction: row; overflow-x: auto; border-right: none; border-bottom: 1px solid var(--border); }
  nav button { white-space: nowrap; }
  .card, .versus { padding: 16px; }
  .faceoff { grid-template-columns: 1fr; }
  .vs-badge { margin: 0 auto; }
  .row, .code-pair { grid-template-columns: 1fr; }
  .mapping li { grid-template-columns: 1fr; gap: 2px; }
  .m-life { text-align: left; }
  .m-arrow { display: none; }
  .row .cell:first-child { text-align: left; border-right: none; border-left: 4px solid var(--c); }
}
</style>
