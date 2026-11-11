<script setup lang="ts">
// The raw material: the full text of a context block, or exactly what the model is told about each tool.
import { computed } from 'vue';
import { useRunStore } from '../stores/run';

const run = useRunStore();
const open = computed(() => Boolean(run.inspector));
const agent = computed(() => run.selectedAgent);
const close = () => (run.inspector = undefined);
</script>

<template>
  <Transition name="drawer">
    <aside v-if="open" class="drawer" @keydown.esc="close">
      <header>
        <div class="tabs">
          <button v-if="run.inspector?.kind === 'block'" class="on">Block</button>
          <button :class="{ on: run.inspector?.kind === 'tools' }" @click="run.inspector = { kind: 'tools' }">
            Tools of {{ agent?.role ?? '…' }}
          </button>
        </div>
        <button @click="close">✕</button>
      </header>

      <div v-if="run.inspector?.kind === 'block'" class="content">
        <div :class="['kind', run.inspector.block.kind]">{{ run.inspector.block.kind }} · {{ run.inspector.block.label }}</div>
        <div class="tokens">≈ {{ run.inspector.block.tokens.toLocaleString() }} tokens (chars ÷ 4)</div>
        <pre>{{ run.inspector.block.content }}</pre>
      </div>

      <div v-else class="content">
        <p class="hint">This is <b>all</b> the model knows about its tools: a name, a description and a JSON schema.</p>
        <p v-if="!agent?.tools.length" class="hint">This agent has no tools. It can only answer from what it already knows.</p>
        <article v-for="t in agent?.tools ?? []" :key="t.name" class="tool">
          <div class="tool-head">
            <code class="name">{{ t.name }}</code>
            <span v-if="t.source === 'mcp'" class="chip mcp">MCP</span>
          </div>
          <p class="desc">{{ t.description }}</p>
          <pre>{{ JSON.stringify(t.input_schema, null, 2) }}</pre>
        </article>
      </div>
    </aside>
  </Transition>
</template>

<style scoped>
.drawer {
  position: fixed;
  top: 0;
  right: 0;
  bottom: 0;
  width: min(560px, 100vw);
  background: var(--panel);
  border-left: 1px solid var(--border);
  box-shadow: -20px 0 50px rgb(0 0 0 / 0.4);
  z-index: 45;
  display: flex;
  flex-direction: column;
}
header { display: flex; justify-content: space-between; align-items: center; padding: 10px 14px; border-bottom: 1px solid var(--border); }
.tabs { display: flex; gap: 6px; }
.tabs .on { background: var(--accent); color: #0d0f14; border-color: var(--accent); }
.content { padding: 14px; overflow-y: auto; flex: 1; }
.kind { font-weight: 700; text-transform: capitalize; }
.kind.system { color: var(--c-system); }
.kind.user { color: var(--c-user); }
.kind.assistant { color: var(--c-assistant); }
.kind.tool_use { color: var(--c-tool_use); }
.kind.tool_result { color: var(--c-tool_result); }
.kind.skill_stub, .kind.skill_full { color: var(--c-skill); }
.tokens { color: var(--muted); font-size: 12px; margin-bottom: 8px; }
pre { white-space: pre-wrap; word-break: break-word; font-size: 12.5px; line-height: 1.45; background: var(--panel-2); padding: 12px; border-radius: 8px; margin: 0; }
.hint { color: var(--muted); margin-top: 0; }
.tool { border: 1px solid var(--border); border-radius: 10px; padding: 10px; margin-bottom: 10px; }
.tool-head { display: flex; gap: 8px; align-items: center; }
.name { font-size: 15px; color: var(--c-tool_use); }
.mcp { color: var(--c-mcp); }
.desc { margin: 6px 0 8px; }
.drawer-enter-from, .drawer-leave-to { transform: translateX(100%); }
.drawer-enter-active, .drawer-leave-active { transition: transform var(--t-med) ease; }
</style>
