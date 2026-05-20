// NOTE 修改时更新 plugin-api.d.ts 中的 GroupType 类型
export type GroupType = 'FocusBracketing' | 'AEB' | 'Burst' | 'Single' | string;


// NOTE 修改时更新 plugin-api.d.ts 中的 ExifInfo 接口
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
  group_type: GroupType;
  name: string;
  photos: ExifInfo[];
}