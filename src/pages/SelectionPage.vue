<script setup lang="ts">
import WinCard from "../component/WinCard.vue";
import WinButton from "../component/WinButton.vue";
import WinCheckbox from "../component/WinCheckbox.vue";
import {computed, ref} from "vue";
import {useTauri} from "../composables/tauri.ts";
import {useDialog} from "../composables/dialog.ts";
import {useI18n} from 'vue-i18n';
import IconFolder from "../component/icons/IconFolder.vue";
import IconUpload from "../component/icons/IconUpload.vue";

const tauriImpl = useTauri();
const {showAlert} = useDialog();
const {t} = useI18n();

const selectionDirValue = ref('');
const includeSubdirsValue = ref(true);
const isSelectingValue = ref(false);

const selectDir = async () => {
  const path = await tauriImpl.selectDirectory();
  if (path) {
    console.info(`ui.selection.select_dir: selected path=${path}`);
    selectionDir.value = path;
  } else {
    console.info("ui.selection.select_dir: canceled");
  }
};

const selectionDir = computed({
  get: () => selectionDirValue.value,
  set: (val) => {
    selectionDirValue.value = val;
  },
});

const includeSubdirs = computed({
  get: () => includeSubdirsValue.value,
  set: (val) => {
    includeSubdirsValue.value = val;
  },
});

const isSelecting = computed({
  get: () => isSelectingValue.value,
  set: (val) => {
    isSelectingValue.value = val;
  },
});

const startSelection = async () => {
  if (!selectionDir.value) {
    console.warn("ui.selection.start_selection: missing_directory");
    await showAlert(t('selection.no_dir'), {
      title: t('selection.invalid_dir'),
      tone: 'warning'
    });
    return;
  }

  console.info(
      `ui.selection.start_selection: start dir=${selectionDir.value} recursive=${includeSubdirs.value}`
  );
  isSelecting.value = true;
  try {
    // TODO: 接入后端选片逻辑
    console.info("ui.selection.start_selection: complete");
    await showAlert(t('selection.complete'), {
      title: t('selection.complete_title'),
      tone: 'success'
    });
  } catch (error) {
    console.error(`ui.selection.start_selection: failed err=${error}`);
    await showAlert(t('selection.failed'), {
      title: t('selection.failed_title'),
      tone: 'error'
    });
  } finally {
    isSelecting.value = false;
  }
};
</script>

<template>
  <div class="selection-page">
    <div class="page-header">
      <h1>{{ t('selection.title') }}</h1>
      <p>{{ t('selection.subtitle') }}</p>
    </div>

    <div class="page-content glass-scrollbar">
      <WinCard :title="t('selection.source_dir')">
        <div class="input-group">
          <div class="path-input">
            <input type="text"
                   v-model="selectionDir"
                   :placeholder="t('selection.source_dir_placeholder')"
                   class="glass-input"
            />
          </div>
          <WinButton @click="selectDir">
            <IconFolder :size="16"/>
            {{ t('selection.browse') }}
          </WinButton>
        </div>
        <div class="options-row">
          <WinCheckbox v-model="includeSubdirs" :label="t('selection.include_subdirs')"/>
        </div>
      </WinCard>

      <WinCard :title="t('selection.action')">
        <div class="action-buttons">
          <WinButton variant="primary"
                     size="large"
                     :disabled="isSelecting || !selectionDir"
                     @click="startSelection"
          >
            <IconUpload :size="16"/>
            {{ isSelecting ? t('selection.selecting') : t('selection.start_selection') }}
          </WinButton>
        </div>
      </WinCard>
    </div>
  </div>
</template>

<style scoped>
.selection-page {
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

.action-buttons {
  display: flex;
  gap: var(--prim-space-3);
}
</style>