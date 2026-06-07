import { describe, it, expect, beforeEach, vi } from "vitest";
import { mount } from "@vue/test-utils";
import { nextTick } from "vue";

const mockSelectDirectory = vi.hoisted(() => vi.fn());
const mockShowAlert = vi.hoisted(() => vi.fn());

vi.mock("../../composables/tauri", () => ({
  useTauri: () => ({ selectDirectory: mockSelectDirectory }),
}));
vi.mock("../../composables/dialog", () => ({ useDialog: () => ({ showAlert: mockShowAlert }) }));
vi.mock("vue-i18n", () => ({ useI18n: () => ({ t: (key: string) => key }) }));

import SelectionPage from "../../pages/SelectionPage.vue";

describe("SelectionPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function createWrapper() {
    return mount(SelectionPage, {
      global: { stubs: { IconFolder: true, IconUpload: true } },
    });
  }

  it("renders title and subtitle", () => {
    const wrapper = createWrapper();
    expect(wrapper.text()).toContain("selection.title");
    expect(wrapper.text()).toContain("selection.subtitle");
  });

  it("selectDir sets the selection dir input", async () => {
    mockSelectDirectory.mockResolvedValue("/photos");
    const wrapper = createWrapper();
    const browseBtn = wrapper.find("button");
    await browseBtn.trigger("click");
    await nextTick();
    expect(mockSelectDirectory).toHaveBeenCalled();
    const input = wrapper.find("input");
    expect((input.element as HTMLInputElement).value).toBe("/photos");
  });

  it("selectDir handles cancellation", async () => {
    mockSelectDirectory.mockResolvedValue(null);
    const wrapper = createWrapper();
    await wrapper.find("button").trigger("click");
    await nextTick();
    const input = wrapper.find("input");
    expect((input.element as HTMLInputElement).value).toBe("");
  });

  it("start button is disabled when no selectionDir", () => {
    const wrapper = createWrapper();
    const primaryBtn = wrapper.find("button.variant-primary");
    expect(primaryBtn.attributes("disabled")).toBeDefined();
  });

  it("startSelection shows success alert on completion", async () => {
    const wrapper = createWrapper();
    const input = wrapper.find("input");
    await input.setValue("/photos");
    await nextTick();
    const primaryBtn = wrapper.find("button.variant-primary");
    await primaryBtn.trigger("click");
    await nextTick();
    await new Promise((r) => setTimeout(r, 10));
    await nextTick();
    expect(mockShowAlert).toHaveBeenCalledWith("selection.complete", {
      title: "selection.complete_title",
      tone: "success",
    });
  });

  it("includeSubdirs checkbox is rendered", () => {
    const wrapper = createWrapper();
    expect(wrapper.text()).toContain("selection.include_subdirs");
  });
});
