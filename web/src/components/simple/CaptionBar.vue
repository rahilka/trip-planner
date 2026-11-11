<script setup lang="ts">
// Subtitles for the show: one plain sentence about the latest step.
import { useFlowStore } from '../../stores/flow';

const flow = useFlowStore();
</script>

<template>
  <div class="captions">
    <Transition name="sub" mode="out-in">
      <div v-if="flow.caption" :key="flow.caption.step + flow.caption.text" class="sub">
        <span class="step">Step {{ flow.caption.step }}</span>
        <span class="icon">{{ flow.caption.icon }}</span>
        <span class="text">{{ flow.caption.text }}</span>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.captions { position: absolute; left: 50%; bottom: 18px; transform: translateX(-50%); width: min(980px, calc(100% - 32px)); z-index: 6; pointer-events: none; display: flex; justify-content: center; }
.sub {
  display: flex;
  gap: 10px;
  align-items: center;
  padding: 10px 16px;
  border-radius: 14px;
  background: rgb(10 12 18 / 0.88);
  border: 1px solid var(--border);
  box-shadow: 0 10px 30px rgb(0 0 0 / 0.45);
  font-size: 16px;
  line-height: 1.35;
  max-width: 100%;
}
.step { flex-shrink: 0; font-size: 11px; font-weight: 800; letter-spacing: 0.06em; text-transform: uppercase; padding: 3px 8px; border-radius: 999px; background: var(--accent); color: #0d0f14; }
.icon { font-size: 20px; }
.text { overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; line-clamp: 2; -webkit-box-orient: vertical; }
.sub-enter-from { opacity: 0; transform: translateY(10px); }
.sub-leave-to { opacity: 0; transform: translateY(-6px); }
.sub-enter-active, .sub-leave-active { transition: all 0.25s ease; }
</style>
