import {useTauri} from './tauri';
import type {
  ExifProHostAPI,
  ExifProPluginHooks,
  GroupActionDeclaration,
  LoadedPlugin,
  MergeResult,
  PluginInfo,
} from '../types/plugin';
import type {ExifInfo, Group, GroupType} from '../types/photo';
import type {Config} from '../types/config';
import {builtinPlugins} from './builtinPlugins';
import {formatError} from "./logger";

class PluginManagerImpl {
  private readonly tauri = useTauri();
  private plugins: Map<string, LoadedPlugin> = new Map();
  private currentGroups: Group[] = [];
  private initialized: boolean = false;

  get isInitialized(): boolean {
    return this.initialized;
  }

  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }
    console.info("ui.plugins: initialize start");
    try {
      const pluginList = await this.tauri.listPlugins();
      console.info(`ui.plugins: discovered count=${pluginList.length}`);
      for (const info of pluginList) {
        if (!info.enabled) {
          this.plugins.set(info.manifest.id, {
            manifest: info.manifest,
            hooks: {},
            enabled: false,
            config: {},
            zipPath: info.zip_path,
            builtin: info.builtin ?? false,
          });
          continue;
        }

        try {
          await this.loadPlugin(info);
        } catch (e) {
          console.error(`ui.plugins: load failed id=${info.manifest.id} err=${formatError(e)}`);
          this.plugins.set(info.manifest.id, {
            manifest: info.manifest,
            hooks: {},
            enabled: false,
            config: {},
            zipPath: info.zip_path,
            builtin: info.builtin ?? false,
          });
        }
      }

      this.initialized = true;
      console.info("ui.plugins: initialize complete");
    } catch (e) {
      console.error('ui.plugins: initialize failed err=' + formatError(e));
    }
  }

  private getBuiltinPluginHooks(pluginId: string): ExifProPluginHooks | null {
    const entry = builtinPlugins[pluginId];
    return entry ? entry.hooks : null;
  }

  private async loadPlugin(info: PluginInfo): Promise<void> {
    console.info(`ui.plugins: load start id=${info.manifest.id} builtin=${Boolean(info.builtin)}`);
    let pluginConfig: Record<string, any> = {};
    try {
      const raw = await this.tauri.getPluginConfig(info.manifest.id);
      if (raw && typeof raw === 'object') {
        pluginConfig = raw;
      }
    } catch {
      // 等下一步处理即可
    }

    if (info.manifest.config_schema && Object.keys(pluginConfig).length === 0) {
      if (info.builtin) {
        const entry = builtinPlugins[info.manifest.id];
        pluginConfig = entry?.getDefaultConfig ? entry.getDefaultConfig() : {};
      } else {
        for (const [key, schema] of Object.entries(info.manifest.config_schema)) {
          if (schema.default !== undefined) {
            pluginConfig[key] = schema.default;
          }
        }
      }
    }

    const api = this.createHostAPI(info.manifest.id, pluginConfig);

    let hooks: ExifProPluginHooks;
    if (info.builtin) {
      const builtinHooks = this.getBuiltinPluginHooks(info.manifest.id);
      if (!builtinHooks) {
        throw new Error(`Unknown builtin plugin: ${info.manifest.id}`);
      }
      hooks = builtinHooks;
    } else {
      const scriptContent = await this.tauri.readPluginFile(info.zip_path, info.manifest.entry_point);
      hooks = this.evaluatePluginScript(scriptContent, api);
    }

    const loaded: LoadedPlugin = {
      manifest: info.manifest,
      hooks,
      enabled: true,
      config: pluginConfig,
      zipPath: info.zip_path,
      builtin: info.builtin ?? false,
    };

    this.plugins.set(info.manifest.id, loaded);

    try {
      hooks.onLoad?.(api);
    } catch (e) {
      console.error(`Plugin ${info.manifest.id} onLoad error:`, e);
    }

    if (hooks.onRegisterUIExtensions && info.manifest.capabilities.ui_extensions) {
      try {
        loaded.uiExtensions = hooks.onRegisterUIExtensions();
      } catch (e) {
        console.error(`Plugin ${info.manifest.id} onRegisterUIExtensions error:`, e);
      }
    }

    console.info(`ui.plugins: load complete id=${info.manifest.id}`);
  }

  private preprocessPluginCode(code: string): string {
    return code
    // 1. 移除 import "../plugin-api"; 语句（运行时不需要）
    .replace(/^\s*import\s*["']..\/plugin-api["'];\s*$/gm, '')
    // 清理多余空行（可选）
    .replace(/\n\s*\n/g, '\n');
  }

  // DEBUG 安全问题很重要，这里直接执行了用户提供的脚本，需要谨慎处理
  private evaluatePluginScript(script: string, api: ExifProHostAPI): ExifProPluginHooks {
    try {
      const preprocessedScript = this.preprocessPluginCode(script);

      // TODO 完善 api 提供的日志记录功能
      const customConsole = {
        log: (...args: any[]) => api.log(args.join(' ')),
        warn: (...args: any[]) => api.log('[WARN] ' + args.join(' ')),
        error: (...args: any[]) => api.log('[ERROR] ' + args.join(' ')),
        info: (...args: any[]) => api.log('[INFO] ' + args.join(' ')),
        debug: (...args: any[]) => api.log('[DEBUG] ' + args.join(' ')),
      };

      // 劫持并遮蔽相关的全局对象，避免插件直接修改/调用
      // TODO 提供更多必要的全局对象
      const blockedGlobals = {
        window: undefined,
        document: undefined,
        localStorage: undefined,
        sessionStorage: undefined,
        fetch: undefined,
        XMLHttpRequest: undefined,
        indexedDB: undefined,
        setTimeout: undefined,
        setInterval: undefined,
        globalThis: undefined,
        console: customConsole,
      };

      const keys = Object.keys(blockedGlobals);
      const values = Object.values(blockedGlobals);

      // 将这些全局变量作为函数的形参传入，以便覆盖当前作用域内的同名对象
      const moduleFactory = new Function('exports', 'ExifProAPI', ...keys, preprocessedScript);
      const exports: any = {};

      moduleFactory(exports, api, ...values);
      return exports.default || exports;
    } catch (e) {
      console.error('Failed to evaluate plugin script:', e);
      return {};
    }
  }

  emitExifEnhance(exif: ExifInfo): ExifInfo {
    let result = exif;
    for (const plugin of this.getEnabledPlugins()) {
      if (plugin.hooks.onExifEnhance && plugin.manifest.capabilities.exif_enhancement) {
        try {
          result = plugin.hooks.onExifEnhance(result) || result;
        } catch (e) {
          console.error(`Plugin ${plugin.manifest.id} onExifEnhance error:`, e);
        }
      }
    }
    return result;
  }

  emitGroupsCreated(groups: Group[], ungroupedPhotos: ExifInfo[], config: Config): Group[] {
    this.currentGroups = groups;
    let result = groups;
    for (const plugin of this.getEnabledPlugins()) {
      if (plugin.hooks.onGroupsCreated && plugin.manifest.capabilities.grouping) {
        try {
          result = plugin.hooks.onGroupsCreated(result, ungroupedPhotos, config) || result;
          this.currentGroups = result;
        } catch (e) {
          console.error(`Plugin ${plugin.manifest.id} onGroupsCreated error:`, e);
        }
      }
    }
    return result;
  }

  emitGroupMerge(group: Group, outputDir: string): MergeResult | undefined {
    for (const plugin of this.getEnabledPlugins()) {
      if (plugin.hooks.onGroupMerge && plugin.manifest.capabilities.merging) {
        try {
          const result = plugin.hooks.onGroupMerge(group, outputDir);
          if (result) return result;
        } catch (e) {
          console.error(`Plugin ${plugin.manifest.id} onGroupMerge error:`, e);
        }
      }
    }
    return undefined;
  }

  async emitGroupAction(actionId: string, group: Group): Promise<void> {
    for (const plugin of this.getEnabledPlugins()) {
      if (plugin.hooks.onGroupAction && plugin.manifest.capabilities.ui_extensions) {
        try {
          await plugin.hooks.onGroupAction(actionId, group);
        } catch (e) {
          console.error(`Plugin ${plugin.manifest.id} onGroupAction error:`, e);
        }
      }
    }
  }

  getGroupActions(groupType: GroupType): GroupActionDeclaration[] {
    const actions: GroupActionDeclaration[] = [];
    for (const plugin of this.getEnabledPlugins()) {
      if (plugin.uiExtensions?.groupActions && plugin.manifest.capabilities.ui_extensions) {
        for (const action of plugin.uiExtensions.groupActions) {
          if (action.groupTypes.length === 0 || action.groupTypes.includes(groupType)) {
            actions.push(action);
          }
        }
      }
    }
    return actions;
  }

  private getEnabledPlugins(): LoadedPlugin[] {
    return Array.from(this.plugins.values()).filter(p => p.enabled);
  }

  getPlugins(): PluginInfo[] {
    return Array.from(this.plugins.values()).map(p => ({
      manifest: p.manifest,
      enabled: p.enabled,
      zip_path: p.zipPath,
      builtin: p.builtin ?? false,
    }));
  }

  getPluginConfigs(): Record<string, Record<string, any>> {
    const configs: Record<string, Record<string, any>> = {};
    for (const [id, plugin] of this.plugins) {
      configs[id] = plugin.config;
    }
    return configs;
  }

  async enablePlugin(pluginId: string): Promise<void> {
    const plugin = this.plugins.get(pluginId);
    if (!plugin || plugin.enabled) return;

    console.info(`ui.plugins: enable start id=${pluginId}`);
    await this.tauri.enablePlugin(pluginId);

    try {
      await this.loadPlugin({
        manifest: plugin.manifest,
        enabled: true,
        zip_path: plugin.zipPath,
        builtin: plugin.builtin ?? false,
      });
      console.info(`ui.plugins: enable complete id=${pluginId}`);
    } catch (e) {
      console.error(`ui.plugins: enable failed id=${pluginId} err=${formatError(e)}`);
    }
  }

  async disablePlugin(pluginId: string): Promise<void> {
    const plugin = this.plugins.get(pluginId);
    if (!plugin || !plugin.enabled) return;

    console.info(`ui.plugins: disable start id=${pluginId}`);
    if (plugin.hooks.onUnload) {
      try {
        plugin.hooks.onUnload();
      } catch (e) {
        console.error(`Plugin ${pluginId} onUnload error:`, e);
      }
    }

    await this.tauri.disablePlugin(pluginId);

    plugin.enabled = false;
    plugin.hooks = {};
    plugin.uiExtensions = undefined;
    console.info(`ui.plugins: disable complete id=${pluginId}`);
  }

  async setPluginConfig(pluginId: string, config: Record<string, any>): Promise<void> {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) return;

    await this.tauri.setPluginConfig(pluginId, config);
    plugin.config = config;
  }

  async reloadPlugins(): Promise<void> {
    console.info("ui.plugins: reload start");
    for (const plugin of this.plugins.values()) {
      try {
        plugin.hooks.onUnload?.();
      } catch (e) {
        console.error(`Plugin ${plugin.manifest.id} onUnload error:`, e);
      }
    }
    this.plugins.clear();
    await this.initialize();
    console.info("ui.plugins: reload complete");
  }

  // TODO 解决 getPluginConfig 没法获取实时配置的问题
  private createHostAPI(pluginId: string, pluginConfig: Record<string, any>): ExifProHostAPI {
    return {
      getPluginConfig: () => pluginConfig,
      log: (msg: string) => console.log(`[Plugin:${pluginId}] ${msg}`),

      createGroup: (photos: ExifInfo[], groupType: string, name: string): Group => {
        return {
          id: `plugin_${pluginId}_${Date.now()}`,
          group_type: groupType,
          name,
          photos,
        };
      },

      mergeGroups: (groupIds: string[]): Group | null => {
        const groupsToMerge = this.currentGroups.filter(g => groupIds.includes(g.id));
        if (groupsToMerge.length === 0) return null;
        const allPhotos = groupsToMerge.flatMap(g => g.photos);
        return {
          id: `plugin_${pluginId}_merged_${Date.now()}`,
          group_type: 'Single',
          name: groupsToMerge.map(g => g.name).join('+'),
          photos: allPhotos,
        };
      },

      disbandGroup: (groupId: string): ExifInfo[] => {
        const group = this.currentGroups.find(g => g.id === groupId);
        return group ? [...group.photos] : [];
      },

      readFile: async (path: string): Promise<Uint8Array> => {
        const plugin = this.plugins.get(pluginId);
        if (!plugin) throw new Error('Plugin not found');
        return await this.tauri.readPluginBinary(plugin.zipPath, path);
      },

      writeFile: async (path: string, data: Uint8Array): Promise<void> => {
        await this.tauri.pluginFileOp('write', path, Array.from(data));
      },

      createDirectory: async (path: string): Promise<void> => {
        await this.tauri.pluginFileOp('mkdir', path);
      },
    };
  }
}

export const pluginManager = new PluginManagerImpl();
