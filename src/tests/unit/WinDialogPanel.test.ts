import {describe, it, expect, afterEach, vi} from "vitest";
import {mount, VueWrapper} from "@vue/test-utils";
import {nextTick} from "vue";
import WinDialogPanel from "../../component/WinDialogPanel.vue";

describe("WinDialogPanel", () => {
  let wrapper: VueWrapper | null = null;

  afterEach(() => {
    if (wrapper) {
      wrapper.unmount();
      wrapper = null;
    }
  });

  function mountPanel(props: Record<string, any> = {}) {
    wrapper = mount(WinDialogPanel, {
      props: {
        visible: false,
        title: "Dialog Title",
        ...props,
      },
      slots: {
        default: "Content goes here",
      },
    });
    return wrapper;
  }

  it("does not render when visible is false", () => {
    mountPanel();
    expect(document.body.querySelector(".win-dialog-overlay")).toBeNull();
  });

  it("renders when visible is true", async () => {
    mountPanel({visible: true});
    await nextTick();
    expect(document.body.querySelector(".win-dialog-overlay")).not.toBeNull();
    expect(document.body.querySelector(".win-dialog-panel")).not.toBeNull();
  });

  it("hides when visible changes to false", async () => {
    mountPanel({visible: true});
    await nextTick();
    expect(document.body.querySelector(".win-dialog-overlay")).not.toBeNull();

    await wrapper!.setProps({visible: false});
    await nextTick();
    expect(document.body.querySelector(".win-dialog-overlay")).toBeNull();
  });

  it("shows the title", async () => {
    mountPanel({visible: true, title: "Custom Title"});
    await nextTick();
    const h3 = document.body.querySelector(".win-dialog-header h3");
    expect(h3).not.toBeNull();
    expect(h3!.textContent).toBe("Custom Title");
  });

  it("renders default slot content", async () => {
    wrapper = mount(WinDialogPanel, {
      props: {visible: true, title: "Test"},
      slots: {default: "Slot content"},
    });
    await nextTick();
    const body = document.body.querySelector(".win-dialog-body");
    expect(body).not.toBeNull();
    expect(body!.textContent).toContain("Slot content");
  });

  it("renders actions slot when provided", async () => {
    wrapper = mount(WinDialogPanel, {
      props: {visible: true, title: "Test"},
      slots: {
        default: "Content",
        actions: '<button class="custom-btn">OK</button>',
      },
    });
    await nextTick();
    const actions = document.body.querySelector(".win-dialog-actions");
    expect(actions).not.toBeNull();
    expect(actions!.querySelector(".custom-btn")).not.toBeNull();
  });

  it("does not render actions div when slot is empty", async () => {
    mountPanel({visible: true});
    await nextTick();
    expect(document.body.querySelector(".win-dialog-actions")).toBeNull();
  });

  it("emits close when close button is clicked", async () => {
    mountPanel({visible: true});
    await nextTick();
    const closeBtn = document.body.querySelector(".win-dialog-header .win-button");
    expect(closeBtn).not.toBeNull();
    (closeBtn as HTMLElement).click();
    await nextTick();
    expect(wrapper!.emitted("close")).toBeTruthy();
  });

  it("emits close on overlay click", async () => {
    mountPanel({visible: true});
    await nextTick();
    const overlay = document.body.querySelector(".win-dialog-overlay") as HTMLElement;
    expect(overlay).not.toBeNull();
    overlay.click();
    await nextTick();
    expect(wrapper!.emitted("close")).toBeTruthy();
  });

  it("emits close on Escape key", async () => {
    mountPanel({visible: true});
    await nextTick();
    const panel = document.body.querySelector(".win-dialog-panel") as HTMLElement;
    expect(panel).not.toBeNull();
    panel.dispatchEvent(new KeyboardEvent("keydown", {key: "Escape"}));
    await nextTick();
    expect(wrapper!.emitted("close")).toBeTruthy();
  });

  it("has correct role and aria attributes", async () => {
    mountPanel({visible: true});
    await nextTick();
    const panel = document.body.querySelector(".win-dialog-panel");
    expect(panel).not.toBeNull();
    expect(panel!.getAttribute("role")).toBe("dialog");
    expect(panel!.getAttribute("aria-modal")).toBe("true");
  });

  it("renders multiple buttons inside the dialog body", async () => {
    wrapper = mount(WinDialogPanel, {
      props: {visible: true, title: "Test"},
      slots: {
        default: '<button class="first-btn">First</button><button class="last-btn">Last</button>',
      },
    });
    await nextTick();
    await nextTick();

    const lastBtn = document.body.querySelector(".last-btn");
    expect(lastBtn).not.toBeNull();
    const firstBtn = document.body.querySelector(".first-btn");
    expect(firstBtn).not.toBeNull();
  });

  it("renders dialog body with text when no buttons", async () => {
    wrapper = mount(WinDialogPanel, {
      props: {visible: true, title: "No buttons"},
      slots: {default: "<p>Just text</p>"},
    });
    await nextTick();
    await nextTick();

    const body = document.body.querySelector(".win-dialog-body");
    expect(body).not.toBeNull();
    expect(body!.textContent).toContain("Just text");
  });

  it("panel is focusable (tabindex=-1)", async () => {
    mountPanel({visible: true});
    await nextTick();
    const panel = document.body.querySelector(".win-dialog-panel");
    expect(panel?.getAttribute("tabindex")).toBe("-1");
  });

  it("close button has icon (IconClose rendered)", async () => {
    mountPanel({visible: true});
    await nextTick();
    const closeBtn = document.body.querySelector(".win-dialog-header .win-button");
    expect(closeBtn).not.toBeNull();
    expect(closeBtn!.querySelector("svg")).not.toBeNull();
  });

  it("does not render when visible is false even with default slot", async () => {
    mountPanel({visible: false});
    await nextTick();
    expect(document.body.querySelector(".win-dialog-overlay")).toBeNull();
  });

  it("Tab from last focusable wraps to first", async () => {
    wrapper = mount(WinDialogPanel, {
      props: {visible: true, title: "Test"},
      slots: {
        default: '<button class="first-btn">First</button><button class="mid-btn">Mid</button><button class="last-btn">Last</button>',
      },
    });
    await nextTick();
    await nextTick();

    const buttons = document.body.querySelectorAll<HTMLElement>(".first-btn, .mid-btn, .last-btn");
    buttons.forEach((el) => Object.defineProperty(el, "offsetParent", {value: document.body}));

    const lastBtn = document.body.querySelector(".last-btn") as HTMLElement;
    const firstBtn = document.body.querySelector(".first-btn") as HTMLElement;
    lastBtn.focus();

    const panel = document.body.querySelector(".win-dialog-panel") as HTMLElement;
    panel.dispatchEvent(new KeyboardEvent("keydown", {key: "Tab", bubbles: true}));

    expect(document.activeElement).toBe(firstBtn);
  });

  it("Shift+Tab from first focusable wraps to last", async () => {
    wrapper = mount(WinDialogPanel, {
      props: {visible: true, title: "Test"},
      slots: {
        default: '<button class="first-btn">First</button><button class="last-btn">Last</button>',
      },
    });
    await nextTick();
    await nextTick();

    const buttons = document.body.querySelectorAll<HTMLElement>(".first-btn, .last-btn");
    buttons.forEach((el) => Object.defineProperty(el, "offsetParent", {value: document.body}));

    const firstBtn = document.body.querySelector(".first-btn") as HTMLElement;
    const lastBtn = document.body.querySelector(".last-btn") as HTMLElement;
    firstBtn.focus();

    const panel = document.body.querySelector(".win-dialog-panel") as HTMLElement;
    panel.dispatchEvent(new KeyboardEvent("keydown", {key: "Tab", shiftKey: true, bubbles: true}));

    expect(document.activeElement).toBe(lastBtn);
  });

  it("restores focus to previously focused element on close", async () => {
    document.body.innerHTML = "";
    const outsideBtn = document.createElement("button");
    outsideBtn.className = "outside-btn";
    outsideBtn.textContent = "Outside";
    document.body.appendChild(outsideBtn);
    outsideBtn.focus();

    wrapper = mount(WinDialogPanel, {
      props: {visible: true, title: "Test"},
      slots: {default: "<p>Content</p>"},
      attachTo: document.body,
    });
    await nextTick();
    await nextTick();

    await wrapper.setProps({visible: false});
    await nextTick();

    expect(document.activeElement).toBe(outsideBtn);
    document.body.removeChild(outsideBtn);
  });
});
