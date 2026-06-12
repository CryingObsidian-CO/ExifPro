<script setup lang="ts">
import {ref, computed, watch} from 'vue';
import {useI18n} from 'vue-i18n';

const {t} = useI18n();

export interface OverlayPhoto {
  filePath: string;
  fileName: string;
  score: number;
  scoreDetails: Array<[string, number]>;
  stars: number;
  passed: boolean;
  eliminatedBy: string[];
  manualPass: boolean;
  thumbnailUrl: string | null;
  hasPrev: boolean;
  hasNext: boolean;
}

const props = defineProps<{
  photo: OverlayPhoto | null;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'rate', stars: number): void;
  (e: 'toggle-pass'): void;
  (e: 'prev'): void;
  (e: 'next'): void;
}>();

const visible = computed(() => props.photo !== null);
const starHover = ref(0);

const handleKeydown = (e: KeyboardEvent) => {
  if (!visible.value) return;
  if (e.key === 'Escape') emit('close');
  if (e.key === 'ArrowLeft') emit('prev');
  if (e.key === 'ArrowRight') emit('next');
};

watch(visible, (v) => {
  if (v) {
    window.addEventListener('keydown', handleKeydown);
  } else {
    window.removeEventListener('keydown', handleKeydown);
  }
});
</script>

<template>
  <Teleport to="body">
    <Transition name="overlay">
      <div v-if="visible && photo" class="photo-overlay" @click.self="emit('close')">
        <div class="overlay-backdrop"></div>
        <div class="overlay-content">
          <button class="overlay-close" @click="emit('close')">✕</button>
          <button class="overlay-nav overlay-prev" @click="emit('prev')" :disabled="!photo.hasPrev">
            ‹
          </button>
          <button class="overlay-nav overlay-next" @click="emit('next')" :disabled="!photo.hasNext">
            ›
          </button>
          <div class="overlay-image-wrap">
            <img
                v-if="photo.thumbnailUrl"
                :src="photo.thumbnailUrl"
                :alt="photo.fileName"
                class="overlay-image"
            />
            <div v-else class="overlay-image overlay-placeholder">
              <span>?</span>
            </div>
          </div>
          <div class="overlay-footer">
            <span class="overlay-filename">{{ photo.fileName }}</span>
            <div class="overlay-score-bar">
              <div class="score-fill" :style="{ width: Math.round(photo.score * 100) + '%' }"></div>
            </div>
            <span class="overlay-score">{{ Math.round(photo.score * 100) }}%</span>
            <div v-if="photo.scoreDetails.length > 0" class="overlay-method-scores">
              <span v-for="[method, s] in photo.scoreDetails" :key="method"
                    class="overlay-method-score"
                    :class="{ fail: !photo.passed }">
                {{ method }}: {{ Math.round(s * 100) }}%
              </span>
            </div>
            <div class="overlay-stars" @mouseleave="starHover = 0">
              <span
                  v-for="i in 5"
                  :key="i"
                  class="overlay-star"
                  :class="{ filled: i <= (starHover || photo.stars) }"
                  @mouseenter="starHover = i"
                  @click="emit('rate', i)"
              >★</span>
              <span v-if="photo.passed" class="overlay-eliminate-btn"
                    @click="emit('toggle-pass')">✗</span>
            </div>
            <span v-if="!photo.manualPass"
                  class="overlay-badge overlay-badge-eliminated"
                  @click="emit('toggle-pass')">✗ {{ t('selection.eliminated') }}</span>
            <span v-else-if="!photo.passed"
                  class="overlay-badge overlay-badge-manual"
                  @click="emit('toggle-pass')">👍 {{ t('selection.manual_pass') }}</span>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.photo-overlay {
  position: fixed;
  inset: 0;
  z-index: var(--prim-z-modal);
  display: flex;
  align-items: center;
  justify-content: center;
}

.overlay-backdrop {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.75);
  backdrop-filter: blur(var(--prim-glass-blur-sm));
}

.overlay-content {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  max-width: 90vw;
  max-height: 90vh;
}

.overlay-close {
  position: absolute;
  top: calc(-1 * var(--prim-space-10));
  right: 0;
  background: transparent;
  border: none;
  color: rgba(255, 255, 255, 0.7);
  font-size: var(--prim-font-size-2xl);
  cursor: pointer;
  z-index: 10;
  padding: 4px 8px;
  transition: color var(--prim-duration-fast) var(--prim-ease-out);
}

.overlay-close:hover {
  color: white;
}

.overlay-nav {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  background: rgba(0, 0, 0, 0.4);
  border: none;
  color: rgba(255, 255, 255, 0.7);
  font-size: var(--prim-font-size-4xl);
  width: var(--prim-space-12);
  height: var(--prim-space-12);
  border-radius: 50%;
  cursor: pointer;
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all var(--prim-duration-fast) var(--prim-ease-out);
}

.overlay-nav:hover:not(:disabled) {
  background: rgba(0, 0, 0, 0.6);
  color: white;
}

.overlay-nav:disabled {
  opacity: 0.2;
  cursor: not-allowed;
}

.overlay-prev {
  left: calc(-1 * var(--prim-space-16));
}

.overlay-next {
  right: calc(-1 * var(--prim-space-16));
}

.overlay-image-wrap {
  max-width: 80vw;
  max-height: 75vh;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--prim-radius-lg);
  overflow: hidden;
}

.overlay-image {
  max-width: 100%;
  max-height: 75vh;
  object-fit: contain;
  display: block;
  border-radius: var(--prim-radius-lg);
}

.overlay-placeholder {
  width: 400px;
  height: 300px;
  background: rgba(255, 255, 255, 0.05);
  display: flex;
  align-items: center;
  justify-content: center;
  color: rgba(255, 255, 255, 0.3);
  font-size: var(--prim-space-12);
}

.overlay-footer {
  display: flex;
  align-items: center;
  gap: var(--prim-space-3);
  margin-top: var(--prim-space-3);
  padding: var(--prim-space-2) var(--prim-space-4);
  background: rgba(0, 0, 0, 0.4);
  border-radius: var(--prim-radius-md);
  max-width: 80vw;
}

.overlay-filename {
  color: rgba(255, 255, 255, 0.8);
  font-size: var(--prim-font-size-sm);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 200px;
}

.overlay-score-bar {
  width: var(--prim-space-20);
  height: 4px;
  background: rgba(255, 255, 255, 0.15);
  border-radius: 2px;
  overflow: hidden;
}

.overlay-score-bar .score-fill {
  height: 100%;
  background: var(--color-warning);
  border-radius: 2px;
}

.overlay-score {
  color: rgba(255, 255, 255, 0.7);
  font-size: var(--prim-font-size-sm);
  font-weight: var(--prim-font-weight-semibold);
  font-variant-numeric: tabular-nums;
  min-width: var(--prim-space-10);
}

.overlay-stars {
  display: flex;
  gap: 2px;
}

.overlay-star {
  font-size: 22px;
  color: rgba(255, 255, 255, 0.2);
  cursor: pointer;
  transition: all var(--prim-duration-fast) var(--prim-ease-out);
  user-select: none;
}

.overlay-star.filled {
  color: var(--color-warning);
}

.overlay-star:hover {
  transform: scale(1.2);
}

.overlay-eliminate-btn {
  font-size: 18px;
  cursor: pointer;
  color: rgba(255, 255, 255, 0.3);
  line-height: 1;
  user-select: none;
  margin-left: auto;
  padding: 0 4px;
  transition: color var(--prim-duration-fast) var(--prim-ease-out);
}
.overlay-eliminate-btn:hover {
  color: var(--color-danger);
  transform: scale(1.2);
}

.overlay-badge {
  cursor: pointer;
  font-size: var(--prim-font-size-sm);
  padding: 2px 8px;
  border-radius: var(--prim-radius-sm);
}

.overlay-badge-eliminated {
  color: var(--color-danger);
  background: rgba(255, 0, 0, 0.1);
}

.overlay-badge-manual {
  color: var(--color-success);
  background: rgba(0, 255, 0, 0.1);
}

.overlay-method-scores {
  display: flex;
  gap: var(--prim-space-2);
}

.overlay-method-score {
  font-size: var(--prim-font-size-xs);
  color: rgba(255, 255, 255, 0.5);
  font-variant-numeric: tabular-nums;
}

.overlay-method-score.fail {
  color: var(--color-danger);
}

.overlay-enter-active,
.overlay-leave-active {
  transition: opacity var(--prim-duration-normal) var(--prim-ease-out);
}

.overlay-enter-from,
.overlay-leave-to {
  opacity: 0;
}
</style>
