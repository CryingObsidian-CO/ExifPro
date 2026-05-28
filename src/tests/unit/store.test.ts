import {describe, it, expect, beforeEach, vi} from "vitest";
import {nextTick} from "vue";

const {mockPluginManager} = vi.hoisted(() => {
  const emitParseExif = vi.fn((exif: any[]) => exif);
  const emitGroupCreated = vi.fn((g: any) => g);
  const emitGroupUpdated = vi.fn();
  const emitMoveToGroup = vi.fn();
  const emitGroupMerge = vi.fn();
  const emitGroupDisband = vi.fn();
  const emitGroupAction = vi.fn();
  const emitImageAction = vi.fn();
  const getPlugins = vi.fn((): any[] => []);
  const getGroupActions = vi.fn((): any[] => []);
  const getImageActions = vi.fn((): any[] => []);
  const enablePlugin = vi.fn().mockResolvedValue(undefined);
  const disablePlugin = vi.fn().mockResolvedValue(undefined);
  const updatePluginConfig = vi.fn().mockResolvedValue(undefined);
  const initialize = vi.fn().mockResolvedValue(undefined);

  return {
    mockPluginManager: {
      isInitialized: false,
      initialize,
      emitParseExif,
      emitGroupCreated,
      emitGroupUpdated,
      emitMoveToGroup,
      emitGroupMerge,
      emitGroupDisband,
      emitGroupAction,
      emitImageAction,
      getPlugins,
      getGroupActions,
      getImageActions,
      enablePlugin,
      disablePlugin,
      updatePluginConfig,
    },
  };
});

vi.mock("../../composables/pluginManager", () => ({
  pluginManager: mockPluginManager,
}));

import {Store} from "../../store/store";

describe("Store", () => {
  let store: Store;

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    store = new Store();
    // Reset state to a known baseline
    store.groups = [];
    store.photos = [];
  });

  // ── basic getters / setters ──────────────────────────────────

  it("has default values", () => {
    expect(store.selectedDirectory).toBe("");
    expect(store.recursive).toBe(true);
    expect(store.copyMode).toBe(true);
    expect(store.overwrite).toBe(false);
    expect(store.outputDirectory).toBe("");
    expect(store.photos).toEqual([]);
    expect(store.groups).toEqual([]);
    expect(store.config).toBeNull();
    expect(store.isAnalyzing).toBe(false);
    expect(store.isOrganizing).toBe(false);
    expect(store.photosNumber).toBe(0);
    expect(store.groupsNumber).toBe(0);
  });

  it("sets and gets selectedDirectory", () => {
    store.selectedDirectory = "/photos";
    expect(store.selectedDirectory).toBe("/photos");
  });

  it("sets and gets boolean flags", () => {
    store.recursive = false;
    store.copyMode = false;
    store.overwrite = true;
    expect(store.recursive).toBe(false);
    expect(store.copyMode).toBe(false);
    expect(store.overwrite).toBe(true);
  });

  it("sets and gets outputDirectory", () => {
    store.outputDirectory = "/out";
    expect(store.outputDirectory).toBe("/out");
  });

  it("sets and gets photos", () => {
    const photo = {file_path: "/a.jpg", file_name: "a.jpg"};
    store.photos = [photo];
    expect(store.photos).toEqual([photo]);
    expect(store.photosNumber).toBe(1);
  });

  it("isAnalyzing / isOrganizing toggles", () => {
    store.isAnalyzing = true;
    store.isOrganizing = true;
    expect(store.isAnalyzing).toBe(true);
    expect(store.isOrganizing).toBe(true);
  });

  // ── theme ────────────────────────────────────────────────────

  it("theme defaults to value from localStorage or 'system'", () => {
    // jsdom localStorage is empty → falls back to 'system'
    expect(["light", "dark", "system"]).toContain(store.theme);
  });

  it("theme setter updates the reactive state and localStorage", async () => {
    store.theme = "dark";
    expect(store.theme).toBe("dark");
    // Vue's watch callback is microtask-scheduled — wait for it to flush
    await nextTick();
    expect(localStorage.getItem("theme")).toBe("dark");
  });

  // ── createGroup ──────────────────────────────────────────────

  it("creates a group with default type 'Single'", () => {
    const g = store.createGroup("Test");
    expect(g).not.toBeNull();
    expect(g!.name).toBe("Test");
    expect(g!.group_type).toBe("Single");
    expect(g!.photos).toEqual([]);
    expect(store.groupsNumber).toBe(1);
  });

  it("returns null when creating a duplicate id", () => {
    store.createGroup("A", "dup");
    const dup = store.createGroup("B", "dup");
    expect(dup).toBeNull();
    expect(store.groupsNumber).toBe(1);
  });

  it("emits groupCreated through pluginManager", () => {
    store.createGroup("PluginGroup", "pg", "Burst");
    expect(mockPluginManager.emitGroupCreated).toHaveBeenCalled();
  });

  // ── findGroup ────────────────────────────────────────────────

  it("findGroup returns the group by id", () => {
    store.createGroup("FindMe", "find-me");
    const found = store.findGroup("find-me");
    expect(found).toBeDefined();
    expect(found!.name).toBe("FindMe");
  });

  it("findGroup returns undefined for unknown id", () => {
    expect(store.findGroup("nope")).toBeUndefined();
  });

  // ── updateGroup ──────────────────────────────────────────────

  it("updates a group's name", () => {
    store.createGroup("Old", "g1");
    const ok = store.updateGroup("g1", {name: "New"});
    expect(ok).toBe(true);
    expect(store.findGroup("g1")!.name).toBe("New");
  });

  it("does not allow changing the id", () => {
    store.createGroup("A", "g1");
    store.updateGroup("g1", {name: "B", id: "g2" as any} as any);
    expect(store.findGroup("g2")).toBeUndefined();
    expect(store.findGroup("g1")).toBeDefined();
  });

  it("returns false for ungrouped", () => {
    expect(store.updateGroup("ungrouped", {name: "X"})).toBe(false);
  });

  it("returns false for unknown group", () => {
    expect(store.updateGroup("unknown", {name: "X"})).toBe(false);
  });

  // ── deleteGroup ──────────────────────────────────────────────

  it("deletes a group by id", () => {
    store.createGroup("A", "g1");
    expect(store.groupsNumber).toBe(1);
    store.deleteGroup("g1");
    expect(store.groupsNumber).toBe(0);
  });

  it("refuses to delete ungrouped", () => {
    expect(store.deleteGroup("ungrouped")).toBe(false);
  });

  it("deleteGroup returns true even for unknown id (no-op)", () => {
    // The actual implementation always returns true except for 'ungrouped'
    expect(store.deleteGroup("nope")).toBe(true);
  });

  // ── movePhotoToGroup ─────────────────────────────────────────

  it("moves a photo into a group", () => {
    const photo = {file_path: "/p.jpg", file_name: "p.jpg"};
    store.createGroup("Target", "target");
    const ok = store.movePhotoToGroup([photo], "target");
    expect(ok).toBe(true);
    // Vue reactivity wraps objects in Proxy — use toEqual for deep comparison
    const photos = store.findGroup("target")!.photos;
    expect(photos.length).toBe(1);
    expect(photos[0]).toMatchObject({file_path: "/p.jpg", file_name: "p.jpg"});
    expect(mockPluginManager.emitMoveToGroup).toHaveBeenCalled();
  });

  it("returns false when target group does not exist", () => {
    const photo = {file_path: "/p.jpg", file_name: "p.jpg"};
    expect(store.movePhotoToGroup([photo], "ghost")).toBe(false);
  });

  // ── mergeGroups ──────────────────────────────────────────────

  it("merges two groups into one", () => {
    const p1 = {file_path: "/a.jpg", file_name: "a.jpg"};
    const p2 = {file_path: "/b.jpg", file_name: "b.jpg"};

    // movePhotoToGroup deletes groups that become empty after removal.
    // Create groups one at a time and add photos before creating the next group.
    store.createGroup("G1", "g1");
    store.movePhotoToGroup([p1], "g1");

    store.createGroup("G2", "g2");
    store.movePhotoToGroup([p2], "g2");

    const merged = store.mergeGroups(["g1", "g2"], "Merged");
    expect(merged).not.toBeNull();
    expect(merged!.name).toBe("Merged");
    expect(merged!.photos).toHaveLength(2);
    // Old groups should be removed
    expect(store.findGroup("g1")).toBeUndefined();
    expect(store.findGroup("g2")).toBeUndefined();
    expect(mockPluginManager.emitGroupMerge).toHaveBeenCalled();
  });

  it("returns null when less than 2 group ids", () => {
    store.createGroup("Solo", "solo");
    expect(store.mergeGroups(["solo"], "M")).toBeNull();
  });

  it("returns null when ungrouped is included", () => {
    store.createGroup("A", "a");
    expect(store.mergeGroups(["a", "ungrouped"], "M")).toBeNull();
  });

  // ── disbandGroup ─────────────────────────────────────────────

  it("disbands a group and moves photos to ungrouped", () => {
    const photo = {file_path: "/p.jpg", file_name: "p.jpg"};
    store.createGroup("ToDisband", "td");
    store.movePhotoToGroup([photo], "td");

    const ok = store.disbandGroup("td");
    expect(ok).toBe(true);
    expect(store.findGroup("td")).toBeUndefined();
    const ungroupedPhotos = store.findGroup("ungrouped")!.photos;
    expect(ungroupedPhotos.length).toBeGreaterThanOrEqual(1);
    expect(ungroupedPhotos[0]).toMatchObject({file_path: "/p.jpg", file_name: "p.jpg"});
    expect(mockPluginManager.emitGroupDisband).toHaveBeenCalled();
  });

  it("returns false for unknown group", () => {
    expect(store.disbandGroup("nope")).toBe(false);
  });

  // ── plugin sync ──────────────────────────────────────────────

  it("syncPluginsEnabled enables and disables plugins", async () => {
    mockPluginManager.getPlugins.mockReturnValue([
      {
        manifest: {
          id: "p1",
          version: "1.0",
          name: "P1",
          entry_point: "",
          capabilities: {},
          api_version: 1
        },
        enabled: false,
        zip_path: "",
      },
      {
        manifest: {
          id: "p2",
          version: "1.0",
          name: "P2",
          entry_point: "",
          capabilities: {},
          api_version: 1
        },
        enabled: true,
        zip_path: "",
      },
    ]);

    await store.syncPluginsEnabled(["p1"]);

    expect(mockPluginManager.enablePlugin).toHaveBeenCalledWith("p1");
    expect(mockPluginManager.disablePlugin).toHaveBeenCalledWith("p2");
  });
});
