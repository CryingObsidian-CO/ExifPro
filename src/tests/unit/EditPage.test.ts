import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mount } from "@vue/test-utils";
import { nextTick } from "vue";

vi.stubGlobal(
  "IntersectionObserver",
  class {
    observe = vi.fn();
    disconnect = vi.fn();
    unobserve = vi.fn();
  },
);

const mockTauri = vi.hoisted(() => ({
  getThumbnail: vi.fn(),
  organizeFiles: vi.fn(),
}));

const mockShowAlert = vi.hoisted(() => vi.fn());
const mockShowConfirm = vi.hoisted(() => vi.fn());
const mockRouterPush = vi.hoisted(() => vi.fn());

const mockPluginManager = vi.hoisted(() => ({
  isInitialized: false,
  getGroupActions: vi.fn(() => []),
  getImageActions: vi.fn(() => []),
  emitGroupAction: vi.fn(),
  emitImageAction: vi.fn(),
}));

const mockWindow = vi.hoisted(() => ({
  minimize: vi.fn(),
  toggleMaximize: vi.fn(),
  close: vi.fn(),
}));

const mockStore = vi.hoisted(() => {
  let _groups: any[] = [];
  return {
    get groups() { return _groups; },
    set groups(v: any[]) { _groups = v; },
    outputDirectory: "",
    copyMode: true,
    overwrite: false,
    isOrganizing: false,
    config: { sub_second_digits: 3 } as any,
    get photosNumber() {
      return _groups.reduce((sum: number, g: any) => sum + (g.photos?.length ?? 0), 0);
    },
    get groupsNumber() { return _groups.length; },
    findGroup: vi.fn(),
    updateGroup: vi.fn((_id: string, _updates: any) => true),
    disbandGroup: vi.fn(() => true),
    createGroup: vi.fn((name: string) => ({ id: `group_${name}`, name, group_type: "Single" as const, photos: [] })),
    movePhotoToGroup: vi.fn(() => true),
    mergeGroups: vi.fn((_ids: string[], name: string) => ({ id: `group_${name}`, name, group_type: "Single" as const, photos: [] })),
  };
});

vi.mock("../../composables/tauri", () => ({ useTauri: () => mockTauri }));
vi.mock("../../composables/dialog", () => ({
  useDialog: () => ({ showAlert: mockShowAlert, showConfirm: mockShowConfirm }),
}));
vi.mock("../../composables/pluginManager", () => ({ pluginManager: mockPluginManager }));
vi.mock("vue-router", () => ({ useRouter: () => ({ push: mockRouterPush }) }));
vi.mock("vue-i18n", () => ({ useI18n: () => ({ t: (key: string) => key }) }));
vi.mock("@tauri-apps/api/window", () => ({ getCurrentWindow: () => mockWindow }));
vi.mock("../../composables/builtinPlugins", () => ({ builtinPlugins: {} }));
vi.mock("../../store/store", () => ({ store: mockStore }));

import EditPage from "../../pages/EditPage.vue";

function makeGroup(overrides: Partial<any> = {}) {
  return {
    id: "g1",
    name: "Group 1",
    group_type: "Single",
    photos: [
      {
        file_path: "/a.jpg",
        file_name: "a.jpg",
        capture_time: "2024:01:15 10:30:00",
        sub_time: "123",
        offset_time_original: "+08:00",
        shutter_speed: "1/250",
        aperture: "2.8",
        iso: "400",
        exposure_compensation: "0",
        exposure_mode: 0,
        focal_length: "50",
        focus_distance: "5",
        camera_make: "Canon",
        camera_model: "EOS R5",
      },
    ],
    ...overrides,
  };
}

describe("EditPage", () => {
  let wrapper: ReturnType<typeof mount> | null = null;

  beforeEach(() => {
    vi.clearAllMocks();
    mockStore.groups = [];
    mockStore.outputDirectory = "";
    mockStore.isOrganizing = false;
    mockStore.config = { sub_second_digits: 3 };
    mockTauri.getThumbnail.mockResolvedValue("data:image/png;base64,thumb");
    mockTauri.organizeFiles.mockResolvedValue(undefined);
  });

  afterEach(() => {
    if (wrapper) {
      wrapper.unmount();
      wrapper = null;
    }
  });

  function createWrapper() {
    wrapper = mount(EditPage, {
      attachTo: document.body,
      global: {
        stubs: {
          IconSave: true, IconUndo: true, IconPlus: true, IconMove: true,
          IconMerge: true, IconEdit: true, IconTrash: true, IconClose: true,
          IconMinimize: true, IconMaximize: true, IconImage: true, IconPlugin: true,
        },
      },
    });
    return wrapper;
  }

  it("renders without crashing", () => {
    mockStore.groups = [makeGroup()];
    expect(createWrapper().find(".edit-page").exists()).toBe(true);
  });

  it("shows summary with groups and photos count", () => {
    mockStore.groups = [makeGroup()];
    const w = createWrapper();
    expect(w.text()).toContain("edit.summary");
  });

  it("renders group names", () => {
    mockStore.groups = [makeGroup({ name: "TestGroup" })];
    const w = createWrapper();
    expect(w.text()).toContain("TestGroup");
  });

  it("handleMinimize calls appWindow.minimize", () => {
    mockStore.groups = [makeGroup()];
    createWrapper();
    const minimizeBtn = document.querySelector(
      '.win-btn[title="app.window.minimize"]',
    ) as HTMLElement;
    expect(minimizeBtn).not.toBeNull();
    minimizeBtn!.click();
    expect(mockWindow.minimize).toHaveBeenCalled();
  });

  it("handleMaximize calls appWindow.toggleMaximize", () => {
    mockStore.groups = [makeGroup()];
    createWrapper();
    const maxBtn = document.querySelector(
      '.win-btn[title="app.window.maximize"]',
    ) as HTMLElement;
    expect(maxBtn).not.toBeNull();
    maxBtn!.click();
    expect(mockWindow.toggleMaximize).toHaveBeenCalled();
  });

  it("handleClose calls appWindow.close", () => {
    mockStore.groups = [makeGroup()];
    createWrapper();
    const closeBtn = document.querySelector(
      '.win-btn[title="app.window.close"]',
    ) as HTMLElement;
    expect(closeBtn).not.toBeNull();
    closeBtn!.click();
    expect(mockWindow.close).toHaveBeenCalled();
  });

  it("executeOrganize shows alert when no output directory", async () => {
    mockStore.outputDirectory = "";
    mockStore.groups = [makeGroup()];
    createWrapper();
    const saveBtn = document.querySelector(
      ".header-actions .variant-primary",
    ) as HTMLElement;
    expect(saveBtn).toBeTruthy();
    saveBtn!.click();
    await new Promise((r) => setTimeout(r, 10));
    await nextTick();
    expect(mockShowAlert).toHaveBeenCalledWith("edit.missing_output_dir", {
      title: "edit.missing_output_title",
      tone: "warning",
    });
    expect(mockRouterPush).toHaveBeenCalledWith("/");
  });

  it("executeOrganize shows alert when no groups", async () => {
    mockStore.outputDirectory = "/output";
    mockStore.groups = [];
    createWrapper();
    const saveBtn = document.querySelector(
      ".header-actions .variant-primary",
    ) as HTMLElement;
    saveBtn?.click();
    await new Promise((r) => setTimeout(r, 10));
    await nextTick();
    expect(mockShowAlert).toHaveBeenCalledWith("edit.no_groups", {
      title: "edit.no_groups_title",
      tone: "warning",
    });
  });

  it("executeOrganize calls organizeFiles when confirmed", async () => {
    mockStore.outputDirectory = "/output";
    mockStore.groups = [makeGroup()];
    mockShowConfirm.mockResolvedValue(true);
    mockShowAlert.mockResolvedValue(undefined);

    createWrapper();
    const saveBtn = document.querySelector(
      ".header-actions .variant-primary",
    ) as HTMLElement;
    saveBtn!.click();
    await new Promise((r) => setTimeout(r, 10));
    await nextTick();
    expect(mockShowConfirm).toHaveBeenCalled();
    expect(mockTauri.organizeFiles).toHaveBeenCalled();
    expect(mockShowAlert).toHaveBeenCalledWith("edit.organization_complete", {
      title: "edit.complete",
      tone: "success",
    });
  });

  it("executeOrganize handles organizeFiles error", async () => {
    mockStore.outputDirectory = "/output";
    mockStore.groups = [makeGroup()];
    mockShowConfirm.mockResolvedValue(true);
    mockTauri.organizeFiles.mockRejectedValue(new Error("disk full"));

    createWrapper();
    const saveBtn = document.querySelector(
      ".header-actions .variant-primary",
    ) as HTMLElement;
    saveBtn!.click();
    await new Promise((r) => setTimeout(r, 10));
    await nextTick();
    expect(mockShowAlert).toHaveBeenCalled();
  });

  it("sets isOrganizing during organize and clears when done", async () => {
    mockStore.outputDirectory = "/output";
    mockStore.groups = [makeGroup()];
    mockShowConfirm.mockResolvedValue(true);
    mockShowAlert.mockResolvedValue(undefined);

    createWrapper();
    const saveBtn = document.querySelector(
      ".header-actions .variant-primary",
    ) as HTMLElement;
    saveBtn!.click();
    await Promise.resolve();
    await nextTick();
    expect(mockStore.isOrganizing).toBe(true);
    await new Promise((r) => setTimeout(r, 10));
    await nextTick();
    expect(mockStore.isOrganizing).toBe(false);
  });

  it("openPhotoDetail shows detail dialog", async () => {
    mockStore.groups = [makeGroup()];
    createWrapper();
    await nextTick();

    const thumb = document.querySelector(
      ".photo-thumb[data-photo-key]",
    );
    expect(thumb).not.toBeNull();
    (thumb as HTMLElement).dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));
    await nextTick();
    const detail = document.querySelector(".photo-detail-dialog");
    expect(detail).not.toBeNull();
  });

  it("closePhotoDetail hides detail dialog", async () => {
    mockStore.groups = [makeGroup()];
    createWrapper();
    await nextTick();

    const thumb = document.querySelector(
      ".photo-thumb[data-photo-key]",
    );
    expect(thumb).not.toBeNull();
    (thumb as HTMLElement).dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));
    await nextTick();
    const closeBtn = document.querySelector(
      ".photo-detail-header .win-button",
    );
    expect(closeBtn).not.toBeNull();
    (closeBtn as HTMLElement).click();
    await nextTick();
    expect(document.querySelector(".photo-detail-dialog")).toBeNull();
  });

  it("photo selection via click", async () => {
    mockStore.groups = [makeGroup()];
    createWrapper();
    await nextTick();

    const thumb = document.querySelector(
      ".photo-thumb[data-photo-key]",
    );
    expect(thumb).not.toBeNull();
    (thumb as HTMLElement).dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await nextTick();
    expect(thumb!.classList.contains("selected")).toBe(true);
  });

  it("Escape key closes photo detail", async () => {
    mockStore.groups = [makeGroup()];
    createWrapper();
    await nextTick();

    const thumb = document.querySelector(
      ".photo-thumb[data-photo-key]",
    );
    expect(thumb).not.toBeNull();
    (thumb as HTMLElement).dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));
    await nextTick();
    expect(document.querySelector(".photo-detail-dialog")).not.toBeNull();
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    await nextTick();
    expect(document.querySelector(".photo-detail-dialog")).toBeNull();
  });

  it("detail thumbnail is loaded when photo is opened", async () => {
    mockStore.groups = [makeGroup()];
    createWrapper();
    await nextTick();

    const thumb = document.querySelector(
      ".photo-thumb[data-photo-key]",
    );
    expect(thumb).not.toBeNull();
    (thumb as HTMLElement).dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));
    await nextTick();
    expect(mockTauri.getThumbnail).toHaveBeenCalledWith("/a.jpg", "large");
  });

  it("save button is disabled during organizing", () => {
    mockStore.isOrganizing = true;
    mockStore.groups = [makeGroup()];
    const w = createWrapper();
    const saveBtn = w.find(".header-actions .variant-primary");
    expect(saveBtn.attributes("disabled")).toBeDefined();
  });
});
