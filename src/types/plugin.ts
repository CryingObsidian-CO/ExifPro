import type {ExifInfo, Group, GroupType} from './photo';

export interface PluginManifest {
  id: string;
  version: string;
  name: string;
  description?: string;
  author?: string;
  api_version: number;
  entry_point: string;
  capabilities: PluginCapabilities;
  dependencies?: Record<string, string>;
  config_schema?: Record<string, ConfigSchemaItem>;
}

// TODO 重新优化插件能力的排列，使能力更符合逻辑顺序，并在 Manager 的相应判断中修改
export interface PluginCapabilities {
  exif_enhancement?: boolean;
  grouping?: boolean;
  merging?: boolean;
  ui_extensions?: boolean;
  // Display-only tags for showing plugin-provided capabilities.
  custom_capabilities?: string[];
}

export interface ConfigSchemaItem {
  type: 'integer' | 'number' | 'string' | 'boolean';
  default?: any;
  description?: string;
  min?: number;
  max?: number;
  step?: number;
}

export interface PluginInfo {
  manifest: PluginManifest;
  enabled: boolean;
  zip_path: string;
  builtin?: boolean;
}

export interface GroupActionDeclaration {
  id: string;
  label: string;
  icon?: string;
  groupTypes: GroupType[];
}

export interface ImageActionDeclaration {
  id: string;
  label: string;
  icon?: string;
  groupTypes?: GroupType[];
}

export interface UIExtensionDeclaration {
  groupActions?: GroupActionDeclaration[];
  imageActions?: ImageActionDeclaration[];
}

// TODO 完成钩子的调用
export interface ExifProPluginHooks {
  onLoad?(): void;

  onUnload?(): void;

  onRegisterUIExtensions?(): UIExtensionDeclaration;

  onGroupAction?(actionId: string, group: Group): void | Promise<void>;

  onImageAction?(actionId: string, photo: ExifInfo): void | Promise<void>;

  onParseExif?(exif: ExifInfo[]): ExifInfo[];

  onGroupCreated?(group: Group): Group;

  onMoveToGroup?(group: Group, photos: ExifInfo[]): void;

  onGroupMerged?(originalGroups: Group[], mergedGroup: Group): void;

  onGroupUpdated?(group: Group, updates: Partial<Group>): void;

  onGroupDisband?(group: Group): void;
}

export interface ExifProHostAPI {

  log(message: string): void;

  getPluginConfig(): Record<string, any>;

  getGroups(): Group[];

  createGroup(photos: ExifInfo[], groupType: GroupType, name: string): void;

  moveToGroup(groupId: string, photos: ExifInfo[]): void;

  mergeGroups(groupIds: string[], name: string): void;

  disbandGroup(groupId: string): ExifInfo[];

  readFile(path: string): Promise<Uint8Array>;

  // TODO 直接对文件的操作存在安全问题 writeFile 和 createDirectory 的可写路径应该都加以限制
  writeFile(path: string, data: Uint8Array): Promise<void>;

  createDirectory(path: string): Promise<void>;
}

export interface LoadedPlugin {
  manifest: PluginManifest;
  hooks: ExifProPluginHooks;
  enabled: boolean;
  config: Record<string, any>;
  zipPath: string;
  builtin?: boolean;
  uiExtensions?: UIExtensionDeclaration;
}
