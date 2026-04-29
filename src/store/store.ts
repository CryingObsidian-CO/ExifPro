import {AppState, Theme} from "../types";
import {reactive, watch} from "vue";
import {ExifInfo, Group} from "../types/photo.ts";
import {Config} from "../types/config.ts";
import {pluginManager} from "../composables/pluginManager.ts";

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
    try {
      await pluginManager.initialize();
    } catch (e) {
      console.error('Failed to load plugins:', e);
    }
  }

  async syncPluginsEnabled(enabledPluginIds: string[]) {
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
  }

  getPlugin(pluginId: string) {
    return this.plugins.find((p) => p.manifest.id === pluginId);
  }

  async enablePlugin(pluginId: string) {
    try {
      await pluginManager.enablePlugin(pluginId);
    } catch (e) {
      console.error('Failed to enable plugin:', e);
    }
  }

  async disablePlugin(pluginId: string) {
    try {
      await pluginManager.disablePlugin(pluginId);
    } catch (e) {
      console.error('Failed to disable plugin:', e);
    }
  }
}

export const store = new Store();
