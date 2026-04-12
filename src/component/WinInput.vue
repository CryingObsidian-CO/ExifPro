<script setup lang="ts">
import {computed} from "vue";

const props = defineProps<{
  modelValue: string | number;
  type?: 'text' | 'number' | 'password';
  placeholder?: string;
  disabled?: boolean;
  readonly?: boolean;
}>();
const emit = defineEmits<{
  (e: 'update:modelValue', value: string | number): void;
}>();

const value = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val),
});
</script>

<template>
  <input
      :type="type || 'text'"
      :value="value"
      :placeholder="placeholder"
      :disabled="disabled"
      :readonly="readonly"
      @input="(e) => (value = (e.target as HTMLInputElement).value)"
      class="win-input"
  />
</template>

<style scoped>
.win-input {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid var(--color-border);
  border-radius: var(--border-radius);
  background-color: var(--color-bg-secondary);
  color: var(--color-text);
  font-size: 14px;
  transition: all var(--transition-fast);
  outline: none;
}

.win-input:hover:not(:disabled):not(:read-only) {
  border-color: var(--color-border-hover);
}

.win-input:focus:not(:disabled):not(:read-only) {
  border-color: var(--color-accent);
  box-shadow: 0 0 0 2px var(--color-accent-light);
}

.win-input:disabled,
.win-input:read-only {
  opacity: 0.6;
  cursor: not-allowed;
}
</style>