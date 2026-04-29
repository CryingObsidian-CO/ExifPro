import {open} from '@tauri-apps/plugin-dialog';
import {ExifInfo, Group} from "../types/photo.ts";
import {invoke} from "@tauri-apps/api/core";
import {Config} from "../types/config.ts";
import {PluginInfo} from "../types/plugin.ts";

export function useTauri() {
  async function selectDirectory() {
    const selected = await open({
      directory: true,
      multiple: false,
    });
    return selected as string | null;
  }

  async function scanDirectory(path: string, recursive: boolean) {
    return await invoke<ExifInfo[]>('scan_directory_command', {path, recursive});
  }

  async function groupPhotos(photos: ExifInfo[], config: Config | null) {
    return await invoke<Group[]>('group_photos_command', {photos, config});
  }

  async function organizeFiles(groups: Group[],
                               outputDir: string,
                               copyMode: boolean,
                               overwrite: boolean) {
    return await invoke<void>('organize_files_command', {
      groups,
      outputDir,
      copyMode,
      overwrite,
    });

  }

  async function saveConfig(config: Config) {
    return await invoke<void>('save_config_command', {config});
  }

  async function loadConfig() {
    return await invoke<Config>('load_config_command');
  }

  async function resetConfig() {
    const config = await invoke<Config>('reset_config_command');
    await saveConfig(config);
    return config;
  }

  async function listPlugins() {
    return await invoke<PluginInfo[]>('list_plugins_command');
  }

  async function readPluginFile(zipPath: string, fileName: string) {
    return await invoke<string>('read_plugin_file_command', {zipPath, fileName});
  }

  async function readPluginBinary(zipPath: string, fileName: string) {
    return await invoke<Uint8Array>('read_plugin_binary_command', {zipPath, fileName});
  }

  async function enablePlugin(pluginId: string) {
    return await invoke<void>('enable_plugin_command', {pluginId});
  }

  async function disablePlugin(pluginId: string) {
    return await invoke<void>('disable_plugin_command', {pluginId});
  }

  async function getPluginConfig(pluginId: string) {
    return await invoke<any>('get_plugin_config_command', {pluginId});
  }

  async function setPluginConfig(pluginId: string, pluginConfig: Record<string, any>) {
    return await invoke<void>('set_plugin_config_command', {pluginId, pluginConfig});
  }

  async function pluginFileOp(operation: 'mkdir' | 'write', path: string, data?: number[]) {
    return await invoke<void>('plugin_file_op_command', {operation, path, data});
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
    readPluginFile,
    readPluginBinary,
    enablePlugin,
    disablePlugin,
    getPluginConfig,
    setPluginConfig,
    pluginFileOp
  }
}