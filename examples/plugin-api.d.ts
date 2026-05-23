export interface ExifInfo {
  file_path: string;
  file_name: string;
  capture_time?: string;
  sub_time?: string;
  offset_time_original?: string;
  shutter_speed?: string;
  aperture?: string;
  iso?: string;
  exposure_compensation?: string;
  exposure_mode?: number;
  focal_length?: string;
  focus_distance?: string;
  camera_make?: string;
  camera_model?: string;
}

export type GroupType = 'FocusBracketing' | 'AEB' | 'Burst' | 'Single' | string;

export interface Group {
  id: string;
  group_type: GroupType;
  name: string;
  photos: ExifInfo[];
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

declare global {
  const exports: {
    default: ExifProPluginHooks;
  };
  const exifProHostAPI: ExifProHostAPI;
}
export {};