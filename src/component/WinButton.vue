<script setup lang="ts">
import {PropType} from "vue";

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';

defineProps({
  variant: {
    type: String as PropType<ButtonVariant>,
    default: 'secondary',
  },
  disabled: {
    type: Boolean,
    default: false,
  },
  fullWidth: {
    type: Boolean,
    default: false,
  },
  size: {
    type: String as PropType<'small' | 'medium' | 'large'>,
    default: 'medium',
  },
});
</script>

<template>
  <button
      class="win-button"
      :class="[
      `variant-${variant}`,
      `size-${size}`,
      { 'full-width': fullWidth, disabled }
    ]"
      :disabled="disabled"
  >
    <slot></slot>
  </button>
</template>

<style scoped>
.win-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--prim-space-2);
  border-radius: var(--prim-radius-md);
  border: 1px solid transparent;
  font-weight: var(--prim-font-weight-medium);
  user-select: none;
  transition: all var(--prim-duration-fast) var(--prim-ease-out);
  cursor: pointer;
}

.win-button.size-small {
  padding: 4px var(--prim-space-3);
  font-size: var(--prim-font-size-sm);
  border-radius: var(--prim-radius-sm);
}

.win-button.size-medium {
  padding: 7px var(--prim-space-4);
  font-size: var(--prim-font-size-base);
}

.win-button.size-large {
  padding: 9px var(--prim-space-5);
  font-size: var(--prim-font-size-md);
}

.win-button.full-width {
  width: 100%;
}

.win-button.variant-primary {
  background: var(--btn-primary-bg);
  color: var(--btn-primary-text);
}

.win-button.variant-primary:not(.disabled):hover {
  background: var(--btn-primary-bg-hover);
}

.win-button.variant-primary:not(.disabled):active {
  background: var(--btn-primary-bg-active);
  transform: scale(0.985);
}

.win-button.variant-secondary {
  background: var(--btn-secondary-bg);
  border-color: var(--btn-secondary-border);
  color: var(--btn-secondary-text);
  backdrop-filter: blur(var(--prim-glass-blur-sm));
  -webkit-backdrop-filter: blur(var(--prim-glass-blur-sm));
}

.win-button.variant-secondary:not(.disabled):hover {
  background: var(--btn-secondary-bg-hover);
  border-color: var(--color-border-strong);
}

.win-button.variant-secondary:not(.disabled):active {
  background: var(--color-glass-bg-active);
  transform: scale(0.985);
}

.win-button.variant-danger {
  background: var(--btn-danger-bg);
  color: var(--btn-danger-text);
}

.win-button.variant-danger:not(.disabled):hover {
  background: var(--btn-danger-bg-hover);
}

.win-button.variant-danger:not(.disabled):active {
  transform: scale(0.985);
}

.win-button.variant-ghost {
  background: transparent;
  color: var(--btn-ghost-text);
}

.win-button.variant-ghost:not(.disabled):hover {
  background: var(--btn-ghost-bg-hover);
}

.win-button.disabled {
  opacity: var(--btn-disabled-opacity);
  cursor: not-allowed;
}
</style>