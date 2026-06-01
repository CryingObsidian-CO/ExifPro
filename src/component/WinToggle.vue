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
  opacity: 0.45;
  cursor: not-allowed;
}

.win-toggle input {
  position: absolute;
  opacity: 0;
  pointer-events: none;
}

.toggle-track {
  width: 38px;
  height: 20px;
  border: 1px solid var(--color-border-default);
  border-radius: 10px;
  background: var(--color-glass-bg);
  display: flex;
  align-items: center;
  transition: all var(--prim-duration-fast) var(--prim-ease-out);
  position: relative;
  flex-shrink: 0;
}

.win-toggle:not(.disabled):hover .toggle-track {
  border-color: var(--color-border-strong);
}

.win-toggle input:checked + .toggle-track {
  background: var(--color-brand);
  border-color: var(--color-brand);
}

.toggle-thumb {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: var(--color-text-tertiary);
  margin-left: 2px;
  transition: all var(--prim-duration-fast) var(--prim-ease-out);
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
}

.win-toggle input:checked + .toggle-track .toggle-thumb {
  transform: translateX(18px);
  background: #fff;
}
</style>