<script setup lang="ts">
import {computed} from "vue";
import WinButton from "./WinButton.vue";
import {useDialogState} from "../composables/dialog.ts";

const {dialogState, confirmDialog, cancelDialog, closeByOverlay} = useDialogState();

const toneIcon = computed(() => {
  switch (dialogState.tone) {
    case "success":
      return "✓";
    case "warning":
      return "!";
    case "error":
      return "×";
    default:
      return "i";
  }
});

const confirmVariant = computed(() => (dialogState.tone === "error" ? "danger" : "primary"));
</script>

<template>
  <Teleport to="body">
    <div v-if="dialogState.visible" class="dialog-overlay" @click.self="closeByOverlay">
      <div class="dialog-panel" role="dialog" aria-modal="true">
        <div class="dialog-header">
          <div class="dialog-icon" :class="`tone-${dialogState.tone}`">{{ toneIcon }}</div>
          <h3>{{ dialogState.title }}</h3>
        </div>
        <p class="dialog-message">{{ dialogState.message }}</p>
        <div class="dialog-actions">
          <WinButton v-if="dialogState.mode === 'confirm'" variant="secondary"
                     @click="cancelDialog">
            {{ dialogState.cancelText }}
          </WinButton>
          <WinButton :variant="confirmVariant" @click="confirmDialog">
            {{ dialogState.confirmText }}
          </WinButton>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.dialog-overlay {
  position: fixed;
  inset: 0;
  z-index: 2000;
  background-color: rgba(0, 0, 0, 0.35);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
}

.dialog-panel {
  width: min(460px, 100%);
  background-color: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  border-radius: var(--border-radius);
  box-shadow: var(--shadow-lg);
  padding: 18px;
}

.dialog-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 12px;
}

.dialog-header h3 {
  font-size: 17px;
  font-weight: 600;
  color: var(--color-text);
}

.dialog-icon {
  width: 24px;
  height: 24px;
  border-radius: 999px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 14px;
}

.dialog-icon.tone-info {
  color: var(--color-accent);
  background-color: var(--color-accent-light);
}

.dialog-icon.tone-success {
  color: var(--color-success);
  background-color: rgba(16, 124, 16, 0.16);
}

.dialog-icon.tone-warning {
  color: var(--color-warning);
  background-color: rgba(255, 140, 0, 0.16);
}

.dialog-icon.tone-error {
  color: var(--color-error);
  background-color: rgba(209, 52, 56, 0.16);
}

.dialog-message {
  color: var(--color-text);
  line-height: 1.6;
  margin-bottom: 16px;
  white-space: pre-wrap;
}

.dialog-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}
</style>


