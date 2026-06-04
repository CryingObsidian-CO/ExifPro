<script setup lang="ts">
import WinCard from "../component/WinCard.vue";
import {store} from "../store/store.ts";
import WinButton from "../component/WinButton.vue";
import WinCheckbox from "../component/WinCheckbox.vue";
import {computed} from "vue";
import {useTauri} from "../composables/tauri.ts";
import {useRouter} from "vue-router";
import {useDialog} from "../composables/dialog.ts";
import {formatError} from "../composables/logger";
import IconFolder from "../component/icons/IconFolder.vue";
import IconUpload from "../component/icons/IconUpload.vue";
import {useI18n} from 'vue-i18n';

const router = useRouter();
const tauriImpl = useTauri();
const {showAlert} = useDialog();
const {t} = useI18n();

const getErrorMessage = (error: unknown) => {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  if (typeof error === 'string' && error.trim()) {
    return error;
  }
  if (error && typeof error === 'object' && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string' && message.trim()) {
      return message;
    }
  }
  return t('home.unknown_error');
};

const selectSourceDir = async () => {
  const path = await tauriImpl.selectDirectory();
  if (path) {
    console.info(`ui.home.select_source_dir: selected path=${path}`);
    store.selectedDirectory = path;
  } else {
    console.info("ui.home.select_source_dir: canceled");
  }
};

const selectOutputDir = async () => {
  const path = await tauriImpl.selectDirectory();
  if (path) {
    console.info(`ui.home.select_output_dir: selected path=${path}`);
    store.outputDirectory = path;
  } else {
    console.info("ui.home.select_output_dir: canceled");
  }
};

const startAnalysis = async () => {
  if (!store.selectedDirectory) {
    console.warn("ui.home.start_analysis: missing_directory");
    await showAlert(t('home.no_dir'), {
      title: t('home.invalid_dir'),
      tone: 'warning'
    });
    return;
  }

  console.info(
      `ui.home.start_analysis: start dir=${store.selectedDirectory} recursive=${store.recursive}`
  );
  store.isAnalyzing = true;
  try {
    const photos = await tauriImpl.scanDirectory(store.selectedDirectory, store.recursive);
    store.photos = photos;

    if (store.config) {
      store.groups = await tauriImpl.groupPhotos(photos, store.config);
      console.info(
          `ui.home.start_analysis: complete photos=${photos.length} groups=${store.groups.length}`
      );
      await router.push('/edit');
    } else {
      console.warn("ui.home.start_analysis: missing_config");
      await showAlert(t('home.no_config'), {
        title: t('home.config_missing'),
        tone: 'warning'
      });
    }
  } catch (error) {
    const message = getErrorMessage(error);
    console.error(`ui.home.start_analysis: failed err=${formatError(error)}`);
    await showAlert(t('home.analysis_failed', {message}), {
      title: t('home.analysis_failed_title'),
      tone: 'error'
    });
  } finally {
    store.isAnalyzing = false;
  }
};

const recursive = computed({
  get: () => store.recursive,
  set: (val) => store.recursive = val,
});

const copyMode = computed({
  get: () => store.copyMode,
  set: (val) => store.copyMode = val,
});

const overwrite = computed({
  get: () => store.overwrite,
  set: (val) => store.overwrite = val,
});

const selectedDirectory = computed({
  get: () => store.selectedDirectory,
  set: (val) => store.selectedDirectory = val,
});

const outputDirectory = computed({
  get: () => store.outputDirectory,
  set: (val) => store.outputDirectory = val,
});
</script>

<template>
  <div class="home-page">
    <div class="page-header">
      <h1>{{ t('home.title') }}</h1>
      <p>{{ t('home.subtitle') }}</p>
    </div>

    <div class="page-content glass-scrollbar">
      <WinCard :title="t('home.source_dir')">
        <div class="input-group">
          <div class="path-input">
            <input type="text"
                   v-model="selectedDirectory"
                   :placeholder="t('home.source_dir_placeholder')"
                   class="glass-input"
            />
          </div>
          <WinButton @click="selectSourceDir">
            <IconFolder :size="16"/>
            {{ t('home.browse') }}
          </WinButton>
        </div>
        <div class="options-row">
          <WinCheckbox v-model="recursive" :label="t('home.include_subdirs')"/>
        </div>
      </WinCard>

      <WinCard :title="t('home.processing_mode')">
        <div class="options-group">
          <WinCheckbox v-model="copyMode" :label="t('home.copy_mode')"/>
          <WinCheckbox v-model="overwrite" :label="t('home.overwrite')"/>
        </div>
        <div class="input-group">
          <div class="path-input">
            <input type="text"
                   v-model="outputDirectory"
                   :placeholder="t('home.output_dir_placeholder')"
                   class="glass-input"
            />
          </div>
          <WinButton @click="selectOutputDir">
            <IconFolder :size="16"/>
            {{ t('home.browse') }}
          </WinButton>
        </div>
      </WinCard>

      <WinCard :title="t('home.status')">
        <div class="status-info">
          <div class="status-item">
            <span class="label">{{ t('home.photos') }}</span>
            <span class="value">{{ store.photosNumber }}</span>
          </div>
          <div class="status-item">
            <span class="label">{{ t('home.groups') }}</span>
            <span class="value">{{ store.groupsNumber }}</span>
          </div>
        </div>
        <div class="action-buttons">
          <WinButton variant="primary"
                     size="large"
                     :disabled="store.isAnalyzing || !store.selectedDirectory"
                     @click="startAnalysis"
          >
            <IconUpload :size="16"/>
            {{ store.isAnalyzing ? t('home.analyzing') : t('home.start_analysis') }}
          </WinButton>
          <WinButton size="large"
                     :disabled="store.groupsNumber === 0"
                     @click="$router.push('/edit')"
          >
            {{ t('home.edit_groups') }}
          </WinButton>
        </div>
      </WinCard>
    </div>
  </div>
</template>

<style scoped>
.home-page {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.page-header {
  padding: var(--prim-space-6) var(--prim-space-8);
  border-bottom: 1px solid var(--color-border-subtle);
}

.page-header h1 {
  font-size: var(--prim-font-size-2xl);
  font-weight: var(--prim-font-weight-semibold);
  color: var(--color-text-primary);
  margin-bottom: var(--prim-space-1);
}

.page-header p {
  color: var(--color-text-secondary);
  font-size: var(--prim-font-size-base);
}

.page-content {
  flex: 1;
  padding: var(--prim-space-6) var(--prim-space-8);
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: var(--prim-space-5);
}

.input-group {
  display: flex;
  gap: var(--prim-space-3);
  align-items: center;
}

.path-input {
  flex: 1;
}

.path-input input {
  width: 100%;
  padding: 7px var(--prim-space-3);
  border-radius: var(--prim-radius-md);
  font-size: var(--prim-font-size-base);
}

.options-row {
  margin-top: var(--prim-space-5);
}

.options-group {
  display: flex;
  flex-direction: column;
  gap: var(--prim-space-3);
  margin-bottom: var(--prim-space-5);
}

.status-info {
  display: flex;
  gap: var(--prim-space-8);
  margin-bottom: var(--prim-space-5);
}

.status-item {
  display: flex;
  flex-direction: column;
  gap: var(--prim-space-1);
}

.status-item .label {
  color: var(--color-text-secondary);
  font-size: var(--prim-font-size-sm);
  font-weight: var(--prim-font-weight-medium);
}

.status-item .value {
  font-size: var(--prim-font-size-3xl);
  font-weight: var(--prim-font-weight-semibold);
  color: var(--color-text-primary);
}

.action-buttons {
  display: flex;
  gap: var(--prim-space-3);
}
</style>