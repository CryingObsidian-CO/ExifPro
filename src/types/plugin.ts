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

export interface PluginCapabilities {
  exif_enhancement?: boolean;
  grouping?: boolean;
  merging?: boolean;
  ui_extensions?: boolean;
  file_read?: boolean;
  file_write?: boolean;
  directory_create?: boolean;
  custom_capabilities?: string[];
}

export type CapabilityType =
    | 'exif_enhancement'
    | 'grouping'
    | 'merging'
    | 'ui_extensions'
    | 'file_read'
    | 'file_write'
    | 'directory_create';

export interface CapabilityInfo {
  type: CapabilityType;
  label: string;
  riskLevel: 'low' | 'medium' | 'high';
  description: string;
}

export const CAPABILITY_INFO: Record<CapabilityType, CapabilityInfo> = {
  exif_enhancement: {
    type: 'exif_enhancement',
    label: 'EXIF增强',
    riskLevel: 'low',
    description: '读取和处理EXIF数据',
  },
  grouping: {
    type: 'grouping',
    label: '分组',
    riskLevel: 'low',
    description: '识别和创建照片分组',
  },
  merging: {
    type: 'merging',
    label: '合并',
    riskLevel: 'low',
    description: '合并多个照片组',
  },
  ui_extensions: {
    type: 'ui_extensions',
    label: 'UI扩展',
    riskLevel: 'low',
    description: '扩展用户界面功能',
  },
  file_read: {
    type: 'file_read',
    label: '文件读取',
    riskLevel: 'medium',
    description: '读取本地文件内容',
  },
  file_write: {
    type: 'file_write',
    label: '文件写入',
    riskLevel: 'medium',
    description: '写入本地文件（高风险操作）',
  },
  directory_create: {
    type: 'directory_create',
    label: '创建目录',
    riskLevel: 'medium',
    description: '创建本地目录（高风险操作）',
  },
};

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

// NOTE 修改时更新 plugin-api.d.ts 中的 ExifProPluginHooks 接口
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


// NOTE 修改时更新 plugin-api.d.ts 中的 ExifProHostAPI 接口
export interface ExifProHostAPI {
  log(message: string): void;

  getPluginConfig(): Record<string, any>;

  getGroups(): Group[];

  createGroup(photos: ExifInfo[], groupType: GroupType, name: string): Group | null;

  moveToGroup(groupId: string, photos: ExifInfo[]): boolean;

  mergeGroups(groupIds: string[], name: string): Group | null;

  disbandGroup(groupId: string): ExifInfo[];

  readFile(fileName: string): Promise<string>;

  readFileBinary(fileName: string): Promise<Uint8Array>;

  readExternalFile(path: string): Promise<Uint8Array>;

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

export class PluginAPIContext {
  readonly id: string;
  private config: Record<string, any>;

  constructor(id: string, config: Record<string, any>) {
    this.id = id;
    this.config = config;
  }

  getConfig(): Record<string, any> {
    return this.config;
  }

  updateConfig(config: Record<string, any>): void {
    this.config = config;
  }
}