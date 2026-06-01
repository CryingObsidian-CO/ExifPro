<script setup lang="ts">
import {computed} from "vue";

const props = defineProps<{
  modelValue: boolean;
  label?: string;
  disabled?: boolean;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void;
}>();

const checked = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val),
});
</script>

<template>
  <label class="win-checkbox" :class="{ disabled }">
    <input
        type="checkbox"
        :checked="checked"
        :disabled="disabled"
        @change="(e) => (checked = (e.target as HTMLInputElement).checked)"
    />
    <span class="checkbox-box">
      <svg v-if="checked" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
        <polyline points="20 6 9 17 4 12"></polyline>
      </svg>
    </span>
    <span v-if="label" class="checkbox-label">{{ label }}</span>
  </label>
</template>

<style scoped>
.win-checkbox {
  display: inline-flex;
  align-items: center;
  gap: var(--prim-space-2);
  cursor: pointer;
  user-select: none;
  position: relative;
}

.win-checkbox.disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.win-checkbox input {
  position: absolute;
  opacity: 0;
  pointer-events: none;
}

.checkbox-box {
  width: 16px;
  height: 16px;
  border: 1.5px solid var(--color-border-default);
  border-radius: var(--prim-radius-xs);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all var(--prim-duration-fast) var(--prim-ease-out);
  flex-shrink: 0;
  background: var(--color-glass-bg);
}

.win-checkbox:not(.disabled):hover .checkbox-box {
  border-color: var(--color-border-strong);
}

.win-checkbox input:checked + .checkbox-box {
  background: var(--color-brand);
  border-color: var(--color-brand);
}

.checkbox-box svg {
  width: 12px;
  height: 12px;
  color: var(--color-text-inverse);
}

.checkbox-label {
  color: var(--color-text-primary);
  font-size: var(--prim-font-size-base);
}
</style>