<script setup lang="ts">
import {computed} from 'vue';

const props = defineProps<{
  modelValue: number;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
  label: string;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: number): void;
}>();

const min = computed(() => props.min ?? 0);
const max = computed(() => props.max ?? 100);
const step = computed(() => props.step ?? 1);

const fillPercent = computed(() => {
  const range = max.value - min.value;
  if (range <= 0) return 0;
  return ((props.modelValue - min.value) / range) * 100;
});

const valuetext = computed(() => {
  return `${props.label}: ${props.modelValue}`;
});

const handleInput = (e: Event) => {
  const val = parseFloat((e.target as HTMLInputElement).value);
  emit('update:modelValue', val);
};
</script>

<template>
  <div class="win-slider" :class="{ disabled }">
    <input
        type="range"
        class="slider-input"
        :min="min"
        :max="max"
        :step="step"
        :value="modelValue"
        :disabled="disabled"
        :aria-label="label"
        :aria-valuemin="min"
        :aria-valuemax="max"
        :aria-valuenow="modelValue"
        :aria-valuetext="valuetext"
        @input="handleInput"
    />
    <div class="slider-track" aria-hidden="true">
      <div class="slider-fill" :style="{ width: fillPercent + '%' }"></div>
    </div>
    <div class="slider-thumb" aria-hidden="true" :style="{ left: fillPercent + '%' }"></div>
  </div>
</template>

<style scoped>
.win-slider {
  position: relative;
  width: 100%;
  height: var(--prim-space-4);
  display: flex;
  align-items: center;
  user-select: none;
}

.win-slider.disabled {
  opacity: var(--prim-opacity-40);
  pointer-events: none;
}

.slider-input {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  opacity: 0;
  cursor: pointer;
  z-index: 2;
  margin: 0;
}

.slider-track {
  position: absolute;
  left: 0;
  right: 0;
  height: 6px;
  border-radius: var(--prim-radius-sm);
  background: var(--color-border-default);
  overflow: hidden;
  pointer-events: none;
}

.slider-fill {
  height: 100%;
  border-radius: var(--prim-radius-sm);
  background: linear-gradient(90deg, var(--color-brand), var(--color-brand-hover));
  transition: width var(--prim-duration-fast) var(--prim-ease-out);
  will-change: width;
}

.slider-thumb {
  position: absolute;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: var(--color-brand);
  border: 3px solid var(--color-bg-surface);
  box-shadow: var(--prim-shadow-sm), 0 0 0 1px var(--color-glass-border);
  transform: translate(-50%, -50%);
  top: 50%;
  pointer-events: none;
  transition: transform var(--prim-duration-fast) var(--prim-ease-out), box-shadow var(--prim-duration-fast) var(--prim-ease-out);
  will-change: left;
}

.slider-input:hover ~ .slider-thumb {
  transform: translate(-50%, -50%) scale(1.15);
}

.slider-input:active ~ .slider-thumb {
  transform: translate(-50%, -50%) scale(0.95);
  box-shadow: var(--prim-shadow-md), 0 0 0 3px var(--input-focus-ring);
}

.slider-input:focus-visible ~ .slider-thumb {
  box-shadow: var(--prim-shadow-sm), 0 0 0 3px var(--input-focus-ring);
}
</style>
