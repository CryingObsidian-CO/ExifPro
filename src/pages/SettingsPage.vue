<script setup lang="ts">
import WinButton from "../component/WinButton.vue";
import WinCard from "../component/WinCard.vue";
import {useStore} from "../store/store.ts";
import {useTauri} from "../composables/tauri.ts";
import {Theme} from "../types";
import {onMounted} from "vue";
import WinInput from "../component/WinInput.vue";

const store = useStore();
const tauri = useTauri();

async function saveSettings() {
  const config = store.getConfig();
  if (config) {
    try {
      await tauri.saveConfig(config);
      alert('设置已保存');
    } catch (error) {
      console.error('保存设置失败:', error);
      alert('保存设置失败');
    }
  }
}

async function resetSettings() {
  await tauri.resetConfig();
}

async function setTheme(theme: Theme) {
  store.setTheme(theme);
}

onMounted(async () => {
  if (!store.getConfig()) {
    try {
      const config = await tauri.loadConfig();
      store.setConfig(config);
    } catch {
      await tauri.resetConfig();
    }
  }
});
</script>

<template>
  <div class="settings-page">
    <div class="page-header">
      <h1>设置</h1>
      <p>配置分组参数、命名规则和主题</p>
    </div>

    <div class="page-content">
      <WinCard title="外观">
        <div class="setting-section">
          <label class="setting-label">主题</label>
          <div class="theme-options">
            <button
                class="theme-option"
                :class="{ active: store.getTheme() === 'light' }"
                @click="setTheme('light')"
            >
              <span class="theme-icon">☀️</span>
              <span>浅色</span>
            </button>
            <button
                class="theme-option"
                :class="{ active: store.getTheme() === 'dark' }"
                @click="setTheme('dark')"
            >
              <span class="theme-icon">🌙</span>
              <span>深色</span>
            </button>
            <button
                class="theme-option"
                :class="{ active: store.getTheme() === 'system' }"
                @click="setTheme('system')"
            >
              <span class="theme-icon">💻</span>
              <span>跟随系统</span>
            </button>
          </div>
        </div>
      </WinCard>

      <WinCard title="时间阈值（秒）">
        <div class="settings-grid">
          <div class="setting-item">
            <label class="setting-label">连拍最大间隔</label>
            <WinInput type="number"
                      :modelValue="store.getConfig()?.time_thresholds.burst_max_interval || 0"
                      @update:modelValue="(v) =>
                  store.getConfig() &&
                  (store.getConfig()!.time_thresholds.burst_max_interval = Number(v))
              "
            />
          </div>
          <div class="setting-item">
            <label class="setting-label">AEB 最大跨度</label>
            <WinInput type="number"
                      :modelValue="store.getConfig()?.time_thresholds.aeb_max_span || 0"
                      @update:modelValue="(v) =>
                  store.getConfig() &&
                  (store.getConfig()!.time_thresholds.aeb_max_span = Number(v))
              "
            />
          </div>
          <div class="setting-item">
            <label class="setting-label">对焦包围最大跨度</label>
            <WinInput type="number"
                      :modelValue="store.getConfig()?.time_thresholds.focus_bracket_max_span || 0"
                      @update:modelValue="(v) =>
                  store.getConfig() &&
                  (store.getConfig()!.time_thresholds.focus_bracket_max_span = Number(v))
              "
            />
          </div>
          <div class="setting-item">
            <label class="setting-label">最小分组间隔</label>
            <WinInput type="number"
                      :modelValue="store.getConfig()?.time_thresholds.min_group_interval || 0"
                      @update:modelValue="(v) =>
                  store.getConfig() &&
                  (store.getConfig()!.time_thresholds.min_group_interval = Number(v))
              "
            />
          </div>
        </div>
      </WinCard>

      <WinCard title="分组参数">
        <div class="settings-grid">
          <div class="setting-item">
            <label class="setting-label">连拍最小数量</label>
            <WinInput type="number"
                      :modelValue="store.getConfig()?.group_parameters.burst_min_count || 0"
                      @update:modelValue="(v) =>
                  store.getConfig() &&
                  (store.getConfig()!.group_parameters.burst_min_count = Number(v))
              "
            />
          </div>
          <div class="setting-item">
            <label class="setting-label">AEB 最小数量</label>
            <WinInput type="number"
                      :modelValue="store.getConfig()?.group_parameters.aeb_min_count || 0"
                      @update:modelValue="(v) =>
                  store.getConfig() &&
                  (store.getConfig()!.group_parameters.aeb_min_count = Number(v))
              "
            />
          </div>
          <div class="setting-item">
            <label class="setting-label">对焦包围最小数量</label>
            <WinInput type="number"
                      :modelValue="store.getConfig()?.group_parameters.focus_bracket_min_count || 0"
                      @update:modelValue="(v) =>
                  store.getConfig() &&
                  (store.getConfig()!.group_parameters.focus_bracket_min_count = Number(v))
              "
            />
          </div>
        </div>
      </WinCard>

      <WinCard title="命名规则">
        <div class="settings-grid">
          <div class="setting-item">
            <label class="setting-label">对焦包围前缀</label>
            <WinInput :modelValue="store.getConfig()?.naming_rules.focus_bracketing_prefix || ''"
                      @update:modelValue="(v) =>
                  store.getConfig() &&
                  (store.getConfig()!.naming_rules.focus_bracketing_prefix = v as string)
              "
            />
          </div>
          <div class="setting-item">
            <label class="setting-label">AEB 前缀</label>
            <WinInput :modelValue="store.getConfig()?.naming_rules.aeb_prefix || ''"
                      @update:modelValue="(v) =>
                  store.getConfig() &&
                  (store.getConfig()!.naming_rules.aeb_prefix = v as string)
              "
            />
          </div>
          <div class="setting-item">
            <label class="setting-label">连拍前缀</label>
            <WinInput :modelValue="store.getConfig()?.naming_rules.burst_prefix || ''"
                      @update:modelValue="(v) =>
                  store.getConfig() &&
                  (store.getConfig()!.naming_rules.burst_prefix = v as string)
              "
            />
          </div>
          <div class="setting-item">
            <label class="setting-label">单张前缀</label>
            <WinInput :modelValue="store.getConfig()?.naming_rules.single_prefix || ''"
                      @update:modelValue="(v) =>
                  store.getConfig() &&
                  (store.getConfig()!.naming_rules.single_prefix = v as string)
              "
            />
          </div>
        </div>
      </WinCard>

      <div class="action-buttons">
        <WinButton variant="danger" @click="resetSettings">重置默认</WinButton>
        <WinButton variant="primary" @click="saveSettings">保存设置</WinButton>
      </div>
    </div>
  </div>
</template>

<style scoped>
.settings-page {
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

.setting-section {
  margin-bottom: 8px;
}

.setting-label {
  display: block;
  font-size: 14px;
  color: var(--color-text);
  margin-bottom: 12px;
}

.theme-options {
  display: flex;
  gap: 12px;
}

.theme-option {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 16px;
  border: 2px solid var(--color-border);
  border-radius: var(--border-radius);
  background-color: var(--color-bg-secondary);
  transition: all var(--transition-fast);
}

.theme-option:hover {
  border-color: var(--color-border-hover);
}

.theme-option.active {
  border-color: var(--color-accent);
  background-color: var(--color-accent-light);
}

.theme-icon {
  font-size: 24px;
}

.settings-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 20px;
}

.setting-item {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.action-buttons {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding-top: 8px;
}
</style>