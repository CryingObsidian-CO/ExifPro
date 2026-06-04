<script setup lang="ts">
import {computed, ref, watch, nextTick} from "vue";
import WinButton from "./WinButton.vue";
import {useDialogState} from "../composables/dialog.ts";
import IconInfo from "./icons/IconInfo.vue";
import IconCheck from "./icons/IconCheck.vue";
import IconWarning from "./icons/IconWarning.vue";
import IconError from "./icons/IconError.vue";

const {dialogState, confirmDialog, cancelDialog, closeByOverlay} = useDialogState();

const dialogPanelRef = ref<HTMLElement | null>(null);
let lastFocusedElement: HTMLElement | null = null;

function getFocusableElements(): HTMLElement[] {
  const panel = dialogPanelRef.value;
  if (!panel) return [];
  const selectors = [
    'button:not([disabled])',
    'input:not([disabled]):not([type="hidden"])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    '[tabindex]:not([tabindex="-1"])',
  ];
  const elements = panel.querySelectorAll<HTMLElement>(selectors.join(','));
  return Array.from(elements).filter((el) => {
    const style = getComputedStyle(el);
    return style.display !== 'none' && style.visibility !== 'hidden' && el.offsetParent !== null;
  });
}

function handleDialogKeydown(event: KeyboardEvent) {
  if (event.key !== 'Tab') return;

  const focusable = getFocusableElements();
  if (focusable.length === 0) return;

  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  const active = document.activeElement;

  if (event.shiftKey) {
    if (active === first || !panelContainsActive()) {
      event.preventDefault();
      last.focus();
    }
  } else {
    if (active === last || !panelContainsActive()) {
      event.preventDefault();
      first.focus();
    }
  }
}

function panelContainsActive(): boolean {
  const panel = dialogPanelRef.value;
  if (!panel) return false;
  return panel.contains(document.activeElement);
}

watch(() => dialogState.visible, async (visible) => {
  if (visible) {
    lastFocusedElement = document.activeElement as HTMLElement | null;
    await nextTick();
    const focusable = getFocusableElements();
    if (focusable.length > 0) {
      const isDestructive = dialogState.tone === 'error' || dialogState.tone === 'warning';
      const targetIndex = isDestructive ? 0 : focusable.length - 1;
      focusable[targetIndex].focus();
    } else {
      dialogPanelRef.value?.focus();
    }
  } else {
    if (lastFocusedElement && typeof lastFocusedElement.focus === 'function') {
      lastFocusedElement.focus();
    }
    lastFocusedElement = null;
  }
});

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
      <div class="dialog-panel glass-dialog anim-scale-in"
           role="dialog"
           aria-modal="true"
           ref="dialogPanelRef"
           tabindex="-1"
           @keydown="handleDialogKeydown">
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