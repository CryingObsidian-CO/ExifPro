<script setup lang="ts">
import {computed, ref, reactive, watch} from 'vue';
import {useI18n} from 'vue-i18n';
import {useTauri} from "../composables/tauri.ts";
import {useDialog} from "../composables/dialog.ts";
import SelectionBar from '../component/selection/1SelectionBar.vue';
import WinCard from '../component/WinCard.vue';
import WinButton from '../component/WinButton.vue';
import WinCheckbox from '../component/WinCheckbox.vue';
import IconFolder from '../component/icons/IconFolder.vue';
import SelectionEngine from '../component/selection/3SelectionEngine.vue';
import SelectionStats from '../component/selection/SelectionStats.vue';
import SelectionTabs from '../component/selection/SelectionTabs.vue';
import PhotoGrid from '../component/selection/PhotoGrid.vue';
import PhotoOverlay from '../component/selection/PhotoOverlay.vue';
import type {OverlayPhoto} from '../component/selection/PhotoOverlay.vue';
import {SelectionMethod, BlurAlgorithm} from '../types/selection.ts';

const {t} = useI18n();
const tauriImpl = useTauri();
const {showAlert} = useDialog();

const selectionDir = ref('');
const includeSubdirs = ref(true);
const hasDirectory = computed(() => selectionDir.value.length > 0);

const method = ref<SelectionMethod>(SelectionMethod.BlurDetection);
const algorithm = ref<BlurAlgorithm>(BlurAlgorithm.LaplacianVariance);
const threshold = ref(0.5);
const isRunning = ref(false);
const activeTab = ref('all');
const selectedPhotoPath = ref<string | null>(null);

async function selectDir() {
  const path = await tauriImpl.selectDirectory();
  if (path) {
    selectionDir.value = path;
  }
}

interface PhotoState {
  filePath: string;
  fileName: string;
  score: number;
  stars: number;
  passed: boolean;
  eliminatedBy: string[];
}

const photos = ref<PhotoState[]>([]);
const thumbnailCache = reactive<Record<string, string | null>>({});

const filteredPhotos = computed(() => {
  return photos.value.filter(p => {
    if (activeTab.value === 'all') return true;
    if (activeTab.value === 'passed') return p.passed && p.stars === 0;
    if (activeTab.value === 'eliminated') return !p.passed;
    if (activeTab.value === 'unrated') return p.stars === 0 && p.passed;
    return true;
  });
});

const tabCounts = computed(() => {
  const all = photos.value.length;
  const passed = photos.value.filter(p => p.passed && p.stars === 0).length;
  const eliminated = photos.value.filter(p => !p.passed).length;
  const unrated = photos.value.filter(p => p.stars === 0 && p.passed).length;
  return {all, passed, eliminated, unrated};
});

const stats = computed(() => {
  const total = photos.value.length;
  const passed = photos.value.filter(p => p.passed).length;
  const eliminated = total - passed;
  const dist: [number, number, number, number, number] = [0, 0, 0, 0, 0];
  for (const p of photos.value) {
    if (p.stars >= 1 && p.stars <= 5) dist[p.stars - 1]++;
  }
  return {total, passed, eliminated, starDistribution: dist};
});

const overlayPhoto = computed<OverlayPhoto | null>(() => {
  if (!selectedPhotoPath.value) return null;
  const idx = photos.value.findIndex(p => p.filePath === selectedPhotoPath.value);
  if (idx === -1) return null;
  const p = photos.value[idx];
  return {
    filePath: p.filePath,
    fileName: p.fileName,
    score: p.score,
    stars: p.stars,
    passed: p.passed,
    thumbnailUrl: thumbnailCache[p.filePath] ?? null,
    hasPrev: idx > 0,
    hasNext: idx < photos.value.length - 1,
  };
});

const loadThumbnail = async (filePath: string) => {
  if (thumbnailCache[filePath] !== undefined) return;
  try {
    thumbnailCache[filePath] = await tauriImpl.getThumbnail(filePath, 'small');
  } catch {
    thumbnailCache[filePath] = null;
  }
};

const handleSelectPhoto = (path: string) => {
  selectedPhotoPath.value = path;
};

const handleRatePhoto = (path: string, stars: number) => {
  const p = photos.value.find(ph => ph.filePath === path);
  if (p) {
    p.stars = p.stars === stars ? 0 : stars;
  }
};

const handleOverlayPrev = () => {
  if (!selectedPhotoPath.value) return;
  const idx = photos.value.findIndex(p => p.filePath === selectedPhotoPath.value);
  if (idx > 0) {
    selectedPhotoPath.value = photos.value[idx - 1].filePath;
  }
};

const handleOverlayNext = () => {
  if (!selectedPhotoPath.value) return;
  const idx = photos.value.findIndex(p => p.filePath === selectedPhotoPath.value);
  if (idx < photos.value.length - 1) {
    selectedPhotoPath.value = photos.value[idx + 1].filePath;
  }
};

const handleOverlayRate = (stars: number) => {
  if (!selectedPhotoPath.value) return;
  handleRatePhoto(selectedPhotoPath.value, stars);
};

const handleCloseOverlay = () => {
  selectedPhotoPath.value = null;
};

const handleStart = async () => {
  if (!hasDirectory.value) {
    await showAlert(t('selection.no_dir'), {
      title: t('selection.invalid_dir'),
      tone: 'warning',
    });
    return;
  }
  isRunning.value = true;
};

const handleStop = () => {
  isRunning.value = false;
};

watch(activeTab, () => {
  filteredPhotos.value.forEach(p => loadThumbnail(p.filePath));
});
</script>

<template>
  <div class="selection-page">
    <SelectionBar :dir-path="selectionDir"/>
    <div class="selection-body">
      <aside class="selection-sidebar">
        <WinCard :title="t('selection.source_dir')">
          <div class="path-input">
            <input type="text"
                   class="glass-input"
                   v-model="selectionDir"
                   :placeholder="t('selection.source_dir_placeholder')"
            />
          </div>
          <div class="controls-row">
            <WinCheckbox v-model="includeSubdirs" :label="t('selection.include_subdirs')"/>
            <WinButton size="small" @click="selectDir">
              <IconFolder :size="16"/>
              {{ t('selection.browse') }}
            </WinButton>
          </div>
        </WinCard>
        <SelectionEngine
            :method="method"
            :algorithm="algorithm"
            :threshold="threshold"
            :is-running="isRunning"
            :has-directory="hasDirectory"
            @update:method="method = $event"
            @update:algorithm="algorithm = $event"
            @update:threshold="threshold = $event"
            @start="handleStart"
            @stop="handleStop"
        />
        <SelectionStats
            :total="stats.total"
            :passed="stats.passed"
            :eliminated="stats.eliminated"
            :star-distribution="stats.starDistribution"
        />
      </aside>
      <main class="selection-main">
        <div class="selection-toolbar">
          <SelectionTabs
              :active-tab="activeTab"
              :counts="tabCounts"
              @update:active-tab="activeTab = $event"
          />
        </div>
        <div class="selection-grid glass-scrollbar">
          <PhotoGrid
              :photos="filteredPhotos"
              :thumbnails="thumbnailCache"
              @select-photo="handleSelectPhoto"
              @rate-photo="handleRatePhoto"
          />
        </div>
      </main>
    </div>
    <PhotoOverlay
        :photo="overlayPhoto"
        @close="handleCloseOverlay"
        @rate="handleOverlayRate"
        @prev="handleOverlayPrev"
        @next="handleOverlayNext"
    />
  </div>
</template>

<style scoped>
.selection-page {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--color-bg-app);
}

.selection-body {
  flex: 1;
  display: flex;
  overflow: hidden;
}

.selection-sidebar {
  width: 280px;
  flex-shrink: 0;
  padding: var(--prim-space-3);
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: var(--prim-space-3);
  border-right: 1px solid var(--card-header-border);
}

.path-input {
  flex: 1;
  margin-bottom: var(--prim-space-2);
}

.path-input input {
  width: 100%;
  padding: var(--prim-space-2) var(--prim-space-3);
  border-radius: var(--prim-radius-md);
  font-size: var(--prim-font-size-base);
}

.controls-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--prim-space-0) var(--prim-space-1);
}

.selection-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.selection-toolbar {
  padding: var(--prim-space-3) var(--prim-space-4) 0;
  flex-shrink: 0;
}

.selection-grid {
  flex: 1;
  overflow-y: auto;
}
</style>
