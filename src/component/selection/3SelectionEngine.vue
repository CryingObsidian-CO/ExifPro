<script setup lang="ts">
import {computed} from 'vue';
import {useI18n} from 'vue-i18n';
import WinCard from '../WinCard.vue';
import WinButton from '../WinButton.vue';
import WinSelect from '../WinSelect.vue';
import type {SelectOption} from '../WinSelect.vue';
import WinSlider from '../WinSlider.vue';
import {BlurAlgorithm} from '../../types/selection.ts';

const {t} = useI18n();

const props = defineProps<{
  algorithm: BlurAlgorithm;
  threshold: number;
  isRunning: boolean;
  hasDirectory: boolean;
}>();

const emit = defineEmits<{
  (e: 'update:algorithm', v: BlurAlgorithm): void;
  (e: 'update:threshold', v: number): void;
  (e: 'start'): void;
  (e: 'stop'): void;
}>();

const algorithmOptions = computed<SelectOption[]>(() => [
  {
    value: BlurAlgorithm.LaplacianVariance,
    label: t('selection.algorithm_' + BlurAlgorithm.LaplacianVariance),
  },
  {
    value: BlurAlgorithm.Tenengrad,
    label: t('selection.algorithm_' + BlurAlgorithm.Tenengrad),
  },
  {
    value: BlurAlgorithm.Brenner,
    label: t('selection.algorithm_' + BlurAlgorithm.Brenner),
  },
]);

const algorithmModel = computed({
  get: () => props.algorithm,
  set: (v: BlurAlgorithm) => emit('update:algorithm', v),
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
        <label class="form-label">{{ t('selection.algorithm_label') }}</label>
        <WinSelect
            v-model="algorithmModel"
            :options="algorithmOptions"
        />
      </div>
      <div class="form-group">
        <label class="form-label">
          {{ t('selection.threshold_label') }}:
          <span class="threshold-value">{{ thresholdPercent }}%</span>
        </label>
        <WinSlider
            v-model="thresholdPercent"
            :min="0"
            :max="100"
            :label="t('selection.threshold_label')"
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

.threshold-value {
  color: var(--color-brand);
  font-weight: var(--prim-font-weight-semibold);
  font-variant-numeric: tabular-nums;
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
