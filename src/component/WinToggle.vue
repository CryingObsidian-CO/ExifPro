<script setup lang="ts">
import {computed} from "vue";

const props = defineProps<{
  modelValue: boolean;
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
  <label class="win-toggle" :class="{ disabled }">
    <input
        type="checkbox"
        :checked="checked"
        :disabled="disabled"
        @change="(e) => (checked = (e.target as HTMLInputElement).checked)"
    />
    <span class="toggle-track">
      <span class="toggle-thumb"></span>
    </span>
  </label>
</template>

<style scoped>
.win-toggle {
  display: inline-flex;
  align-items: center;
  cursor: pointer;
  user-select: none;
  position: relative;
}

.win-toggle.disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.win-toggle input {
  position: absolute;
  opacity: 0;
  pointer-events: none;
}

.toggle-track {
  width: 40px;
  height: 22px;
  border: 1px solid var(--color-border);
  border-radius: 11px;
  background-color: var(--color-bg-secondary);
  display: flex;
  align-items: center;
  transition: all var(--transition-fast);
  position: relative;
  flex-shrink: 0;
}

.win-toggle:not(.disabled):hover .toggle-track {
  border-color: var(--color-border-hover);
}

.win-toggle input:checked + .toggle-track {
  background-color: var(--color-accent);
  border-color: var(--color-accent);
}

.toggle-thumb {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background-color: var(--color-text-secondary);
  margin-left: 2px;
  transition: all var(--transition-fast);
}

.win-toggle input:checked + .toggle-track .toggle-thumb {
  transform: translateX(18px);
  background-color: #fff;
}
</style>
