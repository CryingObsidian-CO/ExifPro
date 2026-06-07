import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

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
import { PluginAPIContext } from "../../types/plugin";

function resetPluginManager() {
  (pluginManager as any).initialized = false;
  (pluginManager as any).plugins = new Map();
  (pluginManager as any).apiContexts = new Map();
}

describe("PluginManager", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockTauri.listPlugins.mockResolvedValue([]);
    builtinPluginsMock["test-builtin"] = {
      hooks: {
        onLoad: vi.fn(),
        onParseExif: vi.fn((exif: any[]) => exif),
        onGroupCreated: vi.fn((g: any) => g),
        onRegisterUIExtensions: vi.fn(() => ({
          groupActions: [
            {
              id: "builtin-action",
              label: "Builtin Action",
              groupTypes: ["Single"],
            },
          ],
          imageActions: [],
        })),
      },
    };
  });

  afterEach(() => {
    resetPluginManager();
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
    resetPluginManager();
    mockTauri.listPlugins.mockRejectedValue(new Error("Tauri unavailable"));
    await pluginManager.initialize();
    expect(pluginManager.isInitialized).toBe(false);
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

  it("getGroupActions / getImageActions return empty without plugins", () => {
    expect(pluginManager.getGroupActions("Single")).toEqual([]);
    expect(pluginManager.getImageActions("Single")).toEqual([]);
  });

  it("updatePluginConfig throws for unknown", async () => {
    await expect(pluginManager.updatePluginConfig("nonexistent")).rejects.toThrow(
      "Plugin nonexistent not found",
    );
  });

  describe("loadPlugin with builtin plugins", () => {
    it("loads a builtin plugin during initialization", async () => {
      resetPluginManager();
      mockTauri.getPluginConfig.mockResolvedValue({});
      mockTauri.listPlugins.mockResolvedValue([
        {
          manifest: {
            id: "test-builtin",
            name: "Test Builtin",
            version: "1.0.0",
            capabilities: { ui_extensions: true },
            config_schema: {},
          },
          enabled: true,
          zip_path: "/test.zip",
          builtin: true,
        },
      ]);
      await pluginManager.initialize();
      expect(pluginManager.isInitialized).toBe(true);
      const plugins = pluginManager.getPlugins();
      expect(plugins.length).toBe(1);
      expect(plugins[0].manifest.id).toBe("test-builtin");
      expect(plugins[0].enabled).toBe(true);
    });

    it("calls onLoad hook when loading a builtin plugin", async () => {
      resetPluginManager();
      const onLoad = vi.fn();
      builtinPluginsMock["test-builtin"] = {
        hooks: { onLoad, onParseExif: vi.fn((exif: any[]) => exif), onGroupCreated: vi.fn((g: any) => g) },
      };
      mockTauri.getPluginConfig.mockResolvedValue({});
      mockTauri.listPlugins.mockResolvedValue([
        {
          manifest: { id: "test-builtin", name: "TB", version: "1.0.0", capabilities: {}, config_schema: {} },
          enabled: true,
          zip_path: "/t.zip",
          builtin: true,
        },
      ]);
      await pluginManager.initialize();
      expect(onLoad).toHaveBeenCalled();
    });

    it("handles onLoad error gracefully", async () => {
      resetPluginManager();
      builtinPluginsMock["test-builtin"] = {
        hooks: { onLoad: vi.fn(() => { throw new Error("onLoad failed"); }), onParseExif: vi.fn((exif: any[]) => exif), onGroupCreated: vi.fn((g: any) => g) },
      };
      mockTauri.getPluginConfig.mockResolvedValue({});
      mockTauri.listPlugins.mockResolvedValue([
        {
          manifest: { id: "test-builtin", name: "TB", version: "1.0.0", capabilities: {}, config_schema: {} },
          enabled: true,
          zip_path: "/t.zip",
          builtin: true,
        },
      ]);
      await expect(pluginManager.initialize()).resolves.toBeUndefined();
      expect(pluginManager.getPlugins().length).toBe(1);
    });

    it("calls onRegisterUIExtensions when plugin has ui_extensions capability", async () => {
      resetPluginManager();
      mockTauri.getPluginConfig.mockResolvedValue({});
      mockTauri.listPlugins.mockResolvedValue([
        {
          manifest: {
            id: "test-builtin",
            name: "TB",
            version: "1.0.0",
            capabilities: { ui_extensions: true },
            config_schema: {},
          },
          enabled: true,
          zip_path: "/t.zip",
          builtin: true,
        },
      ]);
      await pluginManager.initialize();
      const actions = pluginManager.getGroupActions("Single");
      expect(actions.length).toBeGreaterThanOrEqual(1);
    });

    it("loads disabled builtin plugin without calling hooks", async () => {
      resetPluginManager();
      const onLoad = vi.fn();
      builtinPluginsMock["test-builtin"] = {
        hooks: { onLoad, onParseExif: vi.fn((exif: any[]) => exif), onGroupCreated: vi.fn((g: any) => g) },
      };
      mockTauri.listPlugins.mockResolvedValue([
        {
          manifest: { id: "test-builtin", name: "TB", version: "1.0.0", capabilities: {}, config_schema: {} },
          enabled: false,
          zip_path: "/t.zip",
          builtin: true,
        },
      ]);
      await pluginManager.initialize();
      expect(onLoad).not.toHaveBeenCalled();
      const plugins = pluginManager.getPlugins();
      expect(plugins.length).toBe(1);
      expect(plugins[0].enabled).toBe(false);
    });
  });

  describe("enablePlugin / disablePlugin", () => {
    it("enablePlugin loads and enables a disabled plugin", async () => {
      resetPluginManager();
      builtinPluginsMock["ext-plugin"] = {
        hooks: { onLoad: vi.fn(), onParseExif: vi.fn((exif: any[]) => exif), onGroupCreated: vi.fn((g: any) => g) },
      };
      mockTauri.listPlugins.mockResolvedValue([
        {
          manifest: { id: "ext-plugin", name: "Ext", version: "1.0.0", capabilities: {}, config_schema: {} },
          enabled: false,
          zip_path: "/ext.zip",
          builtin: true,
        },
      ]);
      mockTauri.getPluginConfig.mockResolvedValue({});
      await pluginManager.initialize();
      expect(pluginManager.getPlugins().find((p) => p.manifest.id === "ext-plugin")?.enabled).toBe(false);
      await pluginManager.enablePlugin("ext-plugin");
      expect(pluginManager.getPlugins().find((p) => p.manifest.id === "ext-plugin")?.enabled).toBe(true);
    });

    it("disablePlugin calls onUnload and marks plugin disabled", async () => {
      resetPluginManager();
      const onUnload = vi.fn();
      builtinPluginsMock["ext-plugin"] = {
        hooks: {
          onLoad: vi.fn(),
          onUnload,
          onParseExif: vi.fn((exif: any[]) => exif),
          onGroupCreated: vi.fn((g: any) => g),
        },
      };
      mockTauri.getPluginConfig.mockResolvedValue({});
      mockTauri.listPlugins.mockResolvedValue([
        {
          manifest: { id: "ext-plugin", name: "Ext", version: "1.0.0", capabilities: {}, config_schema: {} },
          enabled: true,
          zip_path: "/ext.zip",
          builtin: true,
        },
      ]);
      await pluginManager.initialize();
      const p = pluginManager.getPlugins().find((p) => p.manifest.id === "ext-plugin");
      expect(p?.enabled).toBe(true);
      await pluginManager.disablePlugin("ext-plugin");
      expect(onUnload).toHaveBeenCalled();
      expect(mockTauri.disablePlugin).toHaveBeenCalledWith("ext-plugin");
      const after = pluginManager.getPlugins().find((p) => p.manifest.id === "ext-plugin");
      expect(after?.enabled).toBe(false);
    });

    it("enablePlugin for already-enabled plugin is no-op", async () => {
      await pluginManager.enablePlugin("nonexistent");
      expect(mockTauri.enablePlugin).not.toHaveBeenCalled();
    });

    it("disablePlugin for already-disabled plugin is no-op", async () => {
      await pluginManager.disablePlugin("nonexistent");
      expect(mockTauri.disablePlugin).not.toHaveBeenCalled();
    });
  });

  describe("emit with enabled plugins", () => {
    it("emitParseExif calls plugin hooks", async () => {
      resetPluginManager();
      const onParseExif = vi.fn((exif: any[]) => exif.map((e: any) => ({ ...e, enhanced: true })));
      builtinPluginsMock["enhancer"] = {
        hooks: {
          onLoad: vi.fn(),
          onParseExif,
          onGroupCreated: vi.fn((g: any) => g),
        },
      };
      mockTauri.getPluginConfig.mockResolvedValue({});
      mockTauri.listPlugins.mockResolvedValue([
        {
          manifest: {
            id: "enhancer",
            name: "Enhancer",
            version: "1.0.0",
            capabilities: { exif_enhancement: true },
            config_schema: {},
          },
          enabled: true,
          zip_path: "/e.zip",
          builtin: true,
        },
      ]);
      await pluginManager.initialize();
      const exif = [{ file_path: "/a.jpg", file_name: "a.jpg" }];
      const result = pluginManager.emitParseExif(exif);
      expect(onParseExif).toHaveBeenCalled();
      expect((result[0] as any).enhanced).toBe(true);
    });

    it("emitGroupCreated calls plugin hooks", async () => {
      resetPluginManager();
      const onGroupCreated = vi.fn((g: any) => ({ ...g, enhanced: true }));
      builtinPluginsMock["grouper"] = {
        hooks: {
          onLoad: vi.fn(),
          onParseExif: vi.fn((exif: any[]) => exif),
          onGroupCreated,
        },
      };
      mockTauri.getPluginConfig.mockResolvedValue({});
      mockTauri.listPlugins.mockResolvedValue([
        {
          manifest: {
            id: "grouper",
            name: "Grouper",
            version: "1.0.0",
            capabilities: { grouping: true },
            config_schema: {},
          },
          enabled: true,
          zip_path: "/g.zip",
          builtin: true,
        },
      ]);
      await pluginManager.initialize();
      const g = { id: "g1", group_type: "Single" as const, name: "G1", photos: [] };
      const result = pluginManager.emitGroupCreated(g);
      expect(onGroupCreated).toHaveBeenCalled();
      expect((result as any).enhanced).toBe(true);
    });

    it("getGroupActions returns actions from enabled plugins", async () => {
      resetPluginManager();
      const onRegisterUIExtensions = vi.fn(() => ({
        groupActions: [{ id: "act1", label: "Action 1", groupTypes: ["Single"] }],
        imageActions: [],
      }));
      builtinPluginsMock["ui-ext"] = {
        hooks: {
          onLoad: vi.fn(),
          onParseExif: vi.fn((exif: any[]) => exif),
          onGroupCreated: vi.fn((g: any) => g),
          onRegisterUIExtensions,
        },
      };
      mockTauri.getPluginConfig.mockResolvedValue({});
      mockTauri.listPlugins.mockResolvedValue([
        {
          manifest: {
            id: "ui-ext",
            name: "UI Ext",
            version: "1.0.0",
            capabilities: { ui_extensions: true },
            config_schema: {},
          },
          enabled: true,
          zip_path: "/u.zip",
          builtin: true,
        },
      ]);
      await pluginManager.initialize();
      const actions = pluginManager.getGroupActions("Single");
      expect(actions.length).toBe(1);
      expect(actions[0].id).toBe("act1");
    });

    it("getImageActions returns actions from enabled plugins", async () => {
      resetPluginManager();
      const onRegisterUIExtensions = vi.fn(() => ({
        groupActions: [],
        imageActions: [
          {
            id: "img-act",
            label: "Image Action",
            groupTypes: ["Single"],
          },
        ],
      }));
      builtinPluginsMock["ui-ext2"] = {
        hooks: {
          onLoad: vi.fn(),
          onParseExif: vi.fn((exif: any[]) => exif),
          onGroupCreated: vi.fn((g: any) => g),
          onRegisterUIExtensions,
        },
      };
      mockTauri.getPluginConfig.mockResolvedValue({});
      mockTauri.listPlugins.mockResolvedValue([
        {
          manifest: {
            id: "ui-ext2",
            name: "UI Ext2",
            version: "1.0.0",
            capabilities: { ui_extensions: true },
            config_schema: {},
          },
          enabled: true,
          zip_path: "/u2.zip",
          builtin: true,
        },
      ]);
      await pluginManager.initialize();
      const actions = pluginManager.getImageActions("Single");
      expect(actions.length).toBe(1);
      expect(actions[0].id).toBe("img-act");
    });

    it("emitGroupAction calls plugin onGroupAction", async () => {
      resetPluginManager();
      const onGroupAction = vi.fn();
      builtinPluginsMock["action-plugin"] = {
        hooks: {
          onLoad: vi.fn(),
          onParseExif: vi.fn((exif: any[]) => exif),
          onGroupCreated: vi.fn((g: any) => g),
          onGroupAction,
        },
      };
      mockTauri.getPluginConfig.mockResolvedValue({});
      mockTauri.listPlugins.mockResolvedValue([
        {
          manifest: {
            id: "action-plugin",
            name: "AP",
            version: "1.0.0",
            capabilities: { ui_extensions: true },
            config_schema: {},
          },
          enabled: true,
          zip_path: "/a.zip",
          builtin: true,
        },
      ]);
      await pluginManager.initialize();
      const group = { id: "g1", group_type: "Single" as const, name: "G1", photos: [] };
      await pluginManager.emitGroupAction("test-action", group);
      expect(onGroupAction).toHaveBeenCalledWith("test-action", group);
    });

    it("emitImageAction calls plugin onImageAction", async () => {
      resetPluginManager();
      const onImageAction = vi.fn();
      builtinPluginsMock["img-action-plugin"] = {
        hooks: {
          onLoad: vi.fn(),
          onParseExif: vi.fn((exif: any[]) => exif),
          onGroupCreated: vi.fn((g: any) => g),
          onImageAction,
        },
      };
      mockTauri.getPluginConfig.mockResolvedValue({});
      mockTauri.listPlugins.mockResolvedValue([
        {
          manifest: {
            id: "img-action-plugin",
            name: "IAP",
            version: "1.0.0",
            capabilities: { ui_extensions: true },
            config_schema: {},
          },
          enabled: true,
          zip_path: "/ia.zip",
          builtin: true,
        },
      ]);
      await pluginManager.initialize();
      const photo = { file_path: "/p.jpg", file_name: "p.jpg" };
      await pluginManager.emitImageAction("img-act", photo);
      expect(onImageAction).toHaveBeenCalledWith("img-act", photo);
    });
  });

  describe("updatePluginConfig", () => {
    it("updates config for existing plugin", async () => {
      resetPluginManager();
      builtinPluginsMock["cfg-plugin"] = {
        hooks: { onLoad: vi.fn(), onParseExif: vi.fn((exif: any[]) => exif), onGroupCreated: vi.fn((g: any) => g) },
      };
      mockTauri.getPluginConfig.mockResolvedValueOnce({});
      mockTauri.getPluginConfig.mockResolvedValueOnce({ key: "val" });
      mockTauri.listPlugins.mockResolvedValue([
        {
          manifest: { id: "cfg-plugin", name: "CFG", version: "1.0.0", capabilities: {}, config_schema: {} },
          enabled: true,
          zip_path: "/c.zip",
          builtin: true,
        },
      ]);
      await pluginManager.initialize();

      await pluginManager.updatePluginConfig("cfg-plugin");
      expect(mockTauri.getPluginConfig).toHaveBeenCalledWith("cfg-plugin");
    });
  });

  describe("config_schema with getDefaultConfig", () => {
    it("uses getDefaultConfig when backend returns empty config", async () => {
      resetPluginManager();
      builtinPluginsMock["schema-plugin"] = {
        getDefaultConfig: () => ({ threshold: 80, enabled: true }),
        hooks: { onLoad: vi.fn(), onParseExif: vi.fn((exif: any[]) => exif), onGroupCreated: vi.fn((g: any) => g) },
      };
      mockTauri.getPluginConfig.mockResolvedValue(null);
      mockTauri.listPlugins.mockResolvedValue([
        {
          manifest: {
            id: "schema-plugin",
            name: "Schema",
            version: "1.0.0",
            capabilities: {},
            config_schema: { threshold: { type: "number", default: 50 } },
          },
          enabled: true,
          zip_path: "/s.zip",
          builtin: true,
        },
      ]);
      await pluginManager.initialize();
      const ctx = (pluginManager as any).apiContexts.get("schema-plugin");
      expect(ctx.getConfig()).toEqual({ threshold: 80, enabled: true });
    });
  });

  describe("createHostAPI", () => {
    it("getPluginConfig returns context config", () => {
      const context = new PluginAPIContext("test", { key: "val" });
      const api = (pluginManager as any).createHostAPI(context);
      expect(api.getPluginConfig()).toEqual({ key: "val" });
    });

    it("log calls console.log", () => {
      const spy = vi.spyOn(console, "log").mockImplementation(() => {});
      const context = new PluginAPIContext("test", {});
      const api = (pluginManager as any).createHostAPI(context);
      api.log("hello");
      expect(spy).toHaveBeenCalledWith("[Plugin:test] hello");
      spy.mockRestore();
    });

    it("getGroups returns store.groups", () => {
      storeMock.groups = [{ id: "g1", name: "G1" }];
      const context = new PluginAPIContext("test", {});
      const api = (pluginManager as any).createHostAPI(context);
      expect(api.getGroups()).toEqual([{ id: "g1", name: "G1" }]);
    });

    it("createGroup calls store and moves photos", () => {
      storeMock.createGroup.mockReturnValue({ id: "plugin_test_MyGroup", name: "MyGroup", photos: [] });
      const context = new PluginAPIContext("test", {});
      const api = (pluginManager as any).createHostAPI(context);
      const photos = [{ file_path: "/a.jpg", file_name: "a.jpg" }];
      const result = api.createGroup(photos, "Single", "MyGroup");
      expect(storeMock.createGroup).toHaveBeenCalledWith("MyGroup", "plugin_test_MyGroup", "Single");
      expect(storeMock.movePhotoToGroup).toHaveBeenCalledWith(photos, "plugin_test_MyGroup");
      expect(result).toEqual({ id: "plugin_test_MyGroup", name: "MyGroup", photos: [] });
    });

    it("createGroup returns null when store fails", () => {
      storeMock.createGroup.mockReturnValue(null);
      const context = new PluginAPIContext("test", {});
      const api = (pluginManager as any).createHostAPI(context);
      const result = api.createGroup([], "Single", "Fail");
      expect(result).toBeNull();
    });

    it("moveToGroup calls store.movePhotoToGroup", () => {
      storeMock.movePhotoToGroup.mockReturnValue(true);
      const context = new PluginAPIContext("test", {});
      const api = (pluginManager as any).createHostAPI(context);
      const photos = [{ file_path: "/a.jpg", file_name: "a.jpg" }];
      const result = api.moveToGroup("g1", photos);
      expect(storeMock.movePhotoToGroup).toHaveBeenCalledWith(photos, "g1");
      expect(result).toBe(true);
    });

    it("mergeGroups calls store.mergeGroups", () => {
      const merged = { id: "m1", name: "Merged", photos: [] };
      storeMock.mergeGroups.mockReturnValue(merged);
      const context = new PluginAPIContext("test", {});
      const api = (pluginManager as any).createHostAPI(context);
      const result = api.mergeGroups(["g1", "g2"], "Merged");
      expect(storeMock.mergeGroups).toHaveBeenCalledWith(["g1", "g2"], "Merged");
      expect(result).toBe(merged);
    });

    it("disbandGroup returns photos on success", () => {
      storeMock.findGroup.mockReturnValue({ id: "g1", name: "G1", photos: [{ file_path: "/a.jpg", file_name: "a.jpg" }] });
      storeMock.disbandGroup.mockReturnValue(true);
      const context = new PluginAPIContext("test", {});
      const api = (pluginManager as any).createHostAPI(context);
      const result = api.disbandGroup("g1");
      expect(storeMock.disbandGroup).toHaveBeenCalledWith("g1");
      expect(result).toEqual([{ file_path: "/a.jpg", file_name: "a.jpg" }]);
    });

    it("disbandGroup returns empty array when group not found", () => {
      storeMock.findGroup.mockReturnValue(null);
      const context = new PluginAPIContext("test", {});
      const api = (pluginManager as any).createHostAPI(context);
      const result = api.disbandGroup("nonexistent");
      expect(result).toEqual([]);
    });

    it("disbandGroup returns empty array when store fails", () => {
      storeMock.findGroup.mockReturnValue({ id: "g1", name: "G1", photos: [{ file_path: "/a.jpg", file_name: "a.jpg" }] });
      storeMock.disbandGroup.mockReturnValue(false);
      const context = new PluginAPIContext("test", {});
      const api = (pluginManager as any).createHostAPI(context);
      const result = api.disbandGroup("g1");
      expect(result).toEqual([]);
    });

    it("readFile reads plugin file", async () => {
      mockTauri.readPluginFile.mockResolvedValue("content");
      (pluginManager as any).plugins.set("test-host", { zipPath: "/test.zip" });
      const context = new PluginAPIContext("test-host", {});
      const api = (pluginManager as any).createHostAPI(context);
      const result = await api.readFile("file.txt");
      expect(mockTauri.readPluginFile).toHaveBeenCalledWith("/test.zip", "file.txt");
      expect(result).toBe("content");
    });

    it("readFileBinary reads plugin binary", async () => {
      mockTauri.readPluginBinary.mockResolvedValue(new Uint8Array([1, 2, 3]));
      (pluginManager as any).plugins.set("test-bin", { zipPath: "/b.zip" });
      const context = new PluginAPIContext("test-bin", {});
      const api = (pluginManager as any).createHostAPI(context);
      const result = await api.readFileBinary("data.bin");
      expect(mockTauri.readPluginBinary).toHaveBeenCalledWith("/b.zip", "data.bin");
      expect(Array.from(result)).toEqual([1, 2, 3]);
    });

    it("readExternalFile calls pluginFileOp", async () => {
      mockTauri.pluginFileOp.mockResolvedValue(new Uint8Array([4, 5, 6]));
      const context = new PluginAPIContext("ext-host", {});
      const api = (pluginManager as any).createHostAPI(context);
      const result = await api.readExternalFile("/path/to/file");
      expect(mockTauri.pluginFileOp).toHaveBeenCalledWith("ext-host", "read", "/path/to/file");
      expect(Array.from(result)).toEqual([4, 5, 6]);
    });

    it("writeFile calls pluginFileOp", async () => {
      mockTauri.pluginFileOp.mockResolvedValue(undefined);
      const context = new PluginAPIContext("write-host", {});
      const api = (pluginManager as any).createHostAPI(context);
      const data = new Uint8Array([7, 8, 9]);
      await api.writeFile("/path/to/file", data);
      expect(mockTauri.pluginFileOp).toHaveBeenCalledWith("write-host", "write", "/path/to/file", data);
    });

    it("createDirectory calls pluginFileOp", async () => {
      mockTauri.pluginFileOp.mockResolvedValue(undefined);
      const context = new PluginAPIContext("mkdir-host", {});
      const api = (pluginManager as any).createHostAPI(context);
      await api.createDirectory("/new/dir");
      expect(mockTauri.pluginFileOp).toHaveBeenCalledWith("mkdir-host", "mkdir", "/new/dir");
    });
  });
});
