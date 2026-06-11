import {open} from '@tauri-apps/plugin-dialog';
import {ExifInfo, Group} from "../types/photo.ts";
import {invoke} from "@tauri-apps/api/core";
import {Config} from "../types/config.ts";
import {PluginInfo} from "../types/plugin.ts";
import {SelectionResult} from "../types/selection.ts";
import {formatError} from "./logger";
import {pluginManager} from "./pluginManager.ts";

const tauriLog = {
  start(action: string, details?: string) {
    console.info(`tauri.${action}: start${details ? " " + details : ""}`);
  },
  complete(action: string, details?: string) {
    console.info(`tauri.${action}: complete${details ? " " + details : ""}`);
  },
  error(action: string, err: unknown, details?: string) {
    const message = formatError(err);
    console.error(`tauri.${action}: failed${details ? " " + details : ""} err=${message}`);
  }
};

async function invokeWithLog<T>(action: string, command: string, payload?: Record<string, unknown>, details?: string) {
  tauriLog.start(action, details);
  try {
    const result = await invoke<T>(command, payload ?? {});
    tauriLog.complete(action, details);
    return result;
  } catch (err) {
    tauriLog.error(action, err, details);
    throw err;
  }
}

export function useTauri() {
  async function selectDirectory() {
    const selected = await open({
      directory: true,
      multiple: false,
    });
    return selected as string | null;
  }

  async function scanDirectory(path: string, recursive: boolean) {
    let photos = await invokeWithLog<ExifInfo[]>(
        "scan_directory",
        'scan_directory_command',
        {path, recursive},
        `path=${path} recursive=${recursive}`
    );

    photos = pluginManager.emitParseExif(photos);
    return photos;
  }

  async function groupPhotos(photos: ExifInfo[], config: Config | null) {
    return await invokeWithLog<Group[]>(
        "group_photos",
        'group_photos_command',
        {photos, config},
        `photos=${photos.length} config_provided=${Boolean(config)}`
    );
  }

  async function organizeFiles(groups: Group[],
                               outputDir: string,
                               copyMode: boolean,
                               overwrite: boolean) {
    return await invokeWithLog<void>(
        "organize_files",
        'organize_files_command',
        {
          groups,
          outputDir,
          copyMode,
          overwrite,
        },
        `groups=${groups.length} output_dir=${outputDir} copy_mode=${copyMode} overwrite=${overwrite}`
    );

  }

  async function saveConfig(config: Config) {
    return await invokeWithLog<void>(
        "save_config",
        'save_config_command',
        {config}
    );
  }

  async function loadConfig() {
    return await invokeWithLog<Config>(
        "load_config",
        'load_config_command'
    );
  }

  async function resetConfig() {
    const config = await invokeWithLog<Config>(
        "reset_config",
        'reset_config_command'
    );
    await saveConfig(config);
    return config;
  }

  async function listPlugins() {
    return await invokeWithLog<PluginInfo[]>(
        "list_plugins",
        'list_plugins_command'
    );
  }

  async function enablePlugin(pluginId: string) {
    return await invokeWithLog<void>(
        "enable_plugin",
        'enable_plugin_command',
        {pluginId},
        `id=${pluginId}`
    );
  }

  async function disablePlugin(pluginId: string) {
    return await invokeWithLog<void>(
        "disable_plugin",
        'disable_plugin_command',
        {pluginId},
        `id=${pluginId}`
    );
  }

  async function getPluginConfig(pluginId: string) {
    return await invokeWithLog<any>(
        "get_plugin_config",
        'get_plugin_config_command',
        {pluginId},
        `id=${pluginId}`
    );
  }

  async function setPluginConfig(pluginId: string, pluginConfig: Record<string, any>) {
    return await invokeWithLog<void>(
        "set_plugin_config",
        'set_plugin_config_command',
        {pluginId, pluginConfig},
        `id=${pluginId}`
    );
  }

  async function readPluginFile(zipPath: string, fileName: string) {
    return await invokeWithLog<string>(
        "read_plugin_file",
        'read_plugin_file_command',
        {zipPath, fileName},
        `zip=${zipPath} file=${fileName}`
    );
  }

  async function readPluginBinary(zipPath: string, fileName: string): Promise<Uint8Array> {
    const result = await invokeWithLog<number[]>(
        "read_plugin_binary",
        'read_plugin_binary_command',
        {zipPath, fileName},
        `zip=${zipPath} file=${fileName}`
    );
    return new Uint8Array(result);
  }

  async function pluginFileOp(pluginId: string,
                              operation: 'read' | 'mkdir' | 'write',
                              path: string,
                              data?: Uint8Array): Promise<Uint8Array> {

    let safeData = Array.from(data || []);

    const result = await invokeWithLog<Promise<number[]>>(
        "plugin_file_op",
        'plugin_file_op_command',
        {pluginId, operation, path, data: safeData},
        `plugin=${pluginId} operation=${operation} path=${path}`
    );
    return new Uint8Array(result);
  }

  async function getThumbnail(filePath: string, level: 'small' | 'large') {
    return await invokeWithLog<string | null>(
        "get_thumbnail",
        'get_thumbnail_command',
        {filePath, level},
        `path=${filePath} level=${level}`
    );
  }

  async function detect(path: string, recursive: boolean, algorithm: string, threshold: number) {
    return await invokeWithLog<SelectionResult[]>(
        "detect",
        'detect_command',
        {path, recursive, algorithm, threshold},
        `path=${path} algorithm=${algorithm} threshold=${threshold}`
    );
  }

  return {
    selectDirectory,
    groupPhotos,
    scanDirectory,
    organizeFiles,
    saveConfig,
    loadConfig,
    resetConfig,
    listPlugins,
    enablePlugin,
    disablePlugin,
    getPluginConfig,
    setPluginConfig,
    readPluginFile,
    readPluginBinary,
    pluginFileOp,
    getThumbnail,
    detect,
  }
}