import {open} from '@tauri-apps/plugin-dialog';
import {ExifInfo, Group} from "../types/photo.ts";
import {invoke} from "@tauri-apps/api/core";
import {Config} from "../types/config.ts";

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

  return {
    selectDirectory,
    groupPhotos,
    scanDirectory,
    organizeFiles,
    saveConfig,
    loadConfig,
    resetConfig
  }
}