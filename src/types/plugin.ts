import type {ExifInfo, Group, GroupType} from './photo';
import type {Config} from './config';

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
  grouping: boolean;
  merging: boolean;
  exif_enhancement: boolean;
  ui_extensions?: boolean;
  custom_group_types?: string[];
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

export interface MergeResult {
  success: boolean;
  outputFiles: string[];
  message?: string;
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
  onLoad?(api: ExifProHostAPI): void;

  onUnload?(): void;

  onExifEnhance?(exif: ExifInfo): ExifInfo;

  onGroupsCreated?(groups: Group[], ungroupedPhotos: ExifInfo[], config: Config): Group[];

  onGroupMerge?(group: Group, outputDir: string): MergeResult | undefined;

  onRegisterUIExtensions?(): UIExtensionDeclaration;

  onGroupAction?(actionId: string, group: Group): void | Promise<void>;

  onImageAction?(actionId: string, photo: ExifInfo): void | Promise<void>;
}

export interface ExifProHostAPI {

  log(message: string): void;

  getPluginConfig(): Record<string, any>;

  createGroup(photos: ExifInfo[], groupType: string, name: string): Group;

  mergeGroups(groupIds: string[]): Group | null;

  disbandGroup(groupId: string): ExifInfo[];

  readFile(path: string): Promise<Uint8Array>;

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
