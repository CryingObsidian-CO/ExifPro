<script setup lang="ts">
import {ref, onMounted, onUnmounted} from 'vue';
import PhotoCard from './PhotoCard.vue';

export interface PhotoItem {
  filePath: string;
  fileName: string;
  score: number;
  stars: number;
  passed: boolean;
  eliminatedBy: string[];
}

const props = defineProps<{
  photos: PhotoItem[];
  thumbnails: Record<string, string | null>;
}>();

const emit = defineEmits<{
  (e: 'select-photo', path: string): void;
  (e: 'rate-photo', path: string, stars: number): void;
}>();

type IntersectionEntry = {
  path: string;
  el: HTMLElement;
  loaded: boolean;
};

const entries = ref<IntersectionEntry[]>([]);
let observer: IntersectionObserver | null = null;

const setupObserver = () => {
  observer = new IntersectionObserver(
    (intersections) => {
      for (const entry of intersections) {
        const idx = entries.value.findIndex(e => e.el === entry.target);
        if (idx === -1) continue;
        if (entry.isIntersecting) {
          entries.value[idx].loaded = true;
          observer?.unobserve(entry.target);
        }
      }
    },
    { rootMargin: '300px' }
  );
  for (const e of entries.value) {
    observer.observe(e.el);
  }
};

onMounted(() => {
  setupObserver();
});

onUnmounted(() => {
  if (observer) {
    observer.disconnect();
    observer = null;
  }
});

const registerCard = (el: HTMLElement | null, path: string) => {
  if (!el) return;
  const exists = entries.value.find(e => e.path === path);
  if (!exists) {
    const entry: IntersectionEntry = { path, el, loaded: false };
    entries.value.push(entry);
    observer?.observe(el);
  } else if (exists.el !== el) {
    observer?.unobserve(exists.el);
    exists.el = el;
    observer?.observe(el);
  }
};

const isLoaded = (path: string) => {
  const entry = entries.value.find(e => e.path === path);
  return entry ? entry.loaded : true;
};
</script>

<template>
  <div class="photo-grid">
    <div
      v-for="photo in photos"
      :key="photo.filePath"
      class="grid-cell"
    >
      <div
        v-if="isLoaded(photo.filePath)"
        :ref="(el) => registerCard(el as HTMLElement | null, photo.filePath)"
      >
        <PhotoCard
          :file-path="photo.filePath"
          :file-name="photo.fileName"
          :score="photo.score"
          :stars="photo.stars"
          :passed="photo.passed"
          :eliminated-by="photo.eliminatedBy"
          :thumbnail-url="thumbnails[photo.filePath] ?? null"
          @click="emit('select-photo', photo.filePath)"
          @rate="(s: number) => emit('rate-photo', photo.filePath, s)"
        />
      </div>
      <div v-else class="grid-cell-skeleton glass-card">
        <div class="skeleton-thumb"></div>
        <div class="skeleton-info">
          <div class="skeleton-line skeleton-name"></div>
          <div class="skeleton-line skeleton-score"></div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.photo-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: var(--prim-space-3);
  padding: var(--prim-space-4);
}

.grid-cell {
  min-height: 0;
}

.grid-cell-skeleton {
  aspect-ratio: 3 / 4;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.skeleton-thumb {
  flex: 1;
  background: var(--color-glass-bg);
  animation: pulse 1.5s ease-in-out infinite;
}

.skeleton-info {
  padding: var(--prim-space-2);
  display: flex;
  flex-direction: column;
  gap: var(--prim-space-1);
}

.skeleton-line {
  height: var(--prim-space-2);
  background: var(--color-border-default);
  border-radius: var(--prim-radius-xs);
  animation: pulse 1.5s ease-in-out infinite;
}

.skeleton-name {
  width: 70%;
}

.skeleton-score {
  width: 40%;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}
</style>
