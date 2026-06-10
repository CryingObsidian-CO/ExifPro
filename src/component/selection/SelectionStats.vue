<script setup lang="ts">
import {computed} from 'vue';
import {useI18n} from 'vue-i18n';
import WinCard from '../WinCard.vue';

const {t} = useI18n();

const props = defineProps<{
  total: number;
  passed: number;
  eliminated: number;
  starDistribution: [number, number, number, number, number]; // stars 1-5
}>();

const eliminatedPercent = computed(() =>
    props.total > 0 ? Math.round((props.eliminated / props.total) * 100) : 0
);

const maxStarCount = computed(() =>
    Math.max(...props.starDistribution, 1)
);
</script>

<template>
  <WinCard>
    <div class="stats-grid">
      <div class="stat-item">
        <span class="stat-value">{{ total }}</span>
        <span class="stat-label">{{ t('selection.stat_total') }}</span>
      </div>
      <div class="stat-item stat-passed">
        <span class="stat-value">{{ passed }}</span>
        <span class="stat-label">{{ t('selection.stat_passed') }}</span>
      </div>
      <div class="stat-item stat-eliminated">
        <span class="stat-value">{{ eliminated }}</span>
        <span class="stat-label">{{ t('selection.stat_eliminated') }}</span>
      </div>
    </div>
    <div v-if="eliminatedPercent > 0" class="eliminated-bar">
      <div class="eliminated-bar-fill" :style="{ width: eliminatedPercent + '%' }"></div>
    </div>
    <div v-if="total > 0" class="star-histogram">
      <div class="histogram-row" v-for="(count, idx) in starDistribution" :key="idx">
        <span class="histogram-star">{{ idx + 1 }}★</span>
        <div class="histogram-track">
          <div
              class="histogram-fill"
              :style="{ width: (count / maxStarCount) * 100 + '%' }"
          ></div>
        </div>
        <span class="histogram-count">{{ count }}</span>
      </div>
    </div>
  </WinCard>
</template>

<style scoped>
.stats-grid {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: var(--prim-space-2);
  margin-bottom: var(--prim-space-2);
}

.stat-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: var(--prim-space-1) 0;
}

.stat-value {
  font-size: var(--prim-font-size-xl);
  font-weight: var(--prim-font-weight-bold);
  color: var(--color-text-primary);
  font-variant-numeric: tabular-nums;
  line-height: var(--prim-line-height-tight);
}

.stat-label {
  font-size: var(--prim-font-size-xs);
  color: var(--color-text-secondary);
  margin-top: 2px;
}

.stat-passed .stat-value {
  color: var(--color-success);
}

.stat-eliminated .stat-value {
  color: var(--color-danger);
}

.eliminated-bar {
  height: 4px;
  background: var(--color-border-default);
  border-radius: 2px;
  overflow: hidden;
  margin-bottom: var(--prim-space-4);
}

.eliminated-bar-fill {
  height: 100%;
  background: var(--color-danger);
  border-radius: 2px;
  transition: width var(--prim-duration-normal) var(--prim-ease-out);
}

.star-histogram {
  display: flex;
  flex-direction: column;
  gap: var(--prim-space-1);
}

.histogram-row {
  display: flex;
  align-items: center;
  gap: var(--prim-space-2);
}

.histogram-star {
  font-size: var(--prim-font-size-sm);
  color: var(--color-text-secondary);
  width: 28px;
  flex-shrink: 0;
  text-align: right;
}

.histogram-track {
  flex: 1;
  height: 12px;
  background: var(--color-border-default);
  border-radius: var(--prim-radius-xs);
  overflow: hidden;
}

.histogram-fill {
  height: 100%;
  background: var(--color-warning);
  border-radius: var(--prim-radius-xs);
  transition: width var(--prim-duration-normal) var(--prim-ease-out);
  min-width: 2px;
}

.histogram-count {
  font-size: var(--prim-font-size-xs);
  color: var(--color-text-tertiary);
  width: 24px;
  text-align: right;
  font-variant-numeric: tabular-nums;
}
</style>
