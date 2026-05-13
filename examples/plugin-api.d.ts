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
  thumbnail?: string;
}

export interface Group {
  id: string;
  group_type: string;
  name: string;
  photos: ExifInfo[];
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
  groupTypes: string[];
}

export interface UIExtensionDeclaration {
  groupActions: GroupActionDeclaration[];
}

export interface ScriptResult {
  exit_code: number;
  stdout: string;
  stderr: string;
}

export interface ExifProHostAPI {
  log(message: string): void;

  getPluginConfig<T = Record<string, any>>(): T;

  createGroup(photos: ExifInfo[], groupType: string, name: string): Group;

  mergeGroups(groupIds: string[]): Group | null;

  disbandGroup(groupId: string): ExifInfo[];

  readFile(path: string): Promise<Uint8Array>;

  writeFile(path: string, data: Uint8Array): Promise<void>;

  createDirectory(path: string): Promise<void>;

  executePhotoshopScript(scriptPath: string, photoPaths: string[], outputDir: string, extraArgs?: Record<string, string>): Promise<ScriptResult>;
}

export interface ExifProPluginHooks {
  onLoad?(api: ExifProHostAPI): void;

  onUnload?(): void;

  onExifEnhance?(exif: ExifInfo): ExifInfo;

  onGroupsCreated?(groups: Group[], ungrouped: ExifInfo[], config: any): Group[];

  onGroupMerge?(group: Group, outputDir: string): MergeResult | undefined;

  onRegisterUIExtensions?(): UIExtensionDeclaration;

  onGroupAction?(actionId: string, group: Group): void | Promise<void>;
}

declare global {
  const exports: {
    default: ExifProPluginHooks;
  };
  const ExifProAPI: ExifProHostAPI;
}
export {};