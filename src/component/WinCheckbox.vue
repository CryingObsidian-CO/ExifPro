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
  gap: 8px;
  cursor: pointer;
  user-select: none;
}

.win-checkbox.disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.win-checkbox input {
  position: absolute;
  opacity: 0;
  pointer-events: none;
}

.checkbox-box {
  width: 18px;
  height: 18px;
  border: 2px solid var(--color-border);
  border-radius: var(--border-radius-sm);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all var(--transition-fast);
  flex-shrink: 0;
}

.win-checkbox:not(.disabled):hover .checkbox-box {
  border-color: var(--color-border-hover);
}

.win-checkbox input:checked + .checkbox-box {
  background-color: var(--color-accent);
  border-color: var(--color-accent);
}

.checkbox-box svg {
  width: 12px;
  height: 12px;
  color: white;
}

.checkbox-label {
  color: var(--color-text);
  font-size: 14px;
}
</style>