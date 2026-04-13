<script setup lang="ts">
import WinButton from "../component/WinButton.vue";
import WinCard from "../component/WinCard.vue";
import {useStore} from "../store/store.ts";
import {useTauri} from "../composables/tauri.ts";
import {Theme} from "../types";
import {onMounted, ref} from "vue";
import WinInput from "../component/WinInput.vue";
import {onBeforeRouteLeave} from "vue-router";
import {confirm} from '@tauri-apps/plugin-dialog'

const store = useStore();
const tauri = useTauri();
const dirty = ref(false);

function clampTimeValue(v: string | number): number {
  const n = Number(v);
  if (isNaN(n)) return 0;
  if (n < 0 && n !== -1) return -1;
  return n;
}

function markDirty() {
  dirty.value = true;
}

function updateField(obj: any, key: string, value: any) {
  if (obj) {
    obj[key] = value;
    markDirty();
  }
}

async function saveSettings() {
  const config = store.getConfig();
  if (config) {
    try {
      await tauri.saveConfig(config);
      dirty.value = false;
      alert('设置已保存');
    } catch (error) {
      console.error('保存设置失败:', error);
      alert('保存设置失败');
    }
  }
}

async function resetSettings() {
  try {
    const config = await tauri.resetConfig();
    store.setConfig(config);
    dirty.value = false;
    alert('已重置为默认设置');
  } catch (error) {
    console.error('重置设置失败:', error);
    alert('重置设置失败');
  }
}

async function setTheme(theme: Theme) {
  store.setTheme(theme);
}

async function reloadConfig() {
  try {
    const config = await tauri.loadConfig();
    store.setConfig(config);
  } catch {
    await tauri.resetConfig();
  }
}

onBeforeRouteLeave(async (_to, _from) => {
  if (!dirty.value) {
    return;
  }
  const save = await confirm('设置已修改但未保存，是否保存？');
  if (save) {
    const config = store.getConfig();
    if (config) {
      try {
        await tauri.saveConfig(config);
      } catch (error) {
        console.error('保存设置失败:', error);
      }
    }
    dirty.value = false;
  } else {
    await reloadConfig();
    dirty.value = false;
    return "/settings"
  }
});

onMounted(async () => {
  if (!store.getConfig()) {
    await reloadConfig()
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

      <WinCard title="包围曝光设置">
        <template #header-extra>
          <span class="card-type-badge aeb-badge">AEB</span>
        </template>
        <div class="settings-grid">
          <div class="setting-item">
            <label class="setting-label has-tooltip"
                   data-tooltip="AEB 组中第一张与最后一张照片之间的最大允许时间差（秒）。首尾时间差超过此值的照片序列不会被识别为 AEB 组。通常 AEB 拍摄速度很快，建议设为 0.3~1.0 秒。填写 -1 表示不限制此时间条件。"
            >首尾最大跨度（秒）</label>
            <WinInput type="number"
                      :modelValue="store.getConfig()?.aeb_settings.max_span || 0"
                      @update:modelValue="(v) => updateField(store.getConfig()?.aeb_settings, 'max_span', clampTimeValue(v))"
            />
          </div>
          <div class="setting-item">
            <label class="setting-label has-tooltip"
                   data-tooltip="AEB 组中相邻两张照片之间的最小时间间隔（秒）。间隔小于此值可能是同一张照片的重复记录而非独立拍摄，有助于过滤异常数据。建议设为 0.01~0.1 秒。填写 -1 表示不限制此时间条件。"
            >相邻最小间隔（秒）</label>
            <WinInput type="number"
                      :modelValue="store.getConfig()?.aeb_settings.min_consecutive_interval || 0"
                      @update:modelValue="(v) => updateField(store.getConfig()?.aeb_settings, 'min_consecutive_interval', clampTimeValue(v))"
            />
          </div>
          <div class="setting-item">
            <label class="setting-label has-tooltip"
                   data-tooltip="AEB 组中相邻两张照片之间的最大时间间隔（秒）。相邻照片间隔超过此值表明可能不属于同一 AEB 序列，有助于区分不同的 AEB 拍摄组。建议设为 0.1~0.5 秒。填写 -1 表示不限制此时间条件。"
            >相邻最大间隔（秒）</label>
            <WinInput type="number"
                      :modelValue="store.getConfig()?.aeb_settings.max_consecutive_interval || 0"
                      @update:modelValue="(v) => updateField(store.getConfig()?.aeb_settings, 'max_consecutive_interval', clampTimeValue(v))"
            />
          </div>
          <div class="setting-item">
            <label class="setting-label has-tooltip"
                   data-tooltip="构成 AEB 组所需的最少照片数量。少于该数量的照片序列不会被识别为 AEB 组。典型 AEB 拍摄为 3 张（欠曝、正常、过曝），部分相机支持 5 张或 7 张。"
            >最小数量</label>
            <WinInput type="number"
                      :modelValue="store.getConfig()?.aeb_settings.min_count || 0"
                      @update:modelValue="(v) => updateField(store.getConfig()?.aeb_settings, 'min_count', Number(v))"
            />
          </div>
        </div>
      </WinCard>

      <WinCard title="包围对焦设置">
        <template #header-extra>
          <span class="card-type-badge focus-badge">对焦包围</span>
        </template>
        <div class="settings-grid">
          <div class="setting-item">
            <label class="setting-label has-tooltip"
                   data-tooltip="对焦包围组中第一张与最后一张照片之间的最大允许时间差（秒）。首尾时间差超过此值的照片序列不会被识别为对焦包围组。对焦包围通常拍摄张数较多，建议设为 0.5~2.0 秒。填写 -1 表示不限制此时间条件。"
            >首尾最大跨度（秒）</label>
            <WinInput type="number"
                      :modelValue="store.getConfig()?.focus_bracket_settings.max_span || 0"
                      @update:modelValue="(v) => updateField(store.getConfig()?.focus_bracket_settings, 'max_span', clampTimeValue(v))"
            />
          </div>
          <div class="setting-item">
            <label class="setting-label has-tooltip"
                   data-tooltip="对焦包围组中相邻两张照片之间的最小时间间隔（秒）。间隔小于此值可能是同一张照片的重复记录而非独立拍摄，有助于过滤异常数据。建议设为 0.01~0.05 秒。填写 -1 表示不限制此时间条件。"
            >相邻最小间隔（秒）</label>
            <WinInput type="number"
                      :modelValue="store.getConfig()?.focus_bracket_settings.min_consecutive_interval || 0"
                      @update:modelValue="(v) => updateField(store.getConfig()?.focus_bracket_settings, 'min_consecutive_interval', clampTimeValue(v))"
            />
          </div>
          <div class="setting-item">
            <label class="setting-label has-tooltip"
                   data-tooltip="对焦包围组中相邻两张照片之间的最大时间间隔（秒）。相邻照片间隔超过此值表明可能不属于同一对焦包围序列，有助于区分不同的对焦包围拍摄组。建议设为 0.2~1.0 秒。填写 -1 表示不限制此时间条件。"
            >相邻最大间隔（秒）</label>
            <WinInput type="number"
                      :modelValue="store.getConfig()?.focus_bracket_settings.max_consecutive_interval || 0"
                      @update:modelValue="(v) => updateField(store.getConfig()?.focus_bracket_settings, 'max_consecutive_interval', clampTimeValue(v))"
            />
          </div>
          <div class="setting-item">
            <label class="setting-label has-tooltip"
                   data-tooltip="构成对焦包围组所需的最少照片数量。少于该数量的照片序列不会被识别为对焦包围组。对焦包围通常需要较多张数以覆盖完整景深范围，建议设为 3~7 张。"
            >最小数量</label>
            <WinInput type="number"
                      :modelValue="store.getConfig()?.focus_bracket_settings.min_count || 0"
                      @update:modelValue="(v) => updateField(store.getConfig()?.focus_bracket_settings, 'min_count', Number(v))"
            />
          </div>
        </div>
      </WinCard>

      <WinCard title="连拍设置">
        <template #header-extra>
          <span class="card-type-badge burst-badge">连拍</span>
        </template>
        <div class="settings-grid">
          <div class="setting-item">
            <label
                class="setting-label has-tooltip"
                data-tooltip="连拍组中相邻两张照片之间的最小时间间隔（秒）。间隔小于此值可能是同一张照片的重复记录而非独立拍摄，有助于过滤异常数据。建议设为 0.01~0.05 秒。填写 -1 表示不限制此时间条件。"
            >相邻最小间隔（秒）</label>
            <WinInput type="number"
                      :modelValue="store.getConfig()?.burst_settings.min_consecutive_interval || 0"
                      @update:modelValue="(v) => updateField(store.getConfig()?.burst_settings, 'min_consecutive_interval', clampTimeValue(v))"
            />
          </div>
          <div class="setting-item">
            <label
                class="setting-label has-tooltip"
                data-tooltip="连拍组中相邻两张照片之间的最大时间间隔（秒）。相邻照片间隔超过此值表明可能不属于同一连拍序列，有助于区分不同的连拍拍摄组。建议设为 0.3~1.0 秒，高速连拍可设更小值。填写 -1 表示不限制此时间条件。"
            >相邻最大间隔（秒）</label>
            <WinInput type="number"
                      :modelValue="store.getConfig()?.burst_settings.max_consecutive_interval || 0"
                      @update:modelValue="(v) => updateField(store.getConfig()?.burst_settings, 'max_consecutive_interval', clampTimeValue(v))"
            />
          </div>
          <div class="setting-item">
            <label
                class="setting-label has-tooltip"
                data-tooltip="构成连拍组所需的最少照片数量。少于该数量的照片序列不会被识别为连拍组。通常连拍至少需要 3 张以上才有意义。"
            >最小数量</label>
            <WinInput type="number"
                      :modelValue="store.getConfig()?.burst_settings.min_count || 0"
                      @update:modelValue="(v) => updateField(store.getConfig()?.burst_settings, 'min_count', Number(v))"
            />
          </div>
        </div>
      </WinCard>

      <WinCard title="命名规则">
        <div class="settings-grid">
          <div class="setting-item">
            <label class="setting-label has-tooltip"
                   data-tooltip="对焦包围组的输出目录名前缀。整理后的对焦包围照片将存放在以此前缀开头的目录中。例如前缀为 'FocusBracket_' 时，目录名为 'FocusBracket_xxxxxx'。"
            >对焦包围前缀</label>
            <WinInput :modelValue="store.getConfig()?.naming_rules.focus_bracketing_prefix || ''"
                      @update:modelValue="(v) => updateField(store.getConfig()?.naming_rules, 'focus_bracketing_prefix', v as string)"
            />
          </div>
          <div class="setting-item">
            <label class="setting-label has-tooltip"
                   data-tooltip="AEB 包围曝光组的输出目录名前缀。整理后的 AEB 照片将存放在以此前缀开头的目录中。例如前缀为 'AEB_' 时，目录名为 'AEB_xxxxxx'。"
            >AEB 前缀</label>
            <WinInput :modelValue="store.getConfig()?.naming_rules.aeb_prefix || ''"
                      @update:modelValue="(v) => updateField(store.getConfig()?.naming_rules, 'aeb_prefix', v as string)"
            />
          </div>
          <div class="setting-item">
            <label class="setting-label has-tooltip"
                   data-tooltip="连拍组的输出目录名前缀。整理后的连拍照片将存放在以此前缀开头的目录中。例如前缀为 'Burst_' 时，目录名为 'Burst_xxxxxx'。"
            >连拍前缀</label>
            <WinInput :modelValue="store.getConfig()?.naming_rules.burst_prefix || ''"
                      @update:modelValue="(v) => updateField(store.getConfig()?.naming_rules, 'burst_prefix', v as string)"
            />
          </div>
          <div class="setting-item">
            <label class="setting-label has-tooltip"
                   data-tooltip="单张照片的输出目录名前缀。未被分组的单张照片将存放在以此前缀开头的目录中。留空表示单张照片不添加前缀，直接使用原文件名。"
            >单张前缀</label>
            <WinInput :modelValue="store.getConfig()?.naming_rules.single_prefix || ''"
                      @update:modelValue="(v) => updateField(store.getConfig()?.naming_rules, 'single_prefix', v as string)"
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

.setting-label.has-tooltip {
  cursor: help;
  position: relative;
}

.setting-label.has-tooltip::after {
  content: attr(data-tooltip);
  position: absolute;
  left: 0;
  top: 100%;
  z-index: 1000;
  padding: 10px 14px;
  border-radius: var(--border-radius);
  background-color: var(--color-bg-tertiary);
  border: 1px solid var(--color-border);
  box-shadow: var(--shadow-lg);
  color: var(--color-text);
  font-size: 13px;
  line-height: 1.5;
  white-space: normal;
  width: 320px;
  pointer-events: none;
  opacity: 0;
  transform: translateY(4px);
  transition: opacity 0.2s ease, transform 0.2s ease;
}

.setting-label.has-tooltip:hover::after {
  opacity: 1;
  transform: translateY(0);
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

.card-type-badge {
  display: inline-block;
  padding: 2px 10px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 600;
  line-height: 1.6;
}

.aeb-badge {
  background-color: var(--color-aeb);
  color: #fff;
}

.focus-badge {
  background-color: var(--color-focus-bracketing);
  color: #fff;
}

.burst-badge {
  background-color: var(--color-burst);
  color: #fff;
}

.action-buttons {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding-top: 8px;
}
</style>