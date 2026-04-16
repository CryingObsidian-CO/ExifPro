<script setup lang="ts">
import WinCard from "../component/WinCard.vue";
import {store} from "../store/store.ts";
import WinButton from "../component/WinButton.vue";
import WinCheckbox from "../component/WinCheckbox.vue";
import {computed, onMounted} from "vue";
import {useTauri} from "../composables/tauri.ts";
import {useRouter} from "vue-router";
import {useDialog} from "../composables/dialog.ts";

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

  return '未知错误';
};

const selectSourceDir = async () => {
  const path = await tauriImpl.selectDirectory();
  if (path) {
    store.selectedDirectory = path;
  }
};

const selectOutputDir = async () => {
  const path = await tauriImpl.selectDirectory();
  if (path) {
    store.outputDirectory = path;
  }
};

const startAnalysis = async () => {
  if (!store.selectedDirectory) {
    await showAlert('请选择有效的照片目录', {title: '目录无效', tone: 'warning'});
    return;
  }

  store.isAnalyzing = true;
  try {
    const photos = await tauriImpl.scanDirectory(store.selectedDirectory, store.recursive);
    store.photos = photos;

    if (store.config) {
      store.groups = await tauriImpl.groupPhotos(photos, store.config);
      await router.push('/edit');
    } else {
      await showAlert('请先配置分组参数', {title: '缺少配置', tone: 'warning'});
    }
  } catch (error) {
    const message = getErrorMessage(error);
    console.error('分析失败:', error);
    await showAlert('分析失败: ' + message, {title: '分析失败', tone: 'error'});
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


onMounted(async () => {
  if (!store.config) {
    try {
      store.config = await tauriImpl.loadConfig();
    } catch (error) {
      console.error('加载配置失败，已重置默认配置:', error);
      store.config = await tauriImpl.resetConfig();
      await showAlert('配置文件读取失败，已恢复为默认配置。', {title: '配置已重置', tone: 'warning'});
    }
  }
});
</script>

<template>
  <div class="home-page">
    <div class="page-header">
      <h1>照片智能分组与整理</h1>
      <p>选择您的照片目录，开始智能分组和整理</p>
    </div>

    <div class="page-content">
      <WinCard title="选择照片目录">
        <div class="input-group">
          <div class="path-input">
            <input type="text"
                   v-model="selectedDirectory"
                   placeholder="请选择照片目录...">
          </div>
          <WinButton @click="selectSourceDir">浏览...</WinButton>
        </div>
        <div class="options-row">
          <WinCheckbox v-model="recursive" label="包含子目录"/>
        </div>
      </WinCard>

      <WinCard title="处理模式">
        <div class="options-group">
          <WinCheckbox v-model="copyMode" label="复制文件（不移动原文件）"/>
          <WinCheckbox v-model="overwrite" label="覆盖已存在的文件"/>
        </div>
        <div class="input-group">
          <div class="path-input">
            <input type="text"
                   v-model="outputDirectory"
                   placeholder="请选择输出目录..."
            />
          </div>
          <WinButton @click="selectOutputDir">浏览...</WinButton>
        </div>
      </WinCard>

      <WinCard title="状态">
        <div class="status-info">
          <div class="status-item">
            <span class="label">照片数量:</span>
            <span class="value">{{ store.photosNumber }}</span>
          </div>
          <div class="status-item">
            <span class="label">分组数量:</span>
            <span class="value">{{ store.groupsNumber }}</span>
          </div>
        </div>
        <div class="action-buttons">
          <WinButton variant="primary"
                     size="large"
                     :disabled="store.isAnalyzing || !store.selectedDirectory"
                     @click="startAnalysis"
          >
            {{ store.isAnalyzing ? '分析中...' : '开始分析' }}
          </WinButton>
          <WinButton size="large"
                     :disabled="store.groupsNumber === 0"
                     @click="$router.push('/edit')"
          >
            编辑分组
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
  padding: 16px 32px;
  border-bottom: 1px solid var(--color-border);
}

.page-header h1 {
  font-size: 24px;
  font-weight: 600;
  margin-bottom: 4px;
}

.page-header p {
  color: var(--color-text-secondary);
  font-size: 14px;
}

.page-content {
  flex: 1;
  padding: 24px 32px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.input-group {
  display: flex;
  gap: 12px;
  align-items: center;
}

.path-input {
  flex: 1;
}

.path-input input {
  width: 100%;
  padding: 10px 14px;
  border: 1px solid var(--color-border);
  border-radius: var(--border-radius);
  background-color: var(--color-bg-tertiary);
  color: var(--color-text);
  font-size: 14px;
  outline: none;
}

.options-row {
  margin-top: 16px;
}

.options-group {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 20px;
}

.status-info {
  display: flex;
  gap: 32px;
  margin-bottom: 20px;
}

.status-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.status-item .label {
  color: var(--color-text-secondary);
  font-size: 13px;
}

.status-item .value {
  font-size: 20px;
  font-weight: 600;
}

.action-buttons {
  display: flex;
  gap: 12px;
}
</style>