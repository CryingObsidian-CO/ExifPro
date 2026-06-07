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
      input.value = value.value as string;
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
      class="win-input glass-input"
  />
</template>

<style scoped>
.win-input {
  width: 100%;
  padding: 7px var(--prim-space-3);
  border-radius: var(--prim-radius-md);
  font-size: var(--prim-font-size-base);
  outline: none;
}

.win-input::placeholder {
  color: var(--input-placeholder);
}

.win-input:disabled,
.win-input:read-only {
  opacity: 0.5;
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