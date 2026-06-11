<script setup lang="ts">
import PhotoCard from './PhotoCard.vue';

export interface PhotoItem {
  filePath: string;
  fileName: string;
  score: number;
  scoreDetails: Array<[string, number]>;
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
</script>

<template>
  <div class="photo-grid">
    <div
      v-for="photo in photos"
      :key="photo.filePath"
      class="grid-cell"
    >
      <PhotoCard
        :file-path="photo.filePath"
        :file-name="photo.fileName"
        :score="photo.score"
        :score-details="photo.scoreDetails"
        :stars="photo.stars"
        :passed="photo.passed"
        :eliminated-by="photo.eliminatedBy"
        :thumbnail-url="thumbnails[photo.filePath] ?? null"
        @click="emit('select-photo', photo.filePath)"
        @rate="(s: number) => emit('rate-photo', photo.filePath, s)"
      />
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
</style>
