<script setup lang="ts">
// Human in the loop: a PreToolUse hook said "ask". The agent loop is frozen until someone decides.
import { computed } from 'vue';
import { useRunStore } from '../stores/run';

const run = useRunStore();
const pending = computed(() => run.pendingApproval);
const replaying = computed(() => run.mode === 'replay');

function decide(approved: boolean) {
  if (!pending.value || replaying.value) return;
  run.approve(pending.value.toolUseId, approved);
}
</script>

<template>
  <Transition name="modal">
    <div v-if="pending" class="backdrop">
      <div class="modal" role="dialog" aria-modal="true">
        <div class="shield">🛡️</div>
        <h2>Approval needed</h2>
        <p class="sub">A <b>PreToolUse hook</b> stopped this tool call before it ran.</p>
        <div class="row"><span>Tool</span><code>{{ pending.tool }}</code></div>
        <div class="row"><span>Reason</span><span>{{ pending.reason }}</span></div>
        <pre>{{ JSON.stringify(pending.input, null, 2) }}</pre>
        <div class="actions">
          <button class="deny" :disabled="replaying" @click="decide(false)">✗ Deny</button>
          <button class="approve" :disabled="replaying" @click="decide(true)">✓ Approve</button>
        </div>
        <p v-if="replaying" class="note">Replay: the recorded decision will play back.</p>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.backdrop { position: fixed; inset: 0; background: rgb(0 0 0 / 0.55); display: grid; place-items: center; z-index: 50; }
.modal {
  width: min(520px, calc(100vw - 32px));
  background: var(--panel);
  border: 2px solid var(--c-tool_use);
  border-radius: 14px;
  padding: 22px 24px;
  box-shadow: 0 20px 60px rgb(0 0 0 / 0.5);
}
.shield { font-size: 40px; }
h2 { margin: 4px 0 2px; }
.sub { color: var(--muted); margin: 0 0 14px; }
.row { display: flex; gap: 12px; margin: 6px 0; }
.row > span:first-child { color: var(--muted); width: 60px; flex-shrink: 0; }
pre { background: var(--panel-2); padding: 10px; border-radius: 8px; font-size: 13px; }
.actions { display: flex; gap: 10px; justify-content: flex-end; margin-top: 14px; }
.actions button { padding: 10px 18px; font-size: 15px; font-weight: 600; }
.approve { background: var(--c-assistant); border-color: var(--c-assistant); color: #0d0f14; }
.deny { border-color: var(--c-error); color: var(--c-error); }
.note { color: var(--muted); font-size: 12px; text-align: right; margin: 8px 0 0; }
.modal-enter-from, .modal-leave-to { opacity: 0; }
.modal-enter-from .modal { transform: scale(0.92) translateY(10px); }
.modal-enter-active, .modal-leave-active { transition: opacity var(--t-med); }
.modal-enter-active .modal { transition: transform var(--t-med) ease-out; }
</style>
