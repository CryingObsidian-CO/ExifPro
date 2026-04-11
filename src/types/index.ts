import {Config} from "./config.ts";
import {ExifInfo, Group} from "./photo.ts";

export type Theme = 'light' | 'dark' | 'system';


export interface AppState {
  selectedDirectory: string;
  recursive: boolean;
  copyMode: boolean;
  overwrite: boolean;
  outputDirectory: string;
  photos: ExifInfo[];
  groups: Group[];
  config: Config | null;
  theme: Theme;
  isAnalyzing: boolean;
  isOrganizing: boolean;
}