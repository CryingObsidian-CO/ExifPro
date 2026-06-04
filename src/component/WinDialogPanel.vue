<script setup lang="ts">
import {ref, watch, nextTick} from "vue";
import WinButton from "./WinButton.vue";
import IconClose from "./icons/IconClose.vue";

const props = defineProps<{
  visible: boolean;
  title: string;
  closeOnOverlay?: boolean;
}>();
const emit = defineEmits<{
  (e: 'close'): void;
}>();

const panelRef = ref<HTMLElement | null>(null);
let lastFocusedElement: HTMLElement | null = null;

function close() {
  emit('close');
}

function getFocusableElements(): HTMLElement[] {
  const panel = panelRef.value;
  if (!panel) return [];
  const selectors = [
    'button:not([disabled])',
    'input:not([disabled]):not([type="hidden"])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    '[tabindex]:not([tabindex="-1"])',
  ];
  return Array.from(panel.querySelectorAll<HTMLElement>(selectors.join(','))).filter((el) => {
    const style = getComputedStyle(el);
    return style.display !== 'none' && style.visibility !== 'hidden' && el.offsetParent !== null;
  });
}

function handleKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    close();
    return;
  }
  if (event.key !== 'Tab') return;
  const focusable = getFocusableElements();
  if (focusable.length === 0) return;
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  const active = document.activeElement;
  if (event.shiftKey) {
    if (active === first || !panelRef.value?.contains(active)) {
      event.preventDefault();
      last.focus();
    }
  } else {
    if (active === last || !panelRef.value?.contains(active)) {
      event.preventDefault();
      first.focus();
    }
  }
}

watch(() => props.visible, async (visible) => {
  if (visible) {
    lastFocusedElement = document.activeElement as HTMLElement | null;
    await nextTick();
    const focusable = getFocusableElements();
    if (focusable.length > 0) {
      focusable[focusable.length - 1].focus();
    } else {
      panelRef.value?.focus();
    }
  } else {
    if (lastFocusedElement && typeof lastFocusedElement.focus === 'function') {
      lastFocusedElement.focus();
    }
    lastFocusedElement = null;
  }
});
</script>

<template>
  <Teleport to="body">
    <div v-if="visible" class="win-dialog-overlay glass-overlay"
         @click.self="close">
      <div class="win-dialog-panel glass-dialog anim-scale-in"
           role="dialog"
           aria-modal="true"
           ref="panelRef"
           tabindex="-1"
           @keydown="handleKeydown">
        <div class="win-dialog-header">
          <h3>{{ title }}</h3>
          <WinButton variant="secondary" size="small" @click="close">
            <IconClose :size="16"/>
          </WinButton>
        </div>
        <div class="win-dialog-body">
          <slot/>
        </div>
        <div v-if="$slots.actions" class="win-dialog-actions">
          <slot name="actions"/>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.win-dialog-overlay {
  position: fixed;
  inset: 0;
  z-index: var(--prim-z-modal);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--prim-space-4);
}

.win-dialog-panel {
  width: min(400px, 100%);
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.win-dialog-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--prim-space-4) var(--prim-space-5);
  border-bottom: 1px solid var(--color-glass-border);
}

.win-dialog-header h3 {
  font-size: var(--prim-font-size-md);
  font-weight: var(--prim-font-weight-semibold);
}

.win-dialog-body {
  padding: var(--prim-space-3) var(--prim-space-5);
  overflow-y: auto;
  flex: 1;
}

.win-dialog-actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--prim-space-2);
  padding: var(--prim-space-3) var(--prim-space-5);
  border-top: 1px solid var(--color-glass-border);
}
</style>
