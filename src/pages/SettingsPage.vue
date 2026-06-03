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
import {useI18n} from "vue-i18n";
import {setLocale, getCurrentLocale, type SupportedLocale} from "../i18n";
import {useDialog} from "../composables/dialog.ts";
import {formatError} from "../composables/logger";
import IconSun from "../component/icons/IconSun.vue";
import IconMoon from "../component/icons/IconMoon.vue";
import IconMonitor from "../component/icons/IconMonitor.vue";

const tauri = useTauri();
const {showAlert, showConfirm} = useDialog();
const {t} = useI18n();
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
      await showAlert(t('settings.save_success'), {title: t('settings.saved'), tone: 'success'});
      return true;
    } catch (error) {
      console.error(`ui.settings.save: failed err=${formatError(error)}`);
      await showAlert(t('settings.save_failed'), {
        title: t('settings.save_failed_title'),
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
    await showAlert(t('settings.reset_success'), {
      title: t('settings.reset_complete'),
      tone: 'success'
    });
  } catch (error) {
    console.error(`ui.settings.reset: failed err=${formatError(error)}`);
    await showAlert(t('settings.reset_failed'), {
      title: t('settings.reset_failed_title'),
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
    await showAlert(t('settings.reset_success'), {
      title: t('settings.reset_complete'),
      tone: 'warning'
    });
  }
}

onBeforeRouteLeave(async (_to, _from) => {
  if (!dirty.value) {
    return;
  }
  const save = await showConfirm(t('settings.unsaved_changes'), {
    title: t('settings.unsaved_title'),
    tone: 'warning',
    confirmText: t('settings.save_leave'),
    cancelText: t('settings.leave_without_save'),
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

function changeLanguage(locale: SupportedLocale) {
  setLocale(locale);
}

function currentLanguage(): SupportedLocale {
  return getCurrentLocale();
}
</script>

<template>
  <div class="settings-page">
    <div class="page-header">
      <h1>{{ t('settings.title') }}</h1>
      <p>{{ t('settings.subtitle') }}</p>
    </div>

    <div class="page-content glass-scrollbar">
      <WinCard :title="t('settings.appearance')">
        <div class="setting-section">
          <label class="setting-label">{{ t('settings.theme_label') }}</label>
          <div class="theme-options">
            <button
                class="theme-option glass-surface"
                :class="{ active: store.theme === 'light' }"
                @click="setTheme('light')"
            >
              <IconSun :size="20"/>
              <span>{{ t('settings.theme.light') }}</span>
            </button>
            <button
                class="theme-option glass-surface"
                :class="{ active: store.theme === 'dark' }"
                @click="setTheme('dark')"
            >
              <IconMoon :size="20"/>
              <span>{{ t('settings.theme.dark') }}</span>
            </button>
            <button
                class="theme-option glass-surface"
                :class="{ active: store.theme === 'system' }"
                @click="setTheme('system')"
            >
              <IconMonitor :size="20"/>
              <span>{{ t('settings.theme.system') }}</span>
            </button>
          </div>
        </div>
        <div class="setting-section">
          <label class="setting-label">{{ t('settings.language_label') }}</label>
          <div class="theme-options">
            <button
                class="theme-option glass-surface"
                :class="{ active: currentLanguage() === 'en' }"
                @click="changeLanguage('en')"
            >
              <span>English</span>
            </button>
            <button
                class="theme-option glass-surface"
                :class="{ active: currentLanguage() === 'zh' }"
                @click="changeLanguage('zh')"
            >
              <span>中文</span>
            </button>
          </div>
        </div>
      </WinCard>

      <WinCard :title="t('settings.preview_settings')">
        <div class="settings-grid">
          <div class="setting-item">
            <label class="setting-label has-tooltip"
                   :data-tooltip="t('settings.preview_max_mb_tooltip')"
            >{{ t('settings.preview_max_mb') }}</label>
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
                   :data-tooltip="t('settings.sub_second_digits_tooltip')"
            >{{ t('settings.sub_second_digits') }}</label>
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

      <WinCard :title="t('settings.aeb_settings')">
        <template #header-extra>
          <span class="card-type-badge aeb-badge">{{ t('settings.aeb_badge') }}</span>
        </template>
        <div class="settings-grid">
          <div class="setting-item">
            <label class="setting-label has-tooltip"
                   :data-tooltip="t('settings.aeb_max_span_tooltip')"
            >{{ t('settings.aeb_max_span') }}</label>
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
                   :data-tooltip="t('settings.aeb_min_consecutive_tooltip')"
            >{{ t('settings.aeb_min_consecutive') }}</label>
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
                   :data-tooltip="t('settings.aeb_max_consecutive_tooltip')"
            >{{ t('settings.aeb_max_consecutive') }}</label>
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
                   :data-tooltip="t('settings.aeb_min_count_tooltip')"
            >{{ t('settings.aeb_min_count') }}</label>
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
                   :data-tooltip="t('settings.aeb_auto_bracket_tooltip')"
            >{{ t('settings.aeb_auto_bracket') }}</label>
            <WinToggle
                :modelValue="store.config?.aeb_settings.auto_bracket_only || false"
                @update:modelValue="(v) => updateField(store.config?.aeb_settings, 'auto_bracket_only', v)"
            />
          </div>
        </div>
      </WinCard>

      <WinCard :title="t('settings.focus_settings')">
        <template #header-extra>
          <span class="card-type-badge focus-badge">{{ t('settings.focus_badge') }}</span>
        </template>
        <div class="settings-grid">
          <div class="setting-item">
            <label class="setting-label has-tooltip"
                   :data-tooltip="t('settings.focus_enabled_tooltip')"
            >{{ t('settings.focus_enabled') }}</label>
            <WinToggle
                :modelValue="store.config?.focus_bracket_settings.enabled || false"
                @update:modelValue="(v) => updateField(store.config?.focus_bracket_settings, 'enabled', v)"
            />
          </div>
          <div class="setting-item">
            <label class="setting-label has-tooltip"
                   :data-tooltip="t('settings.focus_max_span_tooltip')"
            >{{ t('settings.focus_max_span') }}</label>
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
                   :data-tooltip="t('settings.focus_min_consecutive_tooltip')"
            >{{ t('settings.focus_min_consecutive') }}</label>
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
                   :data-tooltip="t('settings.focus_max_consecutive_tooltip')"
            >{{ t('settings.focus_max_consecutive') }}</label>
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
                   :data-tooltip="t('settings.focus_min_count_tooltip')"
            >{{ t('settings.focus_min_count') }}</label>
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

      <WinCard :title="t('settings.burst_settings')">
        <template #header-extra>
          <span class="card-type-badge burst-badge">{{ t('settings.burst_badge') }}</span>
        </template>
        <div class="settings-grid">
          <div class="setting-item">
            <label
                class="setting-label has-tooltip"
                :data-tooltip="t('settings.burst_min_consecutive_tooltip')"
            >{{ t('settings.burst_min_consecutive') }}</label>
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
                :data-tooltip="t('settings.burst_max_consecutive_tooltip')"
            >{{ t('settings.burst_max_consecutive') }}</label>
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
                :data-tooltip="t('settings.burst_min_count_tooltip')"
            >{{ t('settings.burst_min_count') }}</label>
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

      <WinCard :title="t('settings.naming_rules')">
        <div class="settings-grid">
          <div class="setting-item">
            <label class="setting-label has-tooltip"
                   :data-tooltip="t('settings.focus_bracket_prefix_tooltip')"
            >{{ t('settings.focus_bracket_prefix') }}</label>
            <WinInput :modelValue="store.config?.naming_rules.focus_bracketing_prefix || ''"
                      @update:modelValue="(v) => updateField(store.config?.naming_rules, 'focus_bracketing_prefix', v as string)"
            />
          </div>
          <div class="setting-item">
            <label class="setting-label has-tooltip"
                   :data-tooltip="t('settings.aeb_prefix_tooltip')"
            >{{ t('settings.aeb_prefix') }}</label>
            <WinInput :modelValue="store.config?.naming_rules.aeb_prefix || ''"
                      @update:modelValue="(v) => updateField(store.config?.naming_rules, 'aeb_prefix', v as string)"
            />
          </div>
          <div class="setting-item">
            <label class="setting-label has-tooltip"
                   :data-tooltip="t('settings.burst_prefix_tooltip')"
            >{{ t('settings.burst_prefix') }}</label>
            <WinInput :modelValue="store.config?.naming_rules.burst_prefix || ''"
                      @update:modelValue="(v) => updateField(store.config?.naming_rules, 'burst_prefix', v as string)"
            />
          </div>
          <div class="setting-item">
            <label class="setting-label has-tooltip"
                   :data-tooltip="t('settings.single_prefix_tooltip')"
            >{{ t('settings.single_prefix') }}</label>
            <WinInput :modelValue="store.config?.naming_rules.single_prefix || ''"
                      @update:modelValue="(v) => updateField(store.config?.naming_rules, 'single_prefix', v as string)"
            />
          </div>
        </div>
      </WinCard>

      <WinCard :title="t('settings.plugin_management')">
        <template #header-extra>
          <span class="card-type-badge plugin-badge">{{ t('settings.plugin_badge') }}</span>
        </template>
        <div class="plugin-section">
          <div v-if="!store.pluginsInitialized" class="plugin-loading">
            <WinButton variant="secondary" @click="loadPlugins">{{
                t('settings.load_plugins')
              }}
            </WinButton>
          </div>
          <div v-else-if="store.plugins.length === 0" class="plugin-empty">
            <p>{{ t('settings.no_plugins') }}</p>
            <p class="plugin-hint">{{ t('settings.plugin_hint') }}</p>
          </div>
          <div v-else class="plugin-list">
            <div v-for="plugin in getSortedPlugins()" :key="plugin.manifest.id" class="plugin-item glass-surface">
              <div class="plugin-info">
                <div class="plugin-header">
                  <span class="plugin-name">{{ plugin.manifest.name }}</span>
                  <span v-if="plugin.builtin" class="plugin-builtin-badge">{{
                      t('settings.builtin')
                    }}</span>
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
                      :title="t('settings.risk_level', { level: getCapabilityRiskLevel(cap) })"
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
        <WinButton variant="danger" @click="resetSettings">{{
            t('settings.reset_default')
          }}
        </WinButton>
        <WinButton variant="primary" @click="saveSettings">{{
            t('settings.save_settings')
          }}
        </WinButton>
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
  border-radius: var(--prim-radius-md);
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

.theme-option:focus-visible {
  outline: none;
  box-shadow: 0 0 0 2px var(--color-border-focus);
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
  color: var(--prim-neutral-0);
}

.focus-badge {
  background: var(--color-focus-bracketing);
  color: var(--prim-neutral-0);
}

.burst-badge {
  background: var(--color-burst);
  color: var(--prim-neutral-0);
}

.plugin-badge {
  background: var(--color-plugin);
  color: var(--prim-neutral-0);
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
  border-radius: var(--prim-radius-md);
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