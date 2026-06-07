import { describe, it, expect, beforeEach, vi } from "vitest";
import { mount } from "@vue/test-utils";
import { nextTick } from "vue";

const mockSelectDirectory = vi.hoisted(() => vi.fn());
const mockScanDirectory = vi.hoisted(() => vi.fn<(path: string, recursive: boolean) => any[]>());
const mockGroupPhotos = vi.hoisted(() => vi.fn());
const mockShowAlert = vi.hoisted(() => vi.fn());
const mockRouterPush = vi.hoisted(() => vi.fn());

vi.mock("../../composables/tauri", () => ({
  useTauri: () => ({
    selectDirectory: mockSelectDirectory,
    scanDirectory: mockScanDirectory,
    groupPhotos: mockGroupPhotos,
  }),
}));
vi.mock("../../composables/dialog", () => ({ useDialog: () => ({ showAlert: mockShowAlert }) }));
vi.mock("vue-router", () => ({ useRouter: () => ({ push: mockRouterPush }) }));
vi.mock("vue-i18n", () => ({ useI18n: () => ({ t: (key: string) => key }) }));

import HomePage from "../../pages/HomePage.vue";
import { store } from "../../store/store";

describe("HomePage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    store.selectedDirectory = "";
    store.outputDirectory = "";
    store.recursive = true;
    store.copyMode = true;
    store.overwrite = false;
    store.isAnalyzing = false;
    store.photos = [];
    store.groups = [];
    store.config = null;
  });

  function createWrapper() {
    return mount(HomePage, {
      global: { stubs: { IconFolder: true, IconUpload: true } },
    });
  }

  it("renders page title and subtitle", () => {
    const wrapper = createWrapper();
    expect(wrapper.text()).toContain("home.title");
    expect(wrapper.text()).toContain("home.subtitle");
  });

  it("selectSourceDir sets store.selectedDirectory", async () => {
    mockSelectDirectory.mockResolvedValue("/photos");
    const wrapper = createWrapper();
    const btns = wrapper.findAll("button");
    const browse = btns.find((b) => b.text().includes("home.browse"));
    expect(browse).toBeTruthy();
    await browse!.trigger("click");
    await nextTick();
    expect(mockSelectDirectory).toHaveBeenCalled();
    expect(store.selectedDirectory).toBe("/photos");
  });

  it("selectSourceDir handles cancellation (null path)", async () => {
    mockSelectDirectory.mockResolvedValue(null);
    const wrapper = createWrapper();
    const btns = wrapper.findAll("button");
    const browse = btns.find((b) => b.text().includes("home.browse"));
    await browse!.trigger("click");
    await nextTick();
    expect(store.selectedDirectory).toBe("");
  });

  it("selectOutputDir sets store.outputDirectory", async () => {
    mockSelectDirectory.mockResolvedValue("/output");
    const wrapper = createWrapper();
    const btns = wrapper.findAll("button");
    const browseBtns = btns.filter((b) => b.text().includes("home.browse"));
    expect(browseBtns.length).toBe(2);
    await browseBtns[1].trigger("click");
    await nextTick();
    expect(store.outputDirectory).toBe("/output");
  });

  it("startAnalysis calls scanDirectory and navigates to /edit", async () => {
    store.selectedDirectory = "/photos";
    store.config = {} as any;
    const photos = [{ file_path: "/a.jpg", file_name: "a.jpg" }];
    const groups = [{ id: "g1", name: "G1", photos, group_type: "Single" }];
    mockScanDirectory.mockResolvedValue(photos);
    mockGroupPhotos.mockResolvedValue(groups);

    const wrapper = createWrapper();
    const primaryBtn = wrapper.find("button.variant-primary");
    await primaryBtn.trigger("click");
    await nextTick();
    await new Promise((r) => setTimeout(r, 10));
    await nextTick();

    expect(mockScanDirectory).toHaveBeenCalledWith("/photos", true);
    expect(store.photos).toEqual(photos);
    expect(mockGroupPhotos).toHaveBeenCalledWith(photos, store.config);
    expect(store.groups).toEqual(groups);
    expect(mockRouterPush).toHaveBeenCalledWith("/edit");
    expect(store.isAnalyzing).toBe(false);
  });

  it("startAnalysis shows alert on scan error", async () => {
    store.selectedDirectory = "/photos";
    store.config = {} as any;
    mockScanDirectory.mockRejectedValue(new Error("scan failed"));

    const wrapper = createWrapper();
    const primaryBtn = wrapper.find("button.variant-primary");
    await primaryBtn.trigger("click");
    await new Promise((r) => setTimeout(r, 10));
    await nextTick();

    expect(mockShowAlert).toHaveBeenCalledWith("home.analysis_failed", {
      title: "home.analysis_failed_title",
      tone: "error",
    });
    expect(store.isAnalyzing).toBe(false);
  });

  it("startAnalysis shows missing config warning when config is null", async () => {
    store.selectedDirectory = "/photos";
    store.config = null;
    mockScanDirectory.mockResolvedValue([]);

    const wrapper = createWrapper();
    const primaryBtn = wrapper.find("button.variant-primary");
    await primaryBtn.trigger("click");
    await new Promise((r) => setTimeout(r, 10));
    await nextTick();

    expect(mockShowAlert).toHaveBeenCalledWith("home.no_config", {
      title: "home.config_missing",
      tone: "warning",
    });
    expect(mockRouterPush).not.toHaveBeenCalled();
  });

  it("start button is disabled when isAnalyzing", () => {
    store.isAnalyzing = true;
    const wrapper = createWrapper();
    const primary = wrapper.find("button.variant-primary");
    expect(primary.attributes("disabled")).toBeDefined();
  });

  it("start button is disabled when no directory selected", () => {
    const wrapper = createWrapper();
    const primary = wrapper.find("button.variant-primary");
    expect(primary.attributes("disabled")).toBeDefined();
  });

  it("edit groups button is disabled when no groups", () => {
    const wrapper = createWrapper();
    const btns = wrapper.findAll("button");
    const editBtn = btns.find((b) => b.text().includes("home.edit_groups"));
    expect(editBtn?.attributes("disabled")).toBeDefined();
  });

  it("edit groups button is enabled when groups exist", () => {
    store.groups = [{ id: "g1", name: "G1", photos: [], group_type: "Single" }] as any;
    const wrapper = createWrapper();
    const btns = wrapper.findAll("button");
    const editBtn = btns.find((b) => b.text().includes("home.edit_groups"));
    expect(editBtn?.attributes("disabled")).toBeUndefined();
  });

  it("shows photos number and groups number", () => {
    store.photos = [{ file_path: "/a.jpg", file_name: "a.jpg" }] as any;
    store.groups = [{ id: "g1", name: "G1", photos: [], group_type: "Single" }] as any;
    const wrapper = createWrapper();
    const values = wrapper.findAll(".status-item .value");
    expect(values).toHaveLength(2);
    expect(values[0].text()).toBe("1");
    expect(values[1].text()).toBe("1");
  });
});
