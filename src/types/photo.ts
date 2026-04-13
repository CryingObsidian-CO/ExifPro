export type GroupType = 'FocusBracketing' | 'AEB' | 'Burst' | 'Single';

export interface ExifInfo {
  file_path: string;
  file_name: string;
  capture_time?: string;
  subTime?: string
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