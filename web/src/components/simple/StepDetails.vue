<script setup lang="ts">
// Click a box in the flowchart to see exactly what went in and what came out.
import { useFlowStore } from '../../stores/flow';
import CodeRefs from './CodeRefs.vue';

const flow = useFlowStore();
const show = (value: unknown) => (typeof value === 'string' ? value : JSON.stringify(value, null, 2));
</script>

<template>
  <Transition name="slide">
    <aside v-if="flow.selected" class="details">
      <header>
        <span class="icon">{{ flow.selected.data?.icon }}</span>
        <b>{{ flow.selected.data?.title }}</b>
        <button @click="flow.selectedId = ''">✕</button>
      </header>
      <section v-if="flow.selected.data?.code?.length" class="code-section">
        <h4>📂 Where this happens in the code</h4>
        <CodeRefs :keys="flow.selected.data.code" compact />
      </section>
      <section v-for="d in flow.selected.data?.details" :key="d.label">
        <h4>{{ d.label }}</h4>
        <pre>{{ show(d.value) }}</pre>
      </section>
    </aside>
  </Transition>
</template>

<style scoped>
.details {
  position: absolute;
  top: 12px;
  right: 12px;
  bottom: 12px;
  width: min(440px, calc(100% - 24px));
  background: var(--panel);
  border: 1px solid var(--border);
  border-radius: 12px;
  box-shadow: 0 10px 40px rgb(0 0 0 / 0.45);
  overflow-y: auto;
  z-index: 10;
}
header { display: flex; gap: 8px; align-items: center; padding: 10px 12px; border-bottom: 1px solid var(--border); position: sticky; top: 0; background: var(--panel); }
header b { flex: 1; }
.icon { font-size: 18px; }
section { padding: 4px 12px 8px; }
.code-section { padding-bottom: 12px; border-bottom: 1px solid var(--border); }
h4 { margin: 8px 0 4px; font-size: 12px; color: var(--muted); font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; }
pre { margin: 0; white-space: pre-wrap; word-break: break-word; font-size: 12.5px; line-height: 1.45; background: var(--panel-2); padding: 10px; border-radius: 8px; }
.slide-enter-from, .slide-leave-to { opacity: 0; transform: translateX(20px); }
.slide-enter-active, .slide-leave-active { transition: all var(--t-fast) ease; }
</style>
