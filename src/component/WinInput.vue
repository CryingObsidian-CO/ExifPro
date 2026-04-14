<script setup lang="ts">
import {computed} from "vue";

const props = defineProps<{
  modelValue: string | number;
  type?: 'text' | 'number' | 'password';
  placeholder?: string;
  disabled?: boolean;
  readonly?: boolean;
  step?: string | number;
  min?: string | number;
  max?: string | number;
  integerOnly?: boolean;
  allowNegativeOne?: boolean;
}>();
const emit = defineEmits<{
  (e: 'update:modelValue', value: string | number): void;
}>();

const value = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val),
});

const handleInput = (e: Event) => {
  const input = e.target as HTMLInputElement;
  if (!input) {
    return;
  }

  let nextValue = input.value.trim();
  if (props.type === 'number' && props.integerOnly) {
    // 整数正则：允许空、负数、0，不允许小数点
    const integerReg = /^-?\d*$/;
    if (!integerReg.test(nextValue)) {
      return;
    }
  }
  if (props.type === 'number' && nextValue !== '') {
    const num = parseFloat(nextValue);
    // 限制 min
    if (props.min !== undefined && num < parseFloat(props.min as string)) {
      if (props.allowNegativeOne && num == -1) {
        nextValue = "-1";
      } else {
        nextValue = String(props.min);
      }
    }
    // 限制 max
    if (props.max !== undefined && num > parseFloat(props.max as string)) {
      nextValue = String(props.max);
    }
  }
  input.value = nextValue;
  value.value = nextValue;
};
</script>

<template>
  <input
      :type="type || 'text'"
      :value="value"
      :placeholder="placeholder"
      :disabled="disabled"
      :readonly="readonly"
      :step="step"
      :min="min"
      :max="max"
      @blur="handleInput"
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

[data-theme='light'] .win-input[type='number'] {
  color-scheme: light;
}

[data-theme='dark'] .win-input[type='number'] {
  color-scheme: dark;
}

.win-input::-webkit-outer-spin-button,
.win-input::-webkit-inner-spin-button {
  opacity: 0.85;
}


</style>
