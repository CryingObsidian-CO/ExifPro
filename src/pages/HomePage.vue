<script setup lang="ts">
import WinCard from "../component/WinCard.vue";
import {useStore} from "../store/store.ts";
import WinButton from "../component/WinButton.vue";
import WinCheckbox from "../component/WinCheckbox.vue";
import {computed, onMounted} from "vue";
import {useTauri} from "../composables/tauri.ts";
import {useRouter} from "vue-router";
import {useDialog} from "../composables/dialog.ts";

const router = useRouter();
const store = useStore();
const tauriImpl = useTauri();
const {showAlert} = useDialog();

const selectSourceDir = async () => {
  const path = await tauriImpl.selectDirectory();
  if (path) {
    store.setSelectedDirectory(path);
  }
};

const selectOutputDir = async () => {
  const path = await tauriImpl.selectDirectory();
  if (path) {
    store.setOutputDirectory(path);
  }
};

const startAnalysis = async () => {
  if (!store.getSelectedDirectory()) {
    await showAlert('请选择有效的照片目录', {title: '目录无效', tone: 'warning'});
    return;
  }

  store.setIsAnalyzing(true);
  try {
    const photos = await tauriImpl.scanDirectory(store.getSelectedDirectory(), store.getRecursive());
    store.setPhotos(photos);

    if (store.getConfig()) {
      const groups = await tauriImpl.groupPhotos(photos, store.getConfig());
      store.setGroups(groups);
      await router.push('/edit');
    } else {
      await showAlert('请先配置分组参数', {title: '缺少配置', tone: 'warning'});
    }
  } catch (e) {
    console.error('分析失败:', e);
    await showAlert('分析失败: ' + (e as Error).message, {title: '分析失败', tone: 'error'});
  } finally {
    store.setIsAnalyzing(false);
  }
};

const recursive = computed({
  get: () => store.getRecursive(),
  set: (val) => store.setRecursive(val),
});

const copyMode = computed({
  get: () => store.getCopyMode(),
  set: (val) => store.setCopyMode(val),
});

const overwrite = computed({
  get: () => store.getOverwrite(),
  set: (val) => store.setOverwrite(val),
});

onMounted(async () => {
  if (!store.getConfig()) {
    try {
      const config = await tauriImpl.loadConfig();
      store.setConfig(config);
    } catch {
      const config = await tauriImpl.resetConfig();
      store.setConfig(config);
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
                   :value="store.getSelectedDirectory()"
                   readonly
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
                   :value="store.getOutputDirectory()"
                   readonly
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
            <span class="value">{{ store.getPhotosNumber() }}</span>
          </div>
          <div class="status-item">
            <span class="label">分组数量:</span>
            <span class="value">{{ store.getGroupsNumber() }}</span>
          </div>
        </div>
        <div class="action-buttons">
          <WinButton variant="primary"
                     size="large"
                     :disabled="store.getIsAnalyzing() || !store.getSelectedDirectory()"
                     @click="startAnalysis"
          >
            {{ store.getIsAnalyzing() ? '分析中...' : '开始分析' }}
          </WinButton>
          <WinButton size="large"
                     :disabled="store.getGroupsNumber() === 0"
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