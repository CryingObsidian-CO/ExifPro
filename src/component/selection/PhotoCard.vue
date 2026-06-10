<script setup lang="ts">
import {ref, computed} from 'vue';

const props = defineProps<{
  filePath: string;
  fileName: string;
  score: number;
  stars: number;
  passed: boolean;
  eliminatedBy: string[];
  thumbnailUrl: string | null;
}>();

const emit = defineEmits<{
  (e: 'click'): void;
  (e: 'rate', stars: number): void;
}>();

const scorePercent = computed(() => Math.round(props.score * 100));
const scoreColor = computed(() => {
  if (props.score >= 0.7) return 'var(--color-success)';
  if (props.score >= 0.4) return 'var(--color-warning)';
  return 'var(--color-danger)';
});

const isHovered = ref(false);
const starHover = ref(0);

const displayStars = computed(() => starHover.value || props.stars);
</script>

<template>
  <div
      class="photo-card glass-card"
      :class="{ eliminated: !passed, selected: false }"
      @mouseenter="isHovered = true"
      @mouseleave="isHovered = false"
      @click="emit('click')"
  >
    <div class="card-thumb-wrap">
      <img
          v-if="thumbnailUrl"
          :src="thumbnailUrl"
          :alt="fileName"
          class="card-thumb"
          loading="lazy"
      />
      <div v-else class="card-thumb card-thumb-placeholder">
        <span>?</span>
      </div>
      <div v-if="!passed" class="eliminated-badge">
        <span class="badge-icon">✗</span>
      </div>
    </div>
    <div class="card-info">
      <span class="card-name" :title="fileName">{{ fileName }}</span>
      <div class="card-score-row">
        <div class="card-score-bar">
          <div class="score-fill"
               :style="{ width: scorePercent + '%', background: scoreColor }"></div>
        </div>
        <span class="card-score" :style="{ color: scoreColor }">{{ scorePercent }}%</span>
      </div>
      <div class="card-stars" @click.stop @mouseleave="starHover = 0">
        <span
            v-for="i in 5"
            :key="i"
            class="star-btn"
            :class="{ filled: i <= displayStars }"
            @mouseenter="starHover = i"
            @click="emit('rate', i)"
        >{{ i <= displayStars ? '★' : '☆' }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.photo-card {
  display: flex;
  flex-direction: column;
  overflow: hidden;
  cursor: pointer;
  transition: all var(--prim-duration-fast) var(--prim-ease-out);
}

.photo-card:hover {
  transform: translateY(-2px);
  box-shadow: var(--prim-shadow-md);
}

.photo-card.eliminated {
  opacity: 0.65;
}

.photo-card.eliminated:hover {
  opacity: 0.9;
}

.card-thumb-wrap {
  position: relative;
  aspect-ratio: 1;
  overflow: hidden;
  background: var(--color-glass-bg);
}

.card-thumb {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.card-thumb-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-text-tertiary);
  font-size: 24px;
}

.eliminated-badge {
  position: absolute;
  top: var(--prim-space-1);
  right: var(--prim-space-1);
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: var(--color-danger);
  display: flex;
  align-items: center;
  justify-content: center;
}

.badge-icon {
  color: white;
  font-size: 11px;
  font-weight: bold;
  line-height: 1;
}

.card-info {
  padding: var(--prim-space-2) var(--prim-space-2) var(--prim-space-3);
  display: flex;
  flex-direction: column;
  gap: var(--prim-space-1);
}

.card-name {
  font-size: var(--prim-font-size-xs);
  color: var(--color-text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-weight: var(--prim-font-weight-medium);
}

.card-score-row {
  display: flex;
  align-items: center;
  gap: var(--prim-space-2);
}

.card-score-bar {
  flex: 1;
  height: 4px;
  background: var(--color-border-default);
  border-radius: 2px;
  overflow: hidden;
}

.score-fill {
  height: 100%;
  border-radius: 2px;
  transition: width var(--prim-duration-normal) var(--prim-ease-out);
}

.card-score {
  font-size: var(--prim-font-size-xs);
  font-weight: var(--prim-font-weight-semibold);
  font-variant-numeric: tabular-nums;
  min-width: 32px;
  text-align: right;
}

.card-stars {
  display: flex;
  gap: 1px;
  justify-content: flex-start;
}

.star-btn {
  font-size: 14px;
  cursor: pointer;
  color: var(--color-text-tertiary);
  transition: color var(--prim-duration-fast) var(--prim-ease-out);
  line-height: 1;
  user-select: none;
}

.star-btn.filled {
  color: var(--color-warning);
}

.star-btn:hover {
  transform: scale(1.2);
}
</style>
