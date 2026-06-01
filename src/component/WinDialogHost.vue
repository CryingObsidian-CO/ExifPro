<script setup lang="ts">
import {computed} from "vue";
import WinButton from "./WinButton.vue";
import {useDialogState} from "../composables/dialog.ts";
import IconInfo from "./icons/IconInfo.vue";
import IconCheck from "./icons/IconCheck.vue";
import IconWarning from "./icons/IconWarning.vue";
import IconError from "./icons/IconError.vue";

const {dialogState, confirmDialog, cancelDialog, closeByOverlay} = useDialogState();

const toneIcon = computed(() => {
  switch (dialogState.tone) {
    case "success":
      return IconCheck;
    case "warning":
      return IconWarning;
    case "error":
      return IconError;
    default:
      return IconInfo;
  }
});

const confirmVariant = computed(() => (dialogState.tone === "error" ? "danger" : "primary"));
</script>

<template>
  <Teleport to="body">
    <div v-if="dialogState.visible" class="dialog-overlay glass-overlay"
         @click.self="closeByOverlay">
      <div class="dialog-panel glass-dialog anim-scale-in" role="dialog" aria-modal="true">
        <div class="dialog-header">
          <div class="dialog-icon" :class="`tone-${dialogState.tone}`">
            <component :is="toneIcon" :size="20"/>
          </div>
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
  z-index: var(--prim-z-modal);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--prim-space-4);
}

.dialog-panel {
  width: min(440px, 100%);
  padding: var(--prim-space-5);
}

.dialog-header {
  display: flex;
  align-items: center;
  gap: var(--prim-space-3);
  margin-bottom: var(--prim-space-3);
}

.dialog-header h3 {
  font-size: var(--prim-font-size-lg);
  font-weight: var(--prim-font-weight-semibold);
  color: var(--color-text-primary);
}

.dialog-icon {
  width: 32px;
  height: 32px;
  border-radius: var(--prim-radius-full);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.dialog-icon.tone-info {
  color: var(--color-info);
  background: var(--color-info-light);
}

.dialog-icon.tone-success {
  color: var(--color-success);
  background: var(--color-success-light);
}

.dialog-icon.tone-warning {
  color: var(--color-warning);
  background: var(--color-warning-light);
}

.dialog-icon.tone-error {
  color: var(--color-danger);
  background: var(--color-danger-light);
}

.dialog-message {
  color: var(--color-text-secondary);
  line-height: var(--prim-line-height-relaxed);
  margin-bottom: var(--prim-space-5);
  font-size: var(--prim-font-size-base);
}

.dialog-actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--prim-space-2);
}
</style>