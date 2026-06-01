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

const router = useRouter();
const tauriImpl = useTauri();
const {showAlert} = useDialog();

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
  return 'Unknown error';
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
    await showAlert('Please select a valid photo directory.', {
      title: 'Invalid Directory',
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
      await showAlert('Please configure grouping parameters first.', {
        title: 'Configuration Missing',
        tone: 'warning'
      });
    }
  } catch (error) {
    const message = getErrorMessage(error);
    console.error(`ui.home.start_analysis: failed err=${formatError(error)}`);
    await showAlert('Analysis failed: ' + message, {title: 'Analysis Failed', tone: 'error'});
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
      <h1>Photo Analysis</h1>
      <p>Select your photo directory to begin intelligent grouping and organization</p>
    </div>

    <div class="page-content glass-scrollbar">
      <WinCard title="Source Directory">
        <div class="input-group">
          <div class="path-input">
            <input type="text"
                   v-model="selectedDirectory"
                   placeholder="Select photo directory..."
                   class="glass-input"
            />
          </div>
          <WinButton @click="selectSourceDir">
            <IconFolder :size="16"/>
            Browse
          </WinButton>
        </div>
        <div class="options-row">
          <WinCheckbox v-model="recursive" label="Include subdirectories"/>
        </div>
      </WinCard>

      <WinCard title="Processing Mode">
        <div class="options-group">
          <WinCheckbox v-model="copyMode" label="Copy files (preserve originals)"/>
          <WinCheckbox v-model="overwrite" label="Overwrite existing files"/>
        </div>
        <div class="input-group">
          <div class="path-input">
            <input type="text"
                   v-model="outputDirectory"
                   placeholder="Select output directory..."
                   class="glass-input"
            />
          </div>
          <WinButton @click="selectOutputDir">
            <IconFolder :size="16"/>
            Browse
          </WinButton>
        </div>
      </WinCard>

      <WinCard title="Status">
        <div class="status-info">
          <div class="status-item">
            <span class="label">Photos</span>
            <span class="value">{{ store.photosNumber }}</span>
          </div>
          <div class="status-item">
            <span class="label">Groups</span>
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
            {{ store.isAnalyzing ? 'Analyzing...' : 'Start Analysis' }}
          </WinButton>
          <WinButton size="large"
                     :disabled="store.groupsNumber === 0"
                     @click="$router.push('/edit')"
          >
            Edit Groups
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
  margin-top: var(--prim-space-4);
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