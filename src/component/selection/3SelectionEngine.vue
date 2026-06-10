<script setup lang="ts">
import {computed} from 'vue';
import {useI18n} from 'vue-i18n';
import WinCard from '../WinCard.vue';
import WinButton from '../WinButton.vue';
import {SelectionMethod, BlurAlgorithm} from '../../types/selection.ts';

const {t} = useI18n();

const props = defineProps<{
  method: SelectionMethod;
  algorithm: BlurAlgorithm;
  threshold: number;
  isRunning: boolean;
  hasDirectory: boolean;
}>();

const emit = defineEmits<{
  (e: 'update:method', v: SelectionMethod): void;
  (e: 'update:algorithm', v: BlurAlgorithm): void;
  (e: 'update:threshold', v: number): void;
  (e: 'start'): void;
  (e: 'stop'): void;
}>();

const methods = [SelectionMethod.BlurDetection];

const algorithms = computed(() => {
  if (props.method === SelectionMethod.BlurDetection) {
    return [BlurAlgorithm.LaplacianVariance, BlurAlgorithm.Tenengrad, BlurAlgorithm.Brenner];
  }
  return [];
});

const thresholdPercent = computed({
  get: () => Math.round(props.threshold * 100),
  set: (v: number) => emit('update:threshold', v / 100),
});
</script>

<template>
  <WinCard :title="t('selection.engine')">
    <div class="engine-form">
      <div class="form-group">
        <label class="form-label">{{ t('selection.method_label') }}</label>
        <select class="form-select glass-input" :value="method"
                @change="emit('update:method', ($event.target as HTMLSelectElement).value as SelectionMethod)">
          <option v-for="m in methods" :key="m" :value="m">{{ t('selection.method_' + m) }}</option>
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">{{ t('selection.algorithm_label') }}</label>
        <select class="form-select glass-input" :value="algorithm"
                @change="emit('update:algorithm', ($event.target as HTMLSelectElement).value as BlurAlgorithm)">
          <option v-for="a in algorithms" :key="a" :value="a">{{
              t('selection.algorithm_' + a)
            }}
          </option>
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">
          {{ t('selection.threshold_label') }}:
          <span class="threshold-value">{{ thresholdPercent }}%</span>
        </label>
        <input
            type="range"
            class="form-range"
            :min="0"
            :max="100"
            :value="thresholdPercent"
            @input="thresholdPercent = parseInt(($event.target as HTMLInputElement).value)"
        />
        <div class="range-labels">
          <span>{{ t('selection.threshold_blurry') }}</span>
          <span>{{ t('selection.threshold_sharp') }}</span>
        </div>
      </div>
      <div class="form-actions">
        <WinButton
            v-if="!isRunning"
            variant="primary"
            size="medium"
            full-width
            :disabled="!hasDirectory"
            @click="emit('start')"
        >
          {{ t('selection.start') }}
        </WinButton>
        <WinButton
            v-else
            variant="danger"
            size="medium"
            full-width
            @click="emit('stop')"
        >
          {{ t('selection.stop') }}
        </WinButton>
      </div>
    </div>
  </WinCard>
</template>

<style scoped>
.engine-form {
  display: flex;
  flex-direction: column;
  gap: var(--prim-space-4);
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: var(--prim-space-2);
}

.form-label {
  font-size: var(--prim-font-size-sm);
  color: var(--color-text-secondary);
  font-weight: var(--prim-font-weight-medium);
}

.form-select {
  padding: 6px var(--prim-space-3);
  border-radius: var(--prim-radius-md);
  font-size: var(--prim-font-size-base);
  outline: none;
  appearance: auto;
  cursor: pointer;
}

.threshold-value {
  color: var(--color-brand);
  font-weight: var(--prim-font-weight-semibold);
  font-variant-numeric: tabular-nums;
}

.form-range {
  width: 100%;
  height: var(--prim-space-1);
  appearance: none;
  background: var(--color-border-default);
  border-radius: var(--prim-radius-sm);
  outline: none;
  cursor: pointer;
}

.form-range::-webkit-slider-thumb {
  appearance: none;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: var(--color-brand);
  border: 2px solid var(--color-bg-surface);
  cursor: pointer;
  transition: transform var(--prim-duration-fast) var(--prim-ease-out);
}

.form-range::-webkit-slider-thumb:hover {
  transform: scale(1.2);
}

.form-range::-webkit-slider-thumb:active {
  transform: scale(0.9);
}

.form-range:focus-visible::-webkit-slider-thumb {
  box-shadow: 0 0 0 2px var(--color-border-focus);
}

.range-labels {
  display: flex;
  justify-content: space-between;
  font-size: var(--prim-font-size-xs);
  color: var(--color-text-tertiary);
}

.form-actions {
  padding-top: var(--prim-space-2);
}
</style>
