import {AppState, Theme} from "../types";
import {reactive, watch} from "vue";
import {ExifInfo, Group} from "../types/photo.ts";
import {Config} from "../types/config.ts";
import {pluginManager} from "../composables/pluginManager.ts";
import {formatError} from "../composables/logger";

function getSystemTheme() {
  return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light';
}

function applyTheme(theme: Theme) {
  const effectiveTheme = theme === 'system' ? getSystemTheme() : theme;
  document.documentElement.setAttribute('data-theme', effectiveTheme);
}


function loadThemeFromStorage() {
  const saved = localStorage.getItem('theme');
  return (saved as Theme) || 'system';
}

// TODO 更好的单例控制，避免多个实例
export class Store {
  private readonly state = reactive<AppState>({
    selectedDirectory: '',
    recursive: true,
    copyMode: true,
    overwrite: false,
    outputDirectory: '',
    photos: [],
    groups: [],
    config: null,
    // TODO Theme 移入 Config 中
    theme: loadThemeFromStorage(),
    isAnalyzing: false,
    isOrganizing: false,
  });

  constructor() {
    watch(() => this.state.theme, (newTheme) => {
          localStorage.setItem('theme', newTheme);
          applyTheme(newTheme);
          console.info(`ui.store.theme: applied value=${newTheme}`);
        },
        {immediate: true});

    if (window.matchMedia) {
      window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
        if (this.state.theme === 'system') {
          applyTheme('system');
        }
      });
    }
  }

  get selectedDirectory() {
    return this.state.selectedDirectory;
  }

  set selectedDirectory(selectedDirectory: string) {
    this.state.selectedDirectory = selectedDirectory;
  }

  get recursive() {
    return this.state.recursive;
  }

  set recursive(recursive: boolean) {
    this.state.recursive = recursive;
  }

  get copyMode() {
    return this.state.copyMode;
  }

  set copyMode(copyMode: boolean) {
    this.state.copyMode = copyMode;
  }

  get overwrite() {
    return this.state.overwrite;
  }

  set overwrite(overwrite: boolean) {
    this.state.overwrite = overwrite;
  }

  get outputDirectory() {
    return this.state.outputDirectory;
  }

  set outputDirectory(outputDirectory: string) {
    this.state.outputDirectory = outputDirectory;
  }

  get photos() {
    return this.state.photos;
  }

  set photos(photos: ExifInfo[]) {
    this.state.photos = photos;
  }

  get groups() {
    return this.state.groups;
  }

  set groups(groups: Group[]) {
    this.state.groups = groups;
  }

  get config() {
    return this.state.config;
  }

  set config(config: Config | null) {
    this.state.config = config;
  }

  get theme() {
    return this.state.theme;
  }

  set theme(theme: Theme) {
    this.state.theme = theme;
  }

  get isAnalyzing() {
    return this.state.isAnalyzing;
  }

  set isAnalyzing(isAnalyzing: boolean) {
    this.state.isAnalyzing = isAnalyzing;
  }

  get isOrganizing() {
    return this.state.isOrganizing;
  }

  set isOrganizing(isOrganizing: boolean) {
    this.state.isOrganizing = isOrganizing;
  }

  get plugins() {
    return pluginManager.getPlugins();
  }

  get pluginsInitialized() {
    return pluginManager.isInitialized;
  }

  get photosNumber() {
    return this.state.photos.length;
  }

  get groupsNumber() {
    return this.state.groups.length;
  }

  createGroup(name: string, id: string = `group_${name}`) {
    const newGroup: Group = {
      id,
      group_type: 'Single',
      name,
      photos: [],
    };

    this.state.groups.push(newGroup);
    return newGroup;
  }

  updateGroup(groupId: string, updates: Partial<Group>) {
    if (groupId === 'ungrouped') {
      return;
    }
    const index = this.state.groups.findIndex((g) => g.id === groupId);
    if (index !== -1) {
      this.state.groups[index] = {...this.state.groups[index], ...updates};
    }
  }

  deleteGroup(groupId: string) {
    if (groupId === 'ungrouped') {
      return;
    }
    this.state.groups = this.state.groups.filter((g) => g.id !== groupId);
  }

  private deleteGroups(groupIds: string[]) {
    const groups = this.findGroups(groupIds);
    groups.forEach((group) => {
      this.deleteGroup(group.id);
    });
  }

  findGroup(groupId: string) {
    return this.state.groups.find((g) => g.id === groupId);
  }

  private findGroups(groupIds: string[]) {
    return this.state.groups.filter((g) => groupIds.includes(g.id));
  }

  movePhotoToGroup(photos: ExifInfo[], groupId: string) {
    const group = this.findGroup(groupId);
    if (!group) {
      return;
    }
    group.photos.push(...photos);
    this.deletePhotosInAllGroups(photos, [groupId]);
  }

  mergeGroups(groupIds: string[], name: string) {
    const groupsToMerge = this.findGroups(groupIds);
    const allPhotos = groupsToMerge.flatMap((g) => g.photos);

    const mergedGroup: Group = {
      id: `group_${name.trim()}`,
      group_type: 'Single',
      name,
      photos: allPhotos,
    };

    this.state.groups.push(mergedGroup);
    this.deleteGroups(groupIds);

    return mergedGroup;
  }

  private deletePhotosInAllGroups(photos: ExifInfo[], exceptGroupId: string[] = []) {
    this.state.groups.forEach((group) => {
      if (exceptGroupId.includes(group.id)) {
        return;
      }
      group.photos = group.photos.filter((p) => !photos.includes(p));
      if (group.photos.length === 0) {
        this.deleteGroup(group.id);
      }
    });
  }

  addToUngroupedPhotos(photos: ExifInfo[]) {
    let ungroupedPhotos = this.findGroup('ungrouped');
    if (!ungroupedPhotos) {
      ungroupedPhotos = this.createGroup('未分组', 'ungrouped');
    }
    ungroupedPhotos.photos.push(...photos);
  }

  async loadPlugins() {
    if (pluginManager.isInitialized) {
      return;
    }
    console.info("ui.store.plugins: load start");
    try {
      await pluginManager.initialize();
      console.info("ui.store.plugins: load complete");
    } catch (e) {
      console.error('ui.store.plugins: load failed err=' + formatError(e));
    }
  }

  async syncPluginsEnabled(enabledPluginIds: string[]) {
    console.info(`ui.store.plugins: sync start target=${enabledPluginIds.length}`);
    const desired = new Set(enabledPluginIds);
    for (const plugin of this.plugins) {
      if (desired.has(plugin.manifest.id)) {
        if (!plugin.enabled) {
          await pluginManager.enablePlugin(plugin.manifest.id);
        }
      } else if (plugin.enabled) {
        await pluginManager.disablePlugin(plugin.manifest.id);
      }
    }
    console.info("ui.store.plugins: sync complete");
  }

  getPlugin(pluginId: string) {
    return this.plugins.find((p) => p.manifest.id === pluginId);
  }

  async enablePlugin(pluginId: string) {
    try {
      console.info(`ui.store.plugins: enable start id=${pluginId}`);
      await pluginManager.enablePlugin(pluginId);
      console.info(`ui.store.plugins: enable complete id=${pluginId}`);
    } catch (e) {
      console.error('ui.store.plugins: enable failed id=' + pluginId + ' err=' + formatError(e));
    }
  }

  async disablePlugin(pluginId: string) {
    try {
      console.info(`ui.store.plugins: disable start id=${pluginId}`);
      await pluginManager.disablePlugin(pluginId);
      console.info(`ui.store.plugins: disable complete id=${pluginId}`);
    } catch (e) {
      console.error('ui.store.plugins: disable failed id=' + pluginId + ' err=' + formatError(e));
    }
  }
}

export const store = new Store();
