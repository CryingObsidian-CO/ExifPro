import {useTauri} from './tauri';
import {
  ExifProHostAPI,
  ExifProPluginHooks,
  GroupActionDeclaration,
  ImageActionDeclaration,
  LoadedPlugin,
  PluginAPIContext,
  PluginCapabilities,
  PluginInfo,
  PluginManifest,
} from '../types/plugin';
import type {ExifInfo, Group, GroupType} from '../types/photo';
import {builtinPlugins} from './builtinPlugins';
import {formatError} from "./logger";
import {store} from "../store/store.ts";
import ts from "typescript";

// TODO 更好的单例控制，避免多个实例
class PluginManagerImpl {
  private readonly tauri = useTauri();
  private plugins: Map<string, LoadedPlugin> = new Map();
  private apiContexts: Map<string, PluginAPIContext> = new Map();
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

  private hasCapability(manifest: PluginManifest, key: keyof Pick<PluginCapabilities,
      'exif_enhancement' | 'grouping' | 'merging' | 'ui_extensions'>): boolean {
    return Boolean(manifest.capabilities?.[key]);
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

    const apiContext = new PluginAPIContext(info.manifest.id, pluginConfig);
    this.apiContexts.set(info.manifest.id, apiContext);
    const api = this.createHostAPI(apiContext);

    let hooks: ExifProPluginHooks;
    if (info.builtin) {
      const builtinHooks = this.getBuiltinPluginHooks(info.manifest.id);
      if (!builtinHooks) {
        throw new Error(`Unknown builtin plugin: ${info.manifest.id}`);
      }
      hooks = builtinHooks;
    } else {
      const scriptContent = await this.tauri.readPluginFile(info.zip_path, info.manifest.entry_point);
      hooks = await this.evaluatePluginScript(scriptContent, api, info.manifest.entry_point.endsWith('.ts'));
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
      hooks.onLoad?.();
    } catch (e) {
      console.error(`Plugin ${info.manifest.id} onLoad error:`, e);
    }

    if (hooks.onRegisterUIExtensions && this.hasCapability(info.manifest, 'ui_extensions')) {
      try {
        loaded.uiExtensions = hooks.onRegisterUIExtensions();
      } catch (e) {
        console.error(`Plugin ${info.manifest.id} onRegisterUIExtensions error:`, e);
      }
    }

    console.info(`ui.plugins: load complete id=${info.manifest.id}`);
  }

  private async preprocessPluginCode(code: string, isTypeScript: boolean): Promise<string> {
    code = code
    // 1. 移除 import "../plugin-api"; 语句（运行时不需要）
    .replace(/^\s*import\s*["']..\/plugin-api["'];\s*$/gm, '')
    // 清理多余空行（可选）
    .replace(/\n\s*\n/g, '\n');

    if (isTypeScript) {
      console.info("ui.plugin: found .ts file");
      try {
        const result = ts.transpileModule(code, {
          compilerOptions: {
            module: ts.ModuleKind.Preserve,
            target: ts.ScriptTarget.ES2020,
            removeComments: true,
            strict: false,
            moduleResolution: ts.ModuleResolutionKind.Bundler,
          },
          reportDiagnostics: false,
        });
        console.info("ui.plugin: TS type removed successfully");
        return result.outputText;
      } catch (e) {
        console.error("ui.plugin: TS type removed failed:", e);
      }
    }
    return code;
  }

  // DEBUG 安全问题很重要，这里直接执行了用户提供的脚本，需要谨慎处理
  private async evaluatePluginScript(script: string, api: ExifProHostAPI, isTypeScript: boolean): Promise<ExifProPluginHooks> {
    try {
      const preprocessedScript = await this.preprocessPluginCode(script, isTypeScript);

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
      const moduleFactory = new Function('exports', 'exifProHostAPI', ...keys, preprocessedScript);
      const exports: any = {};

      moduleFactory(exports, api, ...values);
      return exports.default || exports;
    } catch (e) {
      console.error('Failed to evaluate plugin script:', e);
      return {};
    }
  }

  emitParseExif(exif: ExifInfo[]): ExifInfo[] {
    let result = exif;
    for (const plugin of this.getEnabledPlugins()) {
      if (plugin.hooks.onParseExif && this.hasCapability(plugin.manifest, 'exif_enhancement')) {
        try {
          result = plugin.hooks.onParseExif(result) || result;
        } catch (e) {
          console.error(`Plugin ${plugin.manifest.id} onParseExif error:`, e);
        }
      }
    }
    return result;
  }

  emitGroupCreated(group: Group): Group {
    let result = group;
    for (const plugin of this.getEnabledPlugins()) {
      if (plugin.hooks.onGroupCreated && this.hasCapability(plugin.manifest, 'grouping')) {
        try {
          result = plugin.hooks.onGroupCreated(result) || result;
        } catch (e) {
          console.error(`Plugin ${plugin.manifest.id} onGroupCreated error:`, e);
        }
      }
    }
    return result;
  }

  emitMoveToGroup(group: Group, photos: ExifInfo[]): void {
    for (const plugin of this.getEnabledPlugins()) {
      if (plugin.hooks.onMoveToGroup && this.hasCapability(plugin.manifest, 'grouping')) {
        try {
          plugin.hooks.onMoveToGroup(group, photos);
        } catch (e) {
          console.error(`Plugin ${plugin.manifest.id} onMoveToGroup error:`, e);
        }
      }
    }
  }

  emitGroupMerge(originalGroups: Group[], mergedGroup: Group): void {
    for (const plugin of this.getEnabledPlugins()) {
      if (plugin.hooks.onGroupMerged && this.hasCapability(plugin.manifest, 'merging')) {
        try {
          plugin.hooks.onGroupMerged(originalGroups, mergedGroup);
        } catch (e) {
          console.error(`Plugin ${plugin.manifest.id} onGroupMerge error:`, e);
        }
      }
    }
    return undefined;
  }

  emitGroupUpdated(group: Group, updates: Partial<Group>): void {
    for (const plugin of this.getEnabledPlugins()) {
      if (plugin.hooks.onGroupUpdated && this.hasCapability(plugin.manifest, 'merging')) {
        try {
          plugin.hooks.onGroupUpdated(group, updates);
        } catch (e) {
          console.error(`Plugin ${plugin.manifest.id} onGroupUpdated error:`, e);
        }
      }
    }
  }

  emitGroupDisband(group: Group): void {
    for (const plugin of this.getEnabledPlugins()) {
      if (plugin.hooks.onGroupDisband && this.hasCapability(plugin.manifest, 'merging')) {
        try {
          plugin.hooks.onGroupDisband(group);
        } catch (e) {
          console.error(`Plugin ${plugin.manifest.id} onGroupDisband error:`, e);
        }
      }
    }
  }

  async emitGroupAction(actionId: string, group: Group): Promise<void> {
    for (const plugin of this.getEnabledPlugins()) {
      if (plugin.hooks.onGroupAction && this.hasCapability(plugin.manifest, 'ui_extensions')) {
        try {
          await plugin.hooks.onGroupAction(actionId, group);
        } catch (e) {
          console.error(`Plugin ${plugin.manifest.id} onGroupAction error:`, e);
        }
      }
    }
  }

  async emitImageAction(actionId: string, photo: ExifInfo): Promise<void> {
    for (const plugin of this.getEnabledPlugins()) {
      if (plugin.hooks.onImageAction && this.hasCapability(plugin.manifest, 'ui_extensions')) {
        try {
          await plugin.hooks.onImageAction(actionId, photo);
        } catch (e) {
          console.error(`Plugin ${plugin.manifest.id} onImageAction error:`, e);
        }
      }
    }
  }


  getGroupActions(groupType: GroupType): GroupActionDeclaration[] {
    const actions: GroupActionDeclaration[] = [];
    for (const plugin of this.getEnabledPlugins()) {
      if (plugin.uiExtensions?.groupActions && this.hasCapability(plugin.manifest, 'ui_extensions')) {
        for (const action of plugin.uiExtensions.groupActions) {
          if (action.groupTypes.length === 0 || action.groupTypes.includes(groupType)) {
            actions.push(action);
          }
        }
      }
    }
    return actions;
  }

  getImageActions(groupType: GroupType): ImageActionDeclaration[] {
    const actions: ImageActionDeclaration[] = [];
    for (const plugin of this.getEnabledPlugins()) {
      if (plugin.uiExtensions?.imageActions && this.hasCapability(plugin.manifest, 'ui_extensions')) {
        for (const action of plugin.uiExtensions.imageActions) {
          if (!action.groupTypes || action.groupTypes.length === 0 || action.groupTypes.includes(groupType)) {
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
    try {
      plugin.hooks.onUnload?.();
    } catch (e) {
      console.error(`Plugin ${pluginId} onUnload error:`, e);
    }

    await this.tauri.disablePlugin(pluginId);

    plugin.enabled = false;
    plugin.hooks = {};
    plugin.uiExtensions = undefined;
    console.info(`ui.plugins: disable complete id=${pluginId}`);
  }

  async updatePluginConfig(pluginId: string): Promise<void> {
    const apiContext = this.apiContexts.get(pluginId);
    if (!apiContext) {
      throw new Error(`Plugin ${pluginId} not found`)
    }
    apiContext.updateConfig(await this.tauri.getPluginConfig(pluginId));
  }

  private createHostAPI(context: PluginAPIContext): ExifProHostAPI {
    return {
      getPluginConfig: () => context.getConfig(),
      log: (msg: string) => console.log(`[Plugin:${context.id}] ${msg}`),

      getGroups: () => store.groups,

      createGroup: (photos: ExifInfo[], groupType: GroupType, name: string) => {
        const group = store.createGroup(name, `plugin_${context.id.trim()}_${name.trim()}`, groupType);
        if (!group) return null;
        store.movePhotoToGroup(photos, group.id);
        return group;
      },

      moveToGroup: (groupId: string, photos: ExifInfo[]): boolean => {
        return store.movePhotoToGroup(photos, groupId);
      },

      mergeGroups: (groupIds: string[], name: string): Group | null => {
        return store.mergeGroups(groupIds, name);
      },

      // TODO 从 selectedGroupIds 中移除 groupId
      disbandGroup: (groupId: string): ExifInfo[] => {
        const group = store.findGroup(groupId);
        if (!group) return [];

        if (!store.disbandGroup(groupId)) {
          return [];
        }
        return group.photos;
      },

      readFile: async (fileName: string): Promise<string> => {
        const plugin = this.plugins.get(context.id);
        if (!plugin) throw new Error('Plugin not found');
        return await this.tauri.readPluginFile(plugin.zipPath, fileName);
      },

      readFileBinary: async (fileName: string): Promise<Uint8Array> => {
        const plugin = this.plugins.get(context.id);
        if (!plugin) throw new Error('Plugin not found');
        return await this.tauri.readPluginBinary(plugin.zipPath, fileName);
      },

      readExternalFile: async (path: string): Promise<Uint8Array> => {
        return await this.tauri.pluginFileOp(context.id, 'read', path);
      },

      writeFile: async (path: string, data: Uint8Array): Promise<void> => {
        await this.tauri.pluginFileOp(context.id, 'write', path, data);
      },

      createDirectory: async (path: string): Promise<void> => {
        await this.tauri.pluginFileOp(context.id, 'mkdir', path);
      },
    };
  }
}

export const pluginManager = new PluginManagerImpl();
