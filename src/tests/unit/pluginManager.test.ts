import { describe, it, expect, beforeEach, vi } from "vitest";

const { mockTauri, builtinPluginsMock, storeMock, formatErrorMock } =
  vi.hoisted(() => ({
    mockTauri: {
      selectDirectory: vi.fn(),
      scanDirectory: vi.fn(),
      groupPhotos: vi.fn(),
      organizeFiles: vi.fn(),
      saveConfig: vi.fn(),
      loadConfig: vi.fn(),
      resetConfig: vi.fn(),
      listPlugins: vi.fn(),
      enablePlugin: vi.fn(),
      disablePlugin: vi.fn(),
      getPluginConfig: vi.fn(),
      setPluginConfig: vi.fn(),
      readPluginFile: vi.fn(),
      readPluginBinary: vi.fn(),
      pluginFileOp: vi.fn(),
      getThumbnail: vi.fn(),
    },
    builtinPluginsMock: {} as Record<string, any>,
    storeMock: {
      groups: [] as any[],
      createGroup: vi.fn(),
      movePhotoToGroup: vi.fn(),
      mergeGroups: vi.fn(),
      findGroup: vi.fn(),
      disbandGroup: vi.fn(),
    },
    formatErrorMock: vi.fn((e: any) => String(e)),
  }));

vi.mock("../../composables/tauri", () => ({ useTauri: () => mockTauri }));
vi.mock("../../composables/builtinPlugins", () => ({ builtinPlugins: builtinPluginsMock }));
vi.mock("../../store/store", () => ({ store: storeMock }));
vi.mock("../../composables/logger", () => ({ formatError: formatErrorMock }));
vi.mock("typescript", () => ({
  default: {
    transpileModule: vi.fn((code: string, _opts: any) => ({ outputText: code })),
    ModuleKind: { Preserve: 1 },
    ScriptTarget: { ES2020: 2 },
    ModuleResolutionKind: { Bundler: 3 },
  },
}));

import { pluginManager } from "../../composables/pluginManager";

describe("PluginManager", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockTauri.listPlugins.mockResolvedValue([]);
    builtinPluginsMock["test-builtin"] = {
      hooks: {
        onLoad: vi.fn(),
        onParseExif: vi.fn((exif: any[]) => exif),
        onGroupCreated: vi.fn((g: any) => g),
      },
    };
  });

  it("starts with isInitialized = false", () => {
    expect(typeof pluginManager.isInitialized).toBe("boolean");
  });

  it("initialize with empty plugin list", async () => {
    await pluginManager.initialize();
    expect(pluginManager.isInitialized).toBe(true);
    expect(mockTauri.listPlugins).toHaveBeenCalled();
  });

  it("initialize is idempotent", async () => {
    await pluginManager.initialize();
    mockTauri.listPlugins.mockClear();
    await pluginManager.initialize();
    expect(mockTauri.listPlugins).not.toHaveBeenCalled();
  });

  it("handles listPlugins rejection", async () => {
    mockTauri.listPlugins.mockRejectedValue(new Error("Tauri unavailable"));
    await pluginManager.initialize();
  });

  it("getPlugins returns array", () => {
    expect(Array.isArray(pluginManager.getPlugins())).toBe(true);
  });

  it("emitParseExif passes through exif", () => {
    const exif = [{ file_path: "/a.jpg", file_name: "a.jpg" }];
    expect(pluginManager.emitParseExif(exif)).toEqual(exif);
  });

  it("emitGroupCreated passes through", () => {
    const g = { id: "g1", group_type: "Single" as const, name: "G1", photos: [] };
    expect(pluginManager.emitGroupCreated(g)).toEqual(g);
  });

  it("emit helpers do not throw", () => {
    const g = { id: "g1", group_type: "Single" as const, name: "G1", photos: [] };
    expect(() => pluginManager.emitMoveToGroup(g, [])).not.toThrow();
    expect(() => pluginManager.emitGroupMerge([], { ...g, id: "m" })).not.toThrow();
    expect(() => pluginManager.emitGroupUpdated(g, { name: "New" })).not.toThrow();
    expect(() => pluginManager.emitGroupDisband(g)).not.toThrow();
  });

  it("emitGroupAction / emitImageAction resolve", async () => {
    const g = { id: "g1", group_type: "Single" as const, name: "G1", photos: [] };
    const p = { file_path: "/a.jpg", file_name: "a.jpg" };
    await expect(pluginManager.emitGroupAction("act", g)).resolves.toBeUndefined();
    await expect(pluginManager.emitImageAction("act", p)).resolves.toBeUndefined();
  });

  it("getGroupActions / getImageActions return empty", () => {
    expect(pluginManager.getGroupActions("Single")).toEqual([]);
    expect(pluginManager.getImageActions("Single")).toEqual([]);
  });

  it("updatePluginConfig throws for unknown", async () => {
    await expect(pluginManager.updatePluginConfig("nonexistent")).rejects.toThrow(
      "Plugin nonexistent not found",
    );
  });
});
