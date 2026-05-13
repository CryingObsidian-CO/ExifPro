import type {ExifProPluginHooks} from '../types/plugin';


export interface BuiltinPluginEntry {
  hooks: ExifProPluginHooks;
  getDefaultConfig?: () => Record<string, any>;
}

export const builtinPlugins: Record<string, BuiltinPluginEntry> = {};
