<script setup lang="ts">
import WinButton from "../component/WinButton.vue";
import WinCard from "../component/WinCard.vue";
import {store} from "../store/store.ts";
import {useTauri} from "../composables/tauri.ts";
import {Theme} from "../types";
import type {Config} from "../types/config.ts";
import {CAPABILITY_INFO, CapabilityType, PluginCapabilities} from "../types/plugin";
import {onMounted, ref} from "vue";
import WinInput from "../component/WinInput.vue";
import WinToggle from "../component/WinToggle.vue";
import {onBeforeRouteLeave} from "vue-router";
import {useDialog} from "../composables/dialog.ts";
import {formatError} from "../composables/logger";

const tauri = useTauri();
const {showAlert, showConfirm} = useDialog();
const dirty = ref(false);

function markDirty() {
  dirty.value = true;
}

function updateField(obj: any, key: string, value: any) {
  if (obj) {
    obj[key] = value;
    markDirty();
  }
}

function normalizeConfig(config: Config) {
  if (!config.plugin_settings) {
    config.plugin_settings = {};
  }
  if (!config.enabled_plugins) {
    config.enabled_plugins = [];
  }
}

// NOTE 确保存在插件配置对象，暂时保留
function ensurePluginConfig(pluginId: string) {
  const config = store.config;
  if (!config) {
    return null;
  }
  normalizeConfig(config);
  const existing = config.plugin_settings[pluginId];
  if (!existing || typeof existing !== 'object') {
    config.plugin_settings[pluginId] = {};
  }
  return config.plugin_settings[pluginId];
}

function syncPluginConfigDefaults() {
  const config = store.config;
  if (!config) {
    return;
  }
  normalizeConfig(config);
  let changed = false;
  for (const plugin of store.plugins) {
    const schema = plugin.manifest.config_schema;
    if (!schema) {
      continue;
    }
    const target = ensurePluginConfig(plugin.manifest.id);
    if (!target) {
      continue;
    }
    for (const [key, item] of Object.entries(schema)) {
      if (target[key] === undefined && item.default !== undefined) {
        target[key] = item.default;
        changed = true;
      }
    }
  }
  if (changed) {
    markDirty();
  }
}

function getPluginConfigValue(
    pluginId: string,
    key: string,
    schema: { type: string; default?: any }
) {
  const target = ensurePluginConfig(pluginId);
  if (!target) {
    return schema.default;
  }
  if (target[key] === undefined && schema.default !== undefined) {
    target[key] = schema.default;
  }
  return target[key];
}

function updatePluginConfig(pluginId: string, key: string, value: any) {
  const target = ensurePluginConfig(pluginId);
  if (!target) {
    return;
  }
  target[key] = value;
  markDirty();
}

function isPluginEnabled(pluginId: string) {
  const plugin = store.plugins.find(p => p.manifest.id === pluginId);
  if (plugin) {
    return plugin.enabled;
  }
  const config = store.config;
  if (!config) {
    return false;
  }
  normalizeConfig(config);
  return config.enabled_plugins.includes(pluginId);
}

async function saveSettings(): Promise<boolean> {
  const config = store.config;
  if (config) {
    console.info("ui.settings.save: start");
    try {
      normalizeConfig(config);
      await tauri.saveConfig(config);
      await store.syncPluginsEnabled(config.enabled_plugins);
      await reloadConfig();
      dirty.value = false;
      console.info("ui.settings.save: complete");
      await showAlert('设置已保存', {title: '保存成功', tone: 'success'});
      return true;
    } catch (error) {
      console.error(`ui.settings.save: failed err=${formatError(error)}`);
      await showAlert('保存设置失败，请稍后重试。', {title: '保存失败', tone: 'error'});
      return false;
    }
  }
  return true;
}

async function resetSettings() {
  console.info("ui.settings.reset: start");
  try {
    const config = await tauri.resetConfig();
    normalizeConfig(config);
    store.config = config;
    await store.syncPluginsEnabled(config.enabled_plugins);
    dirty.value = false;
    console.info("ui.settings.reset: complete");
    await showAlert('已重置为默认设置', {title: '重置成功', tone: 'success'});
  } catch (error) {
    console.error(`ui.settings.reset: failed err=${formatError(error)}`);
    await showAlert('重置设置失败，请稍后重试。', {title: '重置失败', tone: 'error'});
  }
}

async function setTheme(theme: Theme) {
  console.info(`ui.settings.theme: set value=${theme}`);
  store.theme = theme;
}

async function reloadConfig() {
  console.info("ui.settings.reload_config: start");
  try {
    const config = await tauri.loadConfig();
    normalizeConfig(config);
    store.config = config;
    syncPluginConfigDefaults();
    console.info("ui.settings.reload_config: complete");
  } catch (error) {
    console.error(`ui.settings.reload_config: failed err=${formatError(error)}`);
    const config = await tauri.resetConfig();
    normalizeConfig(config);
    store.config = config;
    await showAlert('配置文件读取失败，已恢复为默认配置。', {title: '配置已重置', tone: 'warning'});
  }
}

onBeforeRouteLeave(async (_to, _from) => {
  if (!dirty.value) {
    return;
  }
  const save = await showConfirm('设置已修改但未保存，是否保存后再离开？', {
    title: '未保存的更改',
    tone: 'warning',
    confirmText: '保存并离开',
    cancelText: '不保存并离开',
    closeOnOverlay: false,
  });
  if (save) {
    if (!await saveSettings()) {
      return false;
    }
  } else {
    await reloadConfig();
    dirty.value = false;
  }
});

onMounted(async () => {
  if (!store.config) {
    await reloadConfig()
  }
  syncPluginConfigDefaults();
});

async function loadPlugins() {
  console.info("ui.settings.load_plugins: start");
  await store.loadPlugins();
  syncPluginConfigDefaults();
  console.info("ui.settings.load_plugins: complete");
}

async function togglePlugin(pluginId: string, enabled: boolean) {
  const config = store.config;
  if (!config) {
    return;
  }
  console.info(`ui.settings.toggle_plugin: start id=${pluginId} enabled=${enabled}`);
  normalizeConfig(config);
  if (enabled) {
    if (!config.enabled_plugins.includes(pluginId)) {
      config.enabled_plugins.push(pluginId);
    }
  } else {
    config.enabled_plugins = config.enabled_plugins.filter((id) => id !== pluginId);
  }
  markDirty();
}

function getSortedPlugins() {
  return [...store.plugins].sort((a, b) => {
    const nameA = a.manifest.name?.toLowerCase() ?? '';
    const nameB = b.manifest.name?.toLowerCase() ?? '';
    if (nameA && nameB && nameA !== nameB) {
      return nameA.localeCompare(nameB);
    }
    return a.manifest.id.localeCompare(b.manifest.id);
  });
}

function getCapabilityLabel(type: CapabilityType): string {
  return CAPABILITY_INFO[type].label;
}

function getCapabilityRiskLevel(type: CapabilityType): 'low' | 'medium' | 'high' {
  return CAPABILITY_INFO[type].riskLevel;
}

function getCapabilityColor(type: CapabilityType): string {
  const risk = getCapabilityRiskLevel(type);

  switch (risk) {
    case "low":
      return 'var(--color-accent-light)';
    case "medium":
      return 'var(--color-warning-light)';
    case "high":
      return 'var(--color-error-light)';
  }
}

function getStandardCapabilities(capabilities: PluginCapabilities): CapabilityType[] {
  const result: CapabilityType[] = [];
  const capabilityTypes = Object.keys(CAPABILITY_INFO) as CapabilityType[];

  for (const type of capabilityTypes) {
    if (capabilities[type] === true) {
      result.push(type);
    }
  }

  return result;
}

function getCustomCapabilities(capabilities: PluginCapabilities): string[] {
  return capabilities.custom_capabilities?.filter((cap) => cap && cap.trim().length > 0) ?? [];
}

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
                :class="{ active: store.theme === 'light' }"
                @click="setTheme('light')"
            >
              <span class="theme-icon">☀️</span>
              <span>浅色</span>
            </button>
            <button
                class="theme-option"
                :class="{ active: store.theme === 'dark' }"
                @click="setTheme('dark')"
            >
              <span class="theme-icon">🌙</span>
              <span>深色</span>
            </button>
            <button
                class="theme-option"
                :class="{ active: store.theme === 'system' }"
                @click="setTheme('system')"
            >
              <span class="theme-icon">💻</span>
              <span>跟随系统</span>
            </button>
          </div>
        </div>
      </WinCard>

      <WinCard title="预览设置">
        <div class="settings-grid">
          <div class="setting-item">
            <label class="setting-label has-tooltip"
                   data-tooltip="单张图片预览的最大大小（MB）。超过此大小时不生成预览。设置为 0 可禁用预览。当前仅对常见位图格式生效，RAW 预览暂不生效。"
            >预览最大大小（MB）</label>
            <WinInput type="number"
                      :step="1"
                      :min="0"
                      :integerOnly="true"
                      :modelValue="store.config?.preview_max_mb || 8"
                      @update:modelValue="(v) => updateField(store.config, 'preview_max_mb', Number(v))"
            />
          </div>
          <div class="setting-item">
            <label class="setting-label has-tooltip"
                   data-tooltip="拍摄时间中子秒部分的显示位数。设为 0 则隐藏子秒。"
            >子秒显示位数</label>
            <WinInput type="number"
                      :step="1"
                      :min="0"
                      :max="9"
                      :integerOnly="true"
                      :modelValue="store.config?.sub_second_digits ?? 3"
                      @update:modelValue="(v) => updateField(store.config, 'sub_second_digits', Number(v))"
            />
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
                      :step="0.1"
                      :min="0"
                      allow-negative-one
                      :modelValue="store.config?.aeb_settings.max_span || 0"
                      @update:modelValue="(v) => updateField(store.config?.aeb_settings, 'max_span', Number(v))"
            />
          </div>
          <div class="setting-item">
            <label class="setting-label has-tooltip"
                   data-tooltip="AEB 组中相邻两张照片之间的最小时间间隔（秒）。间隔小于此值可能是同一张照片的重复记录而非独立拍摄，有助于过滤异常数据。建议设为 0.01~0.1 秒。填写 -1 表示不限制此时间条件。"
            >相邻最小间隔（秒）</label>
            <WinInput type="number"
                      :step="0.1"
                      :min="0"
                      allow-negative-one
                      :modelValue="store.config?.aeb_settings.min_consecutive_interval || 0"
                      @update:modelValue="(v) => updateField(store.config?.aeb_settings, 'min_consecutive_interval', Number(v))"
            />
          </div>
          <div class="setting-item">
            <label class="setting-label has-tooltip"
                   data-tooltip="AEB 组中相邻两张照片之间的最大时间间隔（秒）。相邻照片间隔超过此值表明可能不属于同一 AEB 序列，有助于区分不同的 AEB 拍摄组。建议设为 0.1~0.5 秒。填写 -1 表示不限制此时间条件。"
            >相邻最大间隔（秒）</label>
            <WinInput type="number"
                      :step="0.1"
                      :min="0"
                      allow-negative-one
                      :modelValue="store.config?.aeb_settings.max_consecutive_interval || 0"
                      @update:modelValue="(v) => updateField(store.config?.aeb_settings, 'max_consecutive_interval', Number(v))"
            />
          </div>
          <div class="setting-item">
            <label class="setting-label has-tooltip"
                   data-tooltip="构成 AEB 组所需的最少照片数量。少于该数量的照片序列不会被识别为 AEB 组。典型 AEB 拍摄为 3 张（欠曝、正常、过曝），部分相机支持 5 张或 7 张。"
            >最小数量</label>
            <WinInput type="number"
                      :step="1"
                      :min="2"
                      inputmode="numeric"
                      :integerOnly="true"
                      :modelValue="store.config?.aeb_settings.min_count || 0"
                      @update:modelValue="(v) => updateField(store.config?.aeb_settings, 'min_count', Number(v))"
            />
          </div>
          <div class="setting-item">
            <label class="setting-label has-tooltip"
                   data-tooltip="开启后，仅当照片的 EXIF 曝光模式（ExposureMode）为「自动包围」（值为 2）时，才会被识别为 AEB 组。手动包围曝光（手动多次拍摄不同曝光参数的照片）将不被识别为 AEB。关闭此选项则不检查曝光模式，仅依据曝光参数变化进行识别。"
            >仅允许自动包围曝光</label>
            <WinToggle
                :modelValue="store.config?.aeb_settings.auto_bracket_only || false"
                @update:modelValue="(v) => updateField(store.config?.aeb_settings, 'auto_bracket_only', v)"
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
                   data-tooltip="关闭后不再识别对焦包围组，以避免与连拍混淆；仅在需要对焦包围时再开启。"
            >启用对焦包围识别</label>
            <WinToggle
                :modelValue="store.config?.focus_bracket_settings.enabled || false"
                @update:modelValue="(v) => updateField(store.config?.focus_bracket_settings, 'enabled', v)"
            />
          </div>
          <div class="setting-item">
            <label class="setting-label has-tooltip"
                   data-tooltip="对焦包围组中第一张与最后一张照片之间的最大允许时间差（秒）。首尾时间差超过此值的照片序列不会被识别为对焦包围组。对焦包围通常拍摄张数较多，建议设为 0.5~2.0 秒。填写 -1 表示不限制此时间条件。"
            >首尾最大跨度（秒）</label>
            <WinInput type="number"
                      :step="0.1"
                      :min="0"
                      allow-negative-one
                      :modelValue="store.config?.focus_bracket_settings.max_span || 0"
                      @update:modelValue="(v) => updateField(store.config?.focus_bracket_settings, 'max_span', Number(v))"
            />
          </div>
          <div class="setting-item">
            <label class="setting-label has-tooltip"
                   data-tooltip="对焦包围组中相邻两张照片之间的最小时间间隔（秒）。间隔小于此值可能是同一张照片的重复记录而非独立拍摄，有助于过滤异常数据。建议设为 0.01~0.05 秒。填写 -1 表示不限制此时间条件。"
            >相邻最小间隔（秒）</label>
            <WinInput type="number"
                      :step="0.1"
                      :min="0"
                      allow-negative-one
                      :modelValue="store.config?.focus_bracket_settings.min_consecutive_interval || 0"
                      @update:modelValue="(v) => updateField(store.config?.focus_bracket_settings, 'min_consecutive_interval', Number(v))"
            />
          </div>
          <div class="setting-item">
            <label class="setting-label has-tooltip"
                   data-tooltip="对焦包围组中相邻两张照片之间的最大时间间隔（秒）。相邻照片间隔超过此值表明可能不属于同一对焦包围序列，有助于区分不同的对焦包围拍摄组。建议设为 0.2~1.0 秒。填写 -1 表示不限制此时间条件。"
            >相邻最大间隔（秒）</label>
            <WinInput type="number"
                      :step="0.1"
                      :min="0"
                      allow-negative-one
                      :modelValue="store.config?.focus_bracket_settings.max_consecutive_interval || 0"
                      @update:modelValue="(v) => updateField(store.config?.focus_bracket_settings, 'max_consecutive_interval', Number(v))"
            />
          </div>
          <div class="setting-item">
            <label class="setting-label has-tooltip"
                   data-tooltip="构成对焦包围组所需的最少照片数量。少于该数量的照片序列不会被识别为对焦包围组。对焦包围通常需要较多张数以覆盖完整景深范围，建议设为 3~7 张。"
            >最小数量</label>
            <WinInput type="number"
                      :step="1"
                      :min="2"
                      :integerOnly="true"
                      :modelValue="store.config?.focus_bracket_settings.min_count || 0"
                      @update:modelValue="(v) => updateField(store.config?.focus_bracket_settings, 'min_count', Number(v))"
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
                      :step="0.1"
                      :min="0"
                      allow-negative-one
                      :modelValue="store.config?.burst_settings.min_consecutive_interval || 0"
                      @update:modelValue="(v) => updateField(store.config?.burst_settings, 'min_consecutive_interval', Number(v))"
            />
          </div>
          <div class="setting-item">
            <label
                class="setting-label has-tooltip"
                data-tooltip="连拍组中相邻两张照片之间的最大时间间隔（秒）。相邻照片间隔超过此值表明可能不属于同一连拍序列，有助于区分不同的连拍拍摄组。建议设为 0.3~1.0 秒，高速连拍可设更小值。填写 -1 表示不限制此时间条件。"
            >相邻最大间隔（秒）</label>
            <WinInput type="number"
                      :step="0.1"
                      :min="0"
                      allow-negative-one
                      :modelValue="store.config?.burst_settings.max_consecutive_interval || 0"
                      @update:modelValue="(v) => updateField(store.config?.burst_settings, 'max_consecutive_interval', Number(v))"
            />
          </div>
          <div class="setting-item">
            <label
                class="setting-label has-tooltip"
                data-tooltip="构成连拍组所需的最少照片数量。少于该数量的照片序列不会被识别为连拍组。通常连拍至少需要 3 张以上才有意义。"
            >最小数量</label>
            <WinInput type="number"
                      :step="1"
                      :min="2"
                      :integerOnly="true"
                      :modelValue="store.config?.burst_settings.min_count || 0"
                      @update:modelValue="(v) => updateField(store.config?.burst_settings, 'min_count', Number(v))"
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
            <WinInput :modelValue="store.config?.naming_rules.focus_bracketing_prefix || ''"
                      @update:modelValue="(v) => updateField(store.config?.naming_rules, 'focus_bracketing_prefix', v as string)"
            />
          </div>
          <div class="setting-item">
            <label class="setting-label has-tooltip"
                   data-tooltip="AEB 包围曝光组的输出目录名前缀。整理后的 AEB 照片将存放在以此前缀开头的目录中。例如前缀为 'AEB_' 时，目录名为 'AEB_xxxxxx'。"
            >AEB 前缀</label>
            <WinInput :modelValue="store.config?.naming_rules.aeb_prefix || ''"
                      @update:modelValue="(v) => updateField(store.config?.naming_rules, 'aeb_prefix', v as string)"
            />
          </div>
          <div class="setting-item">
            <label class="setting-label has-tooltip"
                   data-tooltip="连拍组的输出目录名前缀。整理后的连拍照片将存放在以此前缀开头的目录中。例如前缀为 'Burst_' 时，目录名为 'Burst_xxxxxx'。"
            >连拍前缀</label>
            <WinInput :modelValue="store.config?.naming_rules.burst_prefix || ''"
                      @update:modelValue="(v) => updateField(store.config?.naming_rules, 'burst_prefix', v as string)"
            />
          </div>
          <div class="setting-item">
            <label class="setting-label has-tooltip"
                   data-tooltip="单张照片的输出目录名前缀。未被分组的单张照片将存放在以此前缀开头的目录中。留空表示单张照片不添加前缀，直接使用原文件名。"
            >单张前缀</label>
            <WinInput :modelValue="store.config?.naming_rules.single_prefix || ''"
                      @update:modelValue="(v) => updateField(store.config?.naming_rules, 'single_prefix', v as string)"
            />
          </div>
        </div>
      </WinCard>

      <WinCard title="插件管理">
        <template #header-extra>
          <span class="card-type-badge plugin-badge">Plugins</span>
        </template>
        <div class="plugin-section">
          <div v-if="!store.pluginsInitialized" class="plugin-loading">
            <WinButton variant="secondary" @click="loadPlugins">加载插件</WinButton>
          </div>
          <div v-else-if="store.plugins.length === 0" class="plugin-empty">
            <p>未发现插件</p>
            <p class="plugin-hint">将插件 ZIP 文件放入程序目录下的 plugins/ 文件夹</p>
          </div>
          <div v-else class="plugin-list">
            <div v-for="plugin in getSortedPlugins()" :key="plugin.manifest.id" class="plugin-item">
              <div class="plugin-info">
                <div class="plugin-header">
                  <span class="plugin-name">{{ plugin.manifest.name }}</span>
                  <span v-if="plugin.builtin" class="plugin-builtin-badge">内置</span>
                  <span class="plugin-version">v{{ plugin.manifest.version }}</span>
                </div>
                <p v-if="plugin.manifest.description" class="plugin-description">
                  {{ plugin.manifest.description }}
                </p>
                <div class="plugin-meta">
                  <span v-if="plugin.manifest.author"
                        class="plugin-author">{{ plugin.manifest.author }}</span>
                  <span class="plugin-id">{{ plugin.manifest.id }}</span>
                </div>
                <div class="plugin-capabilities">
                  <span
                      v-for="cap in getStandardCapabilities(plugin.manifest.capabilities)"
                      :key="cap"
                      class="capability-tag"
                      :style="{ backgroundColor: getCapabilityColor(cap) }"
                      :title="`风险等级: ${getCapabilityRiskLevel(cap)}`"
                  >
{{ getCapabilityLabel(cap) }}
</span>
                  <span
                      v-for="cap in getCustomCapabilities(plugin.manifest.capabilities)"
                      :key="`custom-${cap}`"
                      class="capability-tag custom"
                  >
{{ cap }}
</span>
                </div>
                <div v-if="isPluginEnabled(plugin.manifest.id) && plugin.manifest.config_schema"
                     class="plugin-config">
                  <div v-for="(schema, key) in plugin.manifest.config_schema"
                       :key="key"
                       class="plugin-config-item">
                    <label class="setting-label">
                      {{ schema.description || key }}
                    </label>
                    <WinToggle
                        v-if="schema.type === 'boolean'"
                        :modelValue="Boolean(getPluginConfigValue(plugin.manifest.id, key, schema))"
                        @update:modelValue="(v: boolean) => updatePluginConfig(plugin.manifest.id, key, v)"
                    />
                    <WinInput
                        v-else
                        :type="schema.type === 'string' ? 'text' : 'number'"
                        :step="schema.step ?? (schema.type === 'integer' ? 1 : 0.1)"
                        :min="schema.min"
                        :max="schema.max"
                        :integerOnly="schema.type === 'integer'"
                        :modelValue="getPluginConfigValue(plugin.manifest.id, key, schema) ??
                    (schema.type === 'string' ? '' : 0)"
                        @update:modelValue="(v) => updatePluginConfig(
                    plugin.manifest.id,
                    key,
                    schema.type === 'string' ? v : Number(v)
                    )"
                    />
                  </div>
                </div>
              </div>
              <div class="plugin-actions">
                <WinToggle
                    :modelValue="isPluginEnabled(plugin.manifest.id)"
                    @update:modelValue="(v: boolean) => togglePlugin(plugin.manifest.id, v)"
                />
              </div>
            </div>
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
  padding: 20px 24px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.setting-section {
  margin-bottom: 8px;
}

.setting-label {
  display: block;
  font-size: 13px;
  color: var(--color-text);
  margin-bottom: 8px;
}

.setting-label.has-tooltip {
  cursor: help;
  position: relative;
  display: inline-block;
  align-self: flex-start;
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
  gap: 8px;
}

.theme-option {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 12px;
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
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px 16px;
}

.setting-item {
  display: flex;
  flex-direction: column;
  gap: 6px;
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

.plugin-badge {
  background-color: var(--color-plugin);
  color: #fff;
}

.plugin-section {
  min-height: 60px;
}

.plugin-loading {
  display: flex;
  justify-content: center;
  padding: 16px;
}

.plugin-empty {
  text-align: center;
  padding: 24px;
  color: var(--color-text-secondary);
}

.plugin-hint {
  font-size: 12px;
  margin-top: 4px;
}

.plugin-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.plugin-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  border: 1px solid var(--color-border);
  border-radius: var(--border-radius);
  background-color: var(--color-bg-secondary);
}

.plugin-info {
  flex: 1;
  min-width: 0;
}

.plugin-header {
  display: flex;
  align-items: baseline;
  gap: 8px;
}

.plugin-name {
  font-weight: 600;
  font-size: 14px;
}

.plugin-version {
  font-size: 12px;
  color: var(--color-text-secondary);
}

.plugin-builtin-badge {
  display: inline-block;
  padding: 1px 6px;
  border-radius: 8px;
  font-size: 10px;
  font-weight: 600;
  background-color: var(--color-accent-light);
  color: var(--color-accent);
}

.plugin-description {
  font-size: 13px;
  color: var(--color-text-secondary);
  margin-top: 4px;
}

.plugin-meta {
  display: flex;
  gap: 12px;
  margin-top: 6px;
  font-size: 12px;
  color: var(--color-text-tertiary);
}

.plugin-capabilities {
  display: flex;
  gap: 6px;
  margin-top: 8px;
  flex-wrap: wrap;
}

.plugin-config {
  margin-top: 10px;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px 12px;
}

.plugin-config-item {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.capability-tag {
  display: inline-block;
  padding: 1px 8px;
  border-radius: 10px;
  font-size: 11px;
  font-weight: 500;
  background-color: var(--color-accent-light);
  color: var(--color-accent);
}

.capability-tag.custom {
  background-color: var(--color-plugin-light);
  color: var(--color-plugin);
}

.plugin-actions {
  flex-shrink: 0;
  margin-left: 16px;
}

.action-buttons {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding-top: 4px;
}

@media (min-width: 1100px) {
  .settings-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

@media (min-width: 1600px) {
  .settings-grid {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
}
</style>
