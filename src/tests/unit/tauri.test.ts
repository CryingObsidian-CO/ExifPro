import { describe, it, expect, beforeEach, vi } from "vitest";

const { mockInvoke } = vi.hoisted(() => ({ mockInvoke: vi.fn() }));
vi.mock("@tauri-apps/api/core", () => ({ invoke: mockInvoke }));

const { mockOpen } = vi.hoisted(() => ({ mockOpen: vi.fn() }));
vi.mock("@tauri-apps/plugin-dialog", () => ({ open: mockOpen }));

const { mockEmitParseExif } = vi.hoisted(() => ({
  mockEmitParseExif: vi.fn((exif: any[]) => exif),
}));
vi.mock("../../composables/pluginManager", () => ({
  pluginManager: { emitParseExif: mockEmitParseExif },
}));

import { useTauri } from "../../composables/tauri";

describe("useTauri", () => {
  const tauri = useTauri();

  beforeEach(() => { vi.clearAllMocks(); });

  it("selectDirectory returns path / null", async () => {
    mockOpen.mockResolvedValue("/photos");
    expect(await tauri.selectDirectory()).toBe("/photos");
    mockOpen.mockResolvedValue(null);
    expect(await tauri.selectDirectory()).toBeNull();
  });

  it("scanDirectory", async () => {
    const photos = [{ file_path: "/a.jpg", file_name: "a.jpg" }];
    mockInvoke.mockResolvedValue(photos);
    expect(await tauri.scanDirectory("/p", true)).toEqual(photos);
    expect(mockEmitParseExif).toHaveBeenCalled();
  });

  it("groupPhotos", async () => {
    const groups = [{ id: "g1", group_type: "Single", name: "G1", photos: [] }];
    mockInvoke.mockResolvedValue(groups);
    expect(await tauri.groupPhotos([], null)).toEqual(groups);
  });

  it("organizeFiles", async () => {
    mockInvoke.mockResolvedValue(undefined);
    await tauri.organizeFiles([], "/o", true, false);
    expect(mockInvoke).toHaveBeenCalledWith("organize_files_command", {
      groups: [], outputDir: "/o", copyMode: true, overwrite: false,
    });
  });

  it("saveConfig / loadConfig / resetConfig", async () => {
    const cfg: any = { aeb_settings: {} };
    mockInvoke.mockResolvedValue(undefined);
    await tauri.saveConfig(cfg);

    mockInvoke.mockResolvedValue(cfg);
    expect(await tauri.loadConfig()).toEqual(cfg);

    mockInvoke.mockResolvedValue(cfg);
    expect(await tauri.resetConfig()).toEqual(cfg);
  });

  it("plugin management commands", async () => {
    mockInvoke.mockResolvedValue(undefined);
    await tauri.enablePlugin("p1");
    await tauri.disablePlugin("p1");

    mockInvoke.mockResolvedValue({ k: "v" });
    expect(await tauri.getPluginConfig("p1")).toEqual({ k: "v" });

    mockInvoke.mockResolvedValue(undefined);
    await tauri.setPluginConfig("p1", { k: "v" });
  });

  it("file ops and thumbnail", async () => {
    mockInvoke.mockResolvedValue("content");
    expect(await tauri.readPluginFile("/z", "m.ts")).toBe("content");

    mockInvoke.mockResolvedValue([1, 2, 3]);
    expect(await tauri.readPluginBinary("/z", "i.png")).toBeInstanceOf(Uint8Array);

    mockInvoke.mockResolvedValue([10]);
    expect(await tauri.pluginFileOp("p1", "read", "/f")).toBeInstanceOf(Uint8Array);
    await tauri.pluginFileOp("p1", "write", "/f", new Uint8Array([1]));
    await tauri.pluginFileOp("p1", "mkdir", "/d");

    mockInvoke.mockResolvedValue("data:...");
    expect(await tauri.getThumbnail("/p.jpg", "small")).toBe("data:...");
    mockInvoke.mockResolvedValue(null);
    expect(await tauri.getThumbnail("/p.jpg", "large")).toBeNull();
  });

  it("propagates invoke errors", async () => {
    mockInvoke.mockRejectedValue(new Error("network error"));
    await expect(tauri.loadConfig()).rejects.toThrow("network error");
  });
});
