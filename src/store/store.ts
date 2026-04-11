import {AppState, Theme} from "../types";
import {reactive, watch} from "vue";
import {ExifInfo, Group} from "../types/photo.ts";
import {Config} from "../types/config.ts";

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

const state = reactive<AppState>({
  selectedDirectory: '',
  recursive: true,
  copyMode: true,
  overwrite: false,
  outputDirectory: '',
  photos: [],
  groups: [],
  config: null,
  theme: loadThemeFromStorage(),
  isAnalyzing: false,
  isOrganizing: false,
})

// TODO 主页设置要不要持久化？
watch(() => state.theme, (newTheme) => {
      // TODO 你也去文件
      localStorage.setItem('theme', newTheme);
      applyTheme(newTheme);
    },
    {immediate: true});

if (window.matchMedia) {
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (state.theme === 'system') {
      applyTheme('system');
    }
  });
}

export function useStore() {
  function setSelectedDirectory(dic: string) {
    state.selectedDirectory = dic;
  }

  function getSelectedDirectory() {
    return state.selectedDirectory;
  }

  function setRecursive(recursive: boolean) {
    state.recursive = recursive;
  }

  function getRecursive() {
    return state.recursive;
  }

  function setCopyMode(copyMode: boolean) {
    state.copyMode = copyMode;
  }

  function getCopyMode() {
    return state.copyMode;
  }

  function setOverwrite(overwrite: boolean) {
    state.overwrite = overwrite;
  }

  function getOverwrite() {
    return state.overwrite;
  }

  function setOutputDirectory(outputDirectory: string) {
    state.outputDirectory = outputDirectory;
  }

  function getOutputDirectory() {
    return state.outputDirectory;
  }

  function setPhotos(photos: ExifInfo[]) {
    state.photos = photos;
  }

  function setGroups(groups: Group[]) {
    state.groups = groups;
  }

  function getGroups() {
    return state.groups;
  }

  function createGroup(name: string, id: string = `group_${name}`) {
    const newGroup: Group = {
      id,
      group_type: 'Single',
      name,
      photos: [],
    };

    state.groups.push(newGroup);
    return newGroup;
  }

  function updateGroup(groupId: string, updates: Partial<Group>) {
    if (groupId === 'ungrouped') {
      return;
    }
    const index = state.groups.findIndex((g) => g.id === groupId);
    if (index !== -1) {
      state.groups[index] = {...state.groups[index], ...updates};
    }
  }

  function deleteGroup(groupId: string) {
    if (groupId === 'ungrouped') {
      return;
    }
    state.groups = state.groups.filter((g) => g.id !== groupId);
  }

  function deleteGroups(groupIds: string[]) {
    const groups = findGroups(groupIds);
    groups.forEach((group) => {
      deleteGroup(group.id);
    });
  }

  function findGroup(groupId: string) {
    return state.groups.find((g) => g.id === groupId);
  }

  function findGroups(groupIds: string[]) {
    return state.groups.filter((g) => groupIds.includes(g.id));
  }

  function movePhotoToGroup(photos: ExifInfo[], groupId: string) {
    let group = findGroup(groupId);
    if (!group) {
      return;
    }
    group.photos.push(...photos);
    deletePhotosInAllGroups(photos, [groupId]);
  }

  function mergeGroups(groupIds: string[], name: string) {
    const groupsToMerge = findGroups(groupIds);
    const allPhotos = groupsToMerge.flatMap((g) => g.photos);

    const mergedGroup: Group = {
      id: `group_${name.trim()}`,
      group_type: 'Single',
      name,
      photos: allPhotos,
    };

    state.groups.push(mergedGroup);
    deleteGroups(groupIds);

    return mergedGroup;
  }

  function deletePhotosInAllGroups(photos: ExifInfo[], exceptGroupId: string[] = []) {
    state.groups.forEach((group) => {
      if (exceptGroupId.includes(group.id)) {
        return;
      }
      group.photos = group.photos.filter((p) => !photos.includes(p));
      if (group.photos.length === 0) {
        deleteGroup(group.id);
      }
    });
  }

  function addToUngroupedPhotos(photos: ExifInfo[]) {
    let ungroupedPhotos = findGroup('ungrouped');
    if (!ungroupedPhotos) {
      ungroupedPhotos = createGroup('未分组', 'ungrouped');
    }
    ungroupedPhotos.photos.push(...photos);
  }

  function setConfig(config: Config) {
    state.config = config;
  }

  function getConfig() {
    return state.config;
  }

  function setTheme(theme: Theme) {
    state.theme = theme;
  }

  function getTheme() {
    return state.theme;
  }

  function setIsAnalyzing(isAnalyzing: boolean) {
    state.isAnalyzing = isAnalyzing;
  }

  function getIsAnalyzing() {
    return state.isAnalyzing;
  }

  function setIsOrganizing(isOrganizing: boolean) {
    state.isOrganizing = isOrganizing;
  }

  function getIsOrganizing() {
    return state.isOrganizing;
  }

  function getPhotosNumber() {
    return state.photos.length;
  }

  function getGroupsNumber() {
    return state.groups.length;
  }

  return {
    setSelectedDirectory,
    getSelectedDirectory,
    setRecursive,
    getRecursive,
    setCopyMode,
    getCopyMode,
    setOverwrite,
    getOverwrite,
    setOutputDirectory,
    getOutputDirectory,
    setPhotos,
    setGroups,
    getGroups,
    createGroup,
    updateGroup,
    deleteGroup,
    movePhotoToGroup,
    findGroup,
    mergeGroups,
    addToUngroupedPhotos,
    setConfig,
    getConfig,
    getTheme,
    setTheme,
    setIsAnalyzing,
    getIsAnalyzing,
    setIsOrganizing,
    getIsOrganizing,
    getPhotosNumber,
    getGroupsNumber,
  }
}