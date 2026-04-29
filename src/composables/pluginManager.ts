import {useTauri} from './tauri';
import type {
  PluginInfo,
  ExifProPluginHooks,
  ExifProHostAPI,
  MergeResult,
  LoadedPlugin,
} from '../types/plugin';
import type {ExifInfo, Group} from '../types/photo';
import type {Config} from '../types/config';

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
    try {
      const pluginList = await this.tauri.listPlugins();
      for (const info of pluginList) {
        if (info.enabled) {
          try {
            await this.loadPlugin(info);
          } catch (e) {
            console.error(`Failed to load plugin ${info.manifest.id}:`, e);
            this.plugins.set(info.manifest.id, {
              manifest: info.manifest,
              hooks: {},
              enabled: false,
              config: {},
              zipPath: info.zip_path,
            });
          }
        } else {
          this.plugins.set(info.manifest.id, {
            manifest: info.manifest,
            hooks: {},
            enabled: false,
            config: {},
            zipPath: info.zip_path,
          });
        }
      }
      this.initialized = true;
    } catch (e) {
      console.error('Failed to initialize plugin manager:', e);
    }
  }

  private async loadPlugin(info: PluginInfo): Promise<void> {
    const scriptContent = await this.tauri.readPluginFile(info.zip_path, info.manifest.entry_point);

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
      for (const [key, schema] of Object.entries(info.manifest.config_schema)) {
        if (schema.default !== undefined) {
          pluginConfig[key] = schema.default;
        }
      }
    }

    const api = this.createHostAPI(info.manifest.id, pluginConfig);
    const hooks = this.evaluatePluginScript(scriptContent, api);

    this.plugins.set(info.manifest.id, {
      manifest: info.manifest,
      hooks,
      enabled: true,
      config: pluginConfig,
      zipPath: info.zip_path,
    });

    try {
      hooks.onLoad?.(api);
    } catch (e) {
      console.error(`Plugin ${info.manifest.id} onLoad error:`, e);
    }
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

  private getEnabledPlugins(): LoadedPlugin[] {
    return Array.from(this.plugins.values()).filter(p => p.enabled);
  }

  getPlugins(): PluginInfo[] {
    return Array.from(this.plugins.values()).map(p => ({
      manifest: p.manifest,
      enabled: p.enabled,
      zip_path: p.zipPath,
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
    await this.tauri.enablePlugin(pluginId);
    const plugin = this.plugins.get(pluginId);
    if (plugin) {
      const info: PluginInfo = {
        manifest: plugin.manifest,
        enabled: true,
        zip_path: plugin.zipPath,
      };
      try {
        await this.loadPlugin(info);
      } catch (e) {
        console.error(`Failed to enable plugin ${pluginId}:`, e);
      }
    }
  }

  async disablePlugin(pluginId: string): Promise<void> {
    await this.tauri.disablePlugin(pluginId);
    const plugin = this.plugins.get(pluginId);
    if (plugin) {
      if (plugin.hooks.onUnload) {
        try {
          plugin.hooks.onUnload();
        } catch (e) {
          console.error(`Plugin ${pluginId} onUnload error:`, e);
        }
      }
      plugin.enabled = false;
      plugin.hooks = {};
    }
  }

  async setPluginConfig(pluginId: string, config: Record<string, any>): Promise<void> {
    await this.tauri.setPluginConfig(pluginId, config);
    const plugin = this.plugins.get(pluginId);
    if (plugin) {
      plugin.config = config;
    }
  }

  async reloadPlugins(): Promise<void> {
    for (const plugin of this.plugins.values()) {
      try {
        plugin.hooks.onUnload?.();
      } catch (e) {
        console.error(`Plugin ${plugin.manifest.id} onUnload error:`, e);
      }
    }
    this.plugins.clear();
    await this.initialize();
  }

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
