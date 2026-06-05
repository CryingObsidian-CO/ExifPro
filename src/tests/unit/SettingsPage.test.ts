import { describe, it, expect, beforeEach, vi } from "vitest";
import { mount } from "@vue/test-utils";
import { nextTick } from "vue";

const mockTauri = vi.hoisted(() => ({
  loadConfig: vi.fn(),
  saveConfig: vi.fn(),
  resetConfig: vi.fn(),
}));

const mockShowAlert = vi.hoisted(() => vi.fn());
const mockShowConfirm = vi.hoisted(() => vi.fn());

const mockSetLocale = vi.hoisted(() => vi.fn());
const mockGetCurrentLocale = vi.hoisted(() => vi.fn(() => "en"));

interface MockPlugin {
  manifest: {
    id: string;
    name?: string;
    version?: string;
    description?: string;
    author?: string;
    capabilities?: Record<string, any>;
    config_schema?: Record<string, any>;
  };
  enabled: boolean;
  builtin: boolean;
  zip_path: string;
}

const mockStore = vi.hoisted(() => {
  let _plugins: MockPlugin[] = [];
  return {
    config: null as any,
    theme: "system" as string,
    pluginsInitialized: false,
    get plugins() { return _plugins; },
    set plugins(v: MockPlugin[]) { _plugins = v; },
    loadPlugins: vi.fn(),
    syncPluginsEnabled: vi.fn(),
  };
});

vi.mock("vue-router", () => ({ onBeforeRouteLeave: vi.fn() }));
vi.mock("../../composables/tauri", () => ({ useTauri: () => mockTauri }));
vi.mock("../../composables/dialog", () => ({
  useDialog: () => ({ showAlert: mockShowAlert, showConfirm: mockShowConfirm }),
}));
vi.mock("../../i18n", () => ({
  setLocale: mockSetLocale,
  getCurrentLocale: mockGetCurrentLocale,
}));
vi.mock("vue-i18n", () => ({ useI18n: () => ({ t: (key: string) => key }) }));
vi.mock("../../store/store", () => ({ store: mockStore }));

import SettingsPage from "../../pages/SettingsPage.vue";

const defaultConfig = {
  preview_max_mb: 8,
  sub_second_digits: 3,
  aeb_settings: {
    max_span: 0,
    min_consecutive_interval: 0,
    max_consecutive_interval: 0,
    min_count: 0,
    auto_bracket_only: false,
  },
  focus_bracket_settings: {
    enabled: false,
    max_span: 0,
    min_consecutive_interval: 0,
    max_consecutive_interval: 0,
    min_count: 0,
  },
  burst_settings: {
    min_consecutive_interval: 0,
    max_consecutive_interval: 0,
    min_count: 0,
  },
  naming_rules: {
    focus_bracketing_prefix: "",
    aeb_prefix: "",
    burst_prefix: "",
    single_prefix: "",
  },
  plugin_settings: {},
  enabled_plugins: [],
};

describe("SettingsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStore.config = { ...defaultConfig };
    mockStore.theme = "system";
    mockStore.pluginsInitialized = false;
    mockStore.plugins = [];
    mockTauri.loadConfig.mockResolvedValue({ ...defaultConfig });
    mockTauri.saveConfig.mockResolvedValue(undefined);
    mockTauri.resetConfig.mockResolvedValue({ ...defaultConfig });
    mockGetCurrentLocale.mockReturnValue("en");
  });

  function createWrapper() {
    return mount(SettingsPage, {
      global: {
        stubs: {
          IconSun: true,
          IconMoon: true,
          IconMonitor: true,
        },
      },
    });
  }

  it("renders title and subtitle", () => {
    const wrapper = createWrapper();
    expect(wrapper.text()).toContain("settings.title");
    expect(wrapper.text()).toContain("settings.subtitle");
  });

  it("loads config on mount when store.config is null", async () => {
    mockStore.config = null;
    createWrapper();
    await new Promise((r) => setTimeout(r, 10));
    await nextTick();
    expect(mockTauri.loadConfig).toHaveBeenCalled();
  });

  it("does not load config on mount when store.config exists", async () => {
    createWrapper();
    await new Promise((r) => setTimeout(r, 10));
    await nextTick();
    expect(mockTauri.loadConfig).not.toHaveBeenCalled();
  });

  it("sets theme via setTheme", async () => {
    const wrapper = createWrapper();
    mockStore.theme = "light";
    await nextTick();
    const themeBtns = wrapper.findAll(".theme-option");
    expect(themeBtns.length).toBeGreaterThanOrEqual(3);
  });

  it("saveSettings calls saveConfig and shows success", async () => {
    mockStore.config = { ...defaultConfig };
    const wrapper = createWrapper();
    await nextTick();
    const saveBtn = wrapper.find(".action-buttons .variant-primary");
    expect(saveBtn.exists()).toBe(true);
    await saveBtn.trigger("click");
    await new Promise((r) => setTimeout(r, 10));
    await nextTick();
    expect(mockTauri.saveConfig).toHaveBeenCalled();
  });

  it("saveSettings handles save error", async () => {
    mockTauri.saveConfig.mockRejectedValue(new Error("save failed"));
    mockStore.config = { ...defaultConfig };
    const wrapper = createWrapper();
    await nextTick();
    const saveBtn = wrapper.find(".action-buttons .variant-primary");
    await saveBtn.trigger("click");
    await new Promise((r) => setTimeout(r, 10));
    await nextTick();
    expect(mockShowAlert).toHaveBeenCalledWith("settings.save_failed", {
      title: "settings.save_failed_title",
      tone: "error",
    });
  });

  it("resetSettings calls resetConfig and shows success", async () => {
    const wrapper = createWrapper();
    await nextTick();
    const resetBtn = wrapper.find(".action-buttons .variant-danger");
    expect(resetBtn.exists()).toBe(true);
    await resetBtn.trigger("click");
    await new Promise((r) => setTimeout(r, 10));
    await nextTick();
    expect(mockTauri.resetConfig).toHaveBeenCalled();
  });

  it("resetSettings handles reset error", async () => {
    mockTauri.resetConfig.mockRejectedValue(new Error("reset failed"));
    const wrapper = createWrapper();
    await nextTick();
    const resetBtn = wrapper.find(".action-buttons .variant-danger");
    await resetBtn.trigger("click");
    await new Promise((r) => setTimeout(r, 10));
    await nextTick();
    expect(mockShowAlert).toHaveBeenCalledWith("settings.reset_failed", {
      title: "settings.reset_failed_title",
      tone: "error",
    });
  });

  it("shows load plugins button when not initialized", () => {
    const wrapper = createWrapper();
    expect(wrapper.text()).toContain("settings.load_plugins");
  });

  it("shows no plugins message when initialized but empty", async () => {
    mockStore.pluginsInitialized = true;
    mockStore.plugins = [];
    const wrapper = createWrapper();
    await nextTick();
    expect(wrapper.text()).toContain("settings.no_plugins");
  });

  it("shows plugin list when plugins exist", async () => {
    mockStore.pluginsInitialized = true;
    mockStore.plugins = [
      {
        manifest: {
          id: "test-plugin",
          name: "Test Plugin",
          version: "1.0.0",
          capabilities: {},
        },
        enabled: true,
        builtin: false,
        zip_path: "/test.zip",
      },
    ];
    const wrapper = createWrapper();
    await nextTick();
    expect(wrapper.text()).toContain("test-plugin");
  });

  it("reloadConfig fallback resets on failure", async () => {
    mockStore.config = null;
    mockTauri.loadConfig.mockRejectedValue(new Error("load failed"));
    createWrapper();
    await new Promise((r) => setTimeout(r, 10));
    await nextTick();
    expect(mockTauri.resetConfig).toHaveBeenCalled();
  });
});
