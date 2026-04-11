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
  gap: 8px;
  border-radius: var(--border-radius);
  border: 1px solid transparent;
  transition: all var(--transition-fast);
  font-weight: 500;
  user-select: none;
}

.win-button:not(.disabled):hover {
  transform: translateY(-1px);
}

.win-button:not(.disabled):active {
  transform: translateY(0);
}

.win-button.size-small {
  padding: 4px 12px;
  font-size: 13px;
}

.win-button.size-medium {
  padding: 8px 16px;
  font-size: 14px;
}

.win-button.size-large {
  padding: 12px 24px;
  font-size: 15px;
}

.win-button.full-width {
  width: 100%;
}

.win-button.variant-primary {
  background-color: var(--color-accent);
  color: white;
}

.win-button.variant-primary:not(.disabled):hover {
  background-color: var(--color-accent-hover);
  box-shadow: var(--shadow-md);
}

.win-button.variant-secondary {
  background-color: var(--color-bg-secondary);
  border-color: var(--color-border);
  color: var(--color-text);
}

.win-button.variant-secondary:not(.disabled):hover {
  background-color: var(--color-bg-tertiary);
  border-color: var(--color-border-hover);
}

.win-button.variant-danger {
  background-color: var(--color-error);
  color: white;
}

.win-button.variant-danger:not(.disabled):hover {
  filter: brightness(1.1);
  box-shadow: var(--shadow-md);
}

.win-button.variant-ghost {
  background-color: transparent;
  color: var(--color-text);
}

.win-button.variant-ghost:not(.disabled):hover {
  background-color: var(--color-bg-tertiary);
}

.win-button.disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>