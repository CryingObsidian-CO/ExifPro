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
import IconSun from "../component/icons/IconSun.vue";
import IconMoon from "../component/icons/IconMoon.vue";
import IconMonitor from "../component/icons/IconMonitor.vue";

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
      await showAlert('Settings saved successfully.', {title: 'Saved', tone: 'success'});
      return true;
    } catch (error) {
      console.error(`ui.settings.save: failed err=${formatError(error)}`);
      await showAlert('Failed to save settings. Please try again.', {
        title: 'Save Failed',
        tone: 'error'
      });
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
    await showAlert('Settings reset to default.', {title: 'Reset Complete', tone: 'success'});
  } catch (error) {
    console.error(`ui.settings.reset: failed err=${formatError(error)}`);
    await showAlert('Failed to reset settings. Please try again.', {
      title: 'Reset Failed',
      tone: 'error'
    });
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
    await showAlert('Configuration file read failed. Restored to default settings.', {
      title: 'Configuration Reset',
      tone: 'warning'
    });
  }
}

onBeforeRouteLeave(async (_to, _from) => {
  if (!dirty.value) {
    return;
  }
  const save = await showConfirm('Settings have been modified. Save before leaving?', {
    title: 'Unsaved Changes',
    tone: 'warning',
    confirmText: 'Save and Leave',
    cancelText: 'Leave Without Saving',
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
      return 'var(--color-success-light)';
    case "medium":
      return 'var(--color-warning-light)';
    case "high":
      return 'var(--color-danger-light)';
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
      <h1>Settings</h1>
      <p>Configure grouping parameters, naming rules, and appearance</p>
    </div>

    <div class="page-content glass-scrollbar">
      <WinCard title="Appearance">
        <div class="setting-section">
          <label class="setting-label">Theme</label>
          <div class="theme-options">
            <button
                class="theme-option"
                :class="{ active: store.theme === 'light' }"
                @click="setTheme('light')"
            >
              <IconSun :size="20"/>
              <span>Light</span>
            </button>
            <button
                class="theme-option"
                :class="{ active: store.theme === 'dark' }"
                @click="setTheme('dark')"
            >
              <IconMoon :size="20"/>
              <span>Dark</span>
            </button>
            <button
                class="theme-option"
                :class="{ active: store.theme === 'system' }"
                @click="setTheme('system')"
            >
              <IconMonitor :size="20"/>
              <span>System</span>
            </button>
          </div>
        </div>
      </WinCard>

      <WinCard title="Preview Settings">
        <div class="settings-grid">
          <div class="setting-item">
            <label class="setting-label has-tooltip"
                   data-tooltip="Maximum preview size (MB) for individual images. Images exceeding this size will not generate previews. Set to 0 to disable previews. Currently only applies to common bitmap formats; RAW previews are not yet supported."
            >Preview Max Size (MB)</label>
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
                   data-tooltip="Number of sub-second digits displayed in capture time. Set to 0 to hide sub-seconds."
            >Sub-Second Digits</label>
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

      <WinCard title="AEB Settings">
        <template #header-extra>
          <span class="card-type-badge aeb-badge">AEB</span>
        </template>
        <div class="settings-grid">
          <div class="setting-item">
            <label class="setting-label has-tooltip"
                   data-tooltip="Maximum allowed time difference (seconds) between the first and last photo in an AEB group. Sequences exceeding this span will not be recognized as AEB groups. Recommended: 0.3-1.0 seconds. Set to -1 to disable this constraint."
            >Max Span (s)</label>
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
                   data-tooltip="Minimum time interval (seconds) between consecutive photos in an AEB group. Helps filter out duplicate records. Recommended: 0.01-0.1 seconds. Set to -1 to disable this constraint."
            >Min Consecutive Interval (s)</label>
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
                   data-tooltip="Maximum time interval (seconds) between consecutive photos in an AEB group. Recommended: 0.1-0.5 seconds. Set to -1 to disable this constraint."
            >Max Consecutive Interval (s)</label>
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
                   data-tooltip="Minimum number of photos required to form an AEB group. Typical AEB captures are 3, 5, or 7 shots."
            >Min Count</label>
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
                   data-tooltip="When enabled, only photos with EXIF ExposureMode set to 'Auto Bracket' (value: 2) will be recognized as AEB groups. Manual bracketing will not be recognized."
            >Auto Bracket Only</label>
            <WinToggle
                :modelValue="store.config?.aeb_settings.auto_bracket_only || false"
                @update:modelValue="(v) => updateField(store.config?.aeb_settings, 'auto_bracket_only', v)"
            />
          </div>
        </div>
      </WinCard>

      <WinCard title="Focus Bracketing Settings">
        <template #header-extra>
          <span class="card-type-badge focus-badge">Focus Bracket</span>
        </template>
        <div class="settings-grid">
          <div class="setting-item">
            <label class="setting-label has-tooltip"
                   data-tooltip="Disable to stop recognizing focus bracket groups and avoid confusion with burst sequences. Enable only when focus bracketing is needed."
            >Enable Focus Bracket Detection</label>
            <WinToggle
                :modelValue="store.config?.focus_bracket_settings.enabled || false"
                @update:modelValue="(v) => updateField(store.config?.focus_bracket_settings, 'enabled', v)"
            />
          </div>
          <div class="setting-item">
            <label class="setting-label has-tooltip"
                   data-tooltip="Maximum allowed time difference (seconds) between the first and last photo in a focus bracket group. Recommended: 0.5-2.0 seconds. Set to -1 to disable this constraint."
            >Max Span (s)</label>
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
                   data-tooltip="Minimum time interval (seconds) between consecutive photos. Recommended: 0.01-0.05 seconds. Set to -1 to disable this constraint."
            >Min Consecutive Interval (s)</label>
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
                   data-tooltip="Maximum time interval (seconds) between consecutive photos. Recommended: 0.2-1.0 seconds. Set to -1 to disable this constraint."
            >Max Consecutive Interval (s)</label>
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
                   data-tooltip="Minimum number of photos required to form a focus bracket group. Recommended: 3-7 photos."
            >Min Count</label>
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

      <WinCard title="Burst Settings">
        <template #header-extra>
          <span class="card-type-badge burst-badge">Burst</span>
        </template>
        <div class="settings-grid">
          <div class="setting-item">
            <label
                class="setting-label has-tooltip"
                data-tooltip="Minimum time interval (seconds) between consecutive photos in a burst group. Recommended: 0.01-0.05 seconds. Set to -1 to disable this constraint."
            >Min Consecutive Interval (s)</label>
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
                data-tooltip="Maximum time interval (seconds) between consecutive photos in a burst group. Recommended: 0.3-1.0 seconds. Set to -1 to disable this constraint."
            >Max Consecutive Interval (s)</label>
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
                data-tooltip="Minimum number of photos required to form a burst group. Usually at least 3 photos."
            >Min Count</label>
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

      <WinCard title="Naming Rules">
        <div class="settings-grid">
          <div class="setting-item">
            <label class="setting-label has-tooltip"
                   data-tooltip="Output directory prefix for focus bracket groups. Organized photos will be placed in directories starting with this prefix."
            >Focus Bracket Prefix</label>
            <WinInput :modelValue="store.config?.naming_rules.focus_bracketing_prefix || ''"
                      @update:modelValue="(v) => updateField(store.config?.naming_rules, 'focus_bracketing_prefix', v as string)"
            />
          </div>
          <div class="setting-item">
            <label class="setting-label has-tooltip"
                   data-tooltip="Output directory prefix for AEB groups."
            >AEB Prefix</label>
            <WinInput :modelValue="store.config?.naming_rules.aeb_prefix || ''"
                      @update:modelValue="(v) => updateField(store.config?.naming_rules, 'aeb_prefix', v as string)"
            />
          </div>
          <div class="setting-item">
            <label class="setting-label has-tooltip"
                   data-tooltip="Output directory prefix for burst groups."
            >Burst Prefix</label>
            <WinInput :modelValue="store.config?.naming_rules.burst_prefix || ''"
                      @update:modelValue="(v) => updateField(store.config?.naming_rules, 'burst_prefix', v as string)"
            />
          </div>
          <div class="setting-item">
            <label class="setting-label has-tooltip"
                   data-tooltip="Output directory prefix for single photos. Leave empty to use original filenames without a prefix."
            >Single Prefix</label>
            <WinInput :modelValue="store.config?.naming_rules.single_prefix || ''"
                      @update:modelValue="(v) => updateField(store.config?.naming_rules, 'single_prefix', v as string)"
            />
          </div>
        </div>
      </WinCard>

      <WinCard title="Plugin Management">
        <template #header-extra>
          <span class="card-type-badge plugin-badge">Plugins</span>
        </template>
        <div class="plugin-section">
          <div v-if="!store.pluginsInitialized" class="plugin-loading">
            <WinButton variant="secondary" @click="loadPlugins">Load Plugins</WinButton>
          </div>
          <div v-else-if="store.plugins.length === 0" class="plugin-empty">
            <p>No plugins found</p>
            <p class="plugin-hint">Place plugin ZIP files in the plugins/ directory under the
              application folder</p>
          </div>
          <div v-else class="plugin-list">
            <div v-for="plugin in getSortedPlugins()" :key="plugin.manifest.id" class="plugin-item">
              <div class="plugin-info">
                <div class="plugin-header">
                  <span class="plugin-name">{{ plugin.manifest.name }}</span>
                  <span v-if="plugin.builtin" class="plugin-builtin-badge">Built-in</span>
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
                      :title="'Risk Level: ' + getCapabilityRiskLevel(cap)"
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
        <WinButton variant="danger" @click="resetSettings">Reset to Default</WinButton>
        <WinButton variant="primary" @click="saveSettings">Save Settings</WinButton>
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
  padding: var(--prim-space-6) var(--prim-space-8);
  border-bottom: 1px solid var(--color-border-subtle);
}

.page-header h1 {
  font-size: var(--prim-font-size-2xl);
  font-weight: var(--prim-font-weight-semibold);
  margin-bottom: var(--prim-space-1);
  color: var(--color-text-primary);
}

.page-header p {
  color: var(--color-text-secondary);
  font-size: var(--prim-font-size-base);
}

.page-content {
  flex: 1;
  padding: var(--prim-space-5) var(--prim-space-6);
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: var(--prim-space-4);
}

.setting-section {
  margin-bottom: var(--prim-space-2);
}

.setting-label {
  display: block;
  font-size: var(--prim-font-size-sm);
  color: var(--color-text-primary);
  margin-bottom: var(--prim-space-2);
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
  z-index: var(--prim-z-tooltip);
  padding: var(--prim-space-3) var(--prim-space-4);
  border-radius: var(--prim-radius-md);
  background: var(--color-glass-bg);
  backdrop-filter: blur(var(--prim-glass-blur-lg));
  -webkit-backdrop-filter: blur(var(--prim-glass-blur-lg));
  border: 1px solid var(--color-glass-border);
  box-shadow: var(--prim-shadow-lg);
  color: var(--color-text-primary);
  font-size: var(--prim-font-size-sm);
  line-height: var(--prim-line-height-normal);
  white-space: normal;
  width: 320px;
  pointer-events: none;
  opacity: 0;
  transform: translateY(4px);
  transition: opacity var(--prim-duration-fast) var(--prim-ease-out),
  transform var(--prim-duration-fast) var(--prim-ease-out);
}

.setting-label.has-tooltip:hover::after {
  opacity: 1;
  transform: translateY(0);
}

.theme-options {
  display: flex;
  gap: var(--prim-space-2);
}

.theme-option {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--prim-space-1);
  padding: var(--prim-space-3);
  border: 1px solid var(--color-glass-border);
  border-radius: var(--prim-radius-md);
  background: var(--color-glass-bg);
  backdrop-filter: blur(var(--prim-glass-blur-sm));
  -webkit-backdrop-filter: blur(var(--prim-glass-blur-sm));
  transition: all var(--prim-duration-fast) var(--prim-ease-out);
  color: var(--color-text-secondary);
  font-size: var(--prim-font-size-sm);
}

.theme-option:hover {
  border-color: var(--color-border-strong);
  color: var(--color-text-primary);
}

.theme-option.active {
  border-color: var(--color-brand);
  background: var(--sidebar-item-active);
  color: var(--color-brand);
}

.settings-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--prim-space-3) var(--prim-space-4);
}

.setting-item {
  display: flex;
  flex-direction: column;
  gap: var(--prim-space-1);
}

.card-type-badge {
  display: inline-block;
  padding: 2px var(--prim-space-3);
  border-radius: var(--prim-radius-full);
  font-size: var(--prim-font-size-xs);
  font-weight: var(--prim-font-weight-semibold);
  line-height: 1.6;
}

.aeb-badge {
  background: var(--color-aeb);
  color: #fff;
}

.focus-badge {
  background: var(--color-focus-bracketing);
  color: #fff;
}

.burst-badge {
  background: var(--color-burst);
  color: #fff;
}

.plugin-badge {
  background: var(--color-plugin);
  color: #fff;
}

.plugin-section {
  min-height: 60px;
}

.plugin-loading {
  display: flex;
  justify-content: center;
  padding: var(--prim-space-4);
}

.plugin-empty {
  text-align: center;
  padding: var(--prim-space-6);
  color: var(--color-text-secondary);
}

.plugin-hint {
  font-size: var(--prim-font-size-sm);
  margin-top: var(--prim-space-1);
}

.plugin-list {
  display: flex;
  flex-direction: column;
  gap: var(--prim-space-3);
}

.plugin-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--prim-space-3) var(--prim-space-4);
  border: 1px solid var(--color-glass-border);
  border-radius: var(--prim-radius-md);
  background: var(--color-glass-bg);
  backdrop-filter: blur(var(--prim-glass-blur-sm));
  -webkit-backdrop-filter: blur(var(--prim-glass-blur-sm));
}

.plugin-info {
  flex: 1;
  min-width: 0;
}

.plugin-header {
  display: flex;
  align-items: baseline;
  gap: var(--prim-space-2);
}

.plugin-name {
  font-weight: var(--prim-font-weight-semibold);
  font-size: var(--prim-font-size-md);
}

.plugin-version {
  font-size: var(--prim-font-size-sm);
  color: var(--color-text-secondary);
}

.plugin-builtin-badge {
  display: inline-block;
  padding: 1px 6px;
  border-radius: var(--prim-radius-full);
  font-size: var(--prim-font-size-xs);
  font-weight: var(--prim-font-weight-medium);
  background: var(--color-brand-light);
  color: var(--color-brand);
}

.plugin-description {
  font-size: var(--prim-font-size-base);
  color: var(--color-text-secondary);
  margin-top: var(--prim-space-1);
}

.plugin-meta {
  display: flex;
  gap: var(--prim-space-3);
  margin-top: var(--prim-space-1);
  font-size: var(--prim-font-size-sm);
  color: var(--color-text-tertiary);
}

.plugin-capabilities {
  display: flex;
  gap: var(--prim-space-1);
  margin-top: var(--prim-space-2);
  flex-wrap: wrap;
}

.plugin-config {
  margin-top: var(--prim-space-3);
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--prim-space-3);
}

.plugin-config-item {
  display: flex;
  flex-direction: column;
  gap: var(--prim-space-1);
}

.capability-tag {
  display: inline-block;
  padding: 1px var(--prim-space-2);
  border-radius: var(--prim-radius-full);
  font-size: var(--prim-font-size-xs);
  font-weight: var(--prim-font-weight-medium);
  color: var(--color-text-primary);
}

.capability-tag.custom {
  background: var(--color-plugin-light);
  color: var(--color-plugin);
}

.plugin-actions {
  flex-shrink: 0;
  margin-left: var(--prim-space-4);
}

.action-buttons {
  display: flex;
  justify-content: flex-end;
  gap: var(--prim-space-3);
  padding-top: var(--prim-space-1);
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