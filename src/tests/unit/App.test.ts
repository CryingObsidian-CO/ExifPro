import {describe, it, expect, beforeEach, vi} from "vitest";
import {mount} from "@vue/test-utils";
import {nextTick} from "vue";

const mockTauri = vi.hoisted(() => ({
  loadConfig: vi.fn(),
  resetConfig: vi.fn(),
}));

const mockShowAlert = vi.hoisted(() => vi.fn());
const mockRouterPush = vi.hoisted(() => vi.fn());
const mockRoute = vi.hoisted(() => ({path: "/"}));

const mockWindow = vi.hoisted(() => ({
  minimize: vi.fn(),
  toggleMaximize: vi.fn(),
  close: vi.fn(),
}));

const mockStore = vi.hoisted(() => ({
  config: null as any,
  theme: "system" as string,
  pluginsInitialized: false,
  loadPlugins: vi.fn(),
}));

vi.mock("vue-router", () => ({
  useRouter: () => ({push: mockRouterPush}),
  useRoute: () => mockRoute,
}));
vi.mock("../../composables/tauri", () => ({useTauri: () => mockTauri}));
vi.mock("../../composables/dialog", () => ({
  useDialog: () => ({showAlert: mockShowAlert}),
}));
vi.mock("vue-i18n", () => ({useI18n: () => ({t: (key: string) => key})}));
vi.mock("@tauri-apps/api/window", () => ({getCurrentWindow: () => mockWindow}));
vi.mock("../../store/store", () => ({store: mockStore}));

import App from "../../App.vue";

describe("App", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStore.config = null;
    mockStore.theme = "system";
    mockStore.pluginsInitialized = false;
    mockTauri.loadConfig.mockResolvedValue({preview_max_mb: 8});
    mockTauri.resetConfig.mockResolvedValue({preview_max_mb: 8});
    mockRoute.path = "/";
  });

  function createWrapper() {
    return mount(App, {
      attachTo: document.body,
      global: {
        stubs: {
          RouterView: true,
          WinDialogHost: true,
          IconHome: true,
          IconSelection: true,
          IconSettings: true,
          IconSun: true,
          IconMoon: true,
          IconMonitor: true,
          IconBrand: true,
          IconMinimize: true,
          IconMaximize: true,
          IconClose: true,
        },
      },
    });
  }

  it("renders nav bar with brand name", () => {
    const wrapper = createWrapper();
    expect(wrapper.text()).toContain("ExifPro");
  });

  it("renders navigation items", () => {
    const wrapper = createWrapper();
    expect(wrapper.text()).toContain("app.nav.home");
    expect(wrapper.text()).toContain("app.nav.selection");
    expect(wrapper.text()).toContain("app.nav.settings");
  });

  it("hides nav bar on /edit route", () => {
    mockRoute.path = "/edit";
    const wrapper = createWrapper();
    expect(wrapper.find(".nav-bar").exists()).toBe(false);
  });

  it("shows nav bar on non-edit routes", () => {
    const wrapper = createWrapper();
    expect(wrapper.find(".nav-bar").exists()).toBe(true);
  });

  it("cycles theme on toggle click", async () => {
    mockStore.theme = "light";
    const wrapper = createWrapper();
    await nextTick();
    const toggle = wrapper.find(".theme-toggle");
    await toggle.trigger("click");
    expect(mockStore.theme).toBe("dark");
  });

  it("theme cycles from dark to system", async () => {
    mockStore.theme = "dark";
    const wrapper = createWrapper();
    await nextTick();
    await wrapper.find(".theme-toggle").trigger("click");
    expect(mockStore.theme).toBe("system");
  });

  it("theme cycles from system to light", async () => {
    mockStore.theme = "system";
    const wrapper = createWrapper();
    await nextTick();
    await wrapper.find(".theme-toggle").trigger("click");
    expect(mockStore.theme).toBe("light");
  });

  it("loads config on mount when config is null", async () => {
    mockStore.config = null;
    createWrapper();
    await new Promise((r) => setTimeout(r, 10));
    await nextTick();
    expect(mockTauri.loadConfig).toHaveBeenCalled();
  });

  it("does NOT load config on mount when config exists", async () => {
    mockStore.config = {} as any;
    createWrapper();
    await new Promise((r) => setTimeout(r, 10));
    await nextTick();
    expect(mockTauri.loadConfig).not.toHaveBeenCalled();
  });

  it("handles config load failure by resetting", async () => {
    mockStore.config = null;
    mockTauri.loadConfig.mockRejectedValue(new Error("load failed"));
    createWrapper();
    await new Promise((r) => setTimeout(r, 10));
    await nextTick();
    expect(mockTauri.resetConfig).toHaveBeenCalled();
    expect(mockShowAlert).toHaveBeenCalledWith("app.config.load_failed", {
      title: "app.config.config_reset",
      tone: "warning",
    });
  });

  it("loads plugins when not initialized", async () => {
    mockStore.pluginsInitialized = false;
    createWrapper();
    await new Promise((r) => setTimeout(r, 10));
    await nextTick();
    expect(mockStore.loadPlugins).toHaveBeenCalled();
  });

  it("does NOT load plugins when already initialized", async () => {
    mockStore.pluginsInitialized = true;
    createWrapper();
    await new Promise((r) => setTimeout(r, 10));
    await nextTick();
    expect(mockStore.loadPlugins).not.toHaveBeenCalled();
  });

  it("handleMinimize calls appWindow.minimize", async () => {
    createWrapper();
    const minimizeBtn = document.querySelector(
        '.win-btn[title="app.window.minimize"]',
    ) as HTMLElement;
    expect(minimizeBtn).not.toBeNull();
    minimizeBtn!.click();
    expect(mockWindow.minimize).toHaveBeenCalled();
  });

  it("handleMaximize calls appWindow.toggleMaximize", async () => {
    createWrapper();
    const maxBtn = document.querySelector(
        '.win-btn[title="app.window.maximize"]',
    ) as HTMLElement;
    expect(maxBtn).not.toBeNull();
    maxBtn!.click();
    expect(mockWindow.toggleMaximize).toHaveBeenCalled();
  });

  it("handleClose calls appWindow.close", async () => {
    createWrapper();
    const closeBtn = document.querySelector(
        '.win-btn[title="app.window.close"]',
    ) as HTMLElement;
    expect(closeBtn).not.toBeNull();
    closeBtn!.click();
    expect(mockWindow.close).toHaveBeenCalled();
  });
});
