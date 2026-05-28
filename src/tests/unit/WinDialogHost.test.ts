import {describe, it, expect, afterEach} from "vitest";
import {mount, VueWrapper} from "@vue/test-utils";
import {nextTick} from "vue";
import WinDialogHost from "../../component/WinDialogHost.vue";
import {useDialog, useDialogState} from "../../composables/dialog";

describe("WinDialogHost", () => {
  let wrapper: VueWrapper | null = null;

  afterEach(async () => {
    const {dialogState, cancelDialog, closeByOverlay} = useDialogState();
    if (dialogState.visible) {
      if (dialogState.closeOnOverlay) {
        closeByOverlay();
      } else {
        cancelDialog();
      }
    }
    await nextTick();

    if (wrapper) {
      wrapper.unmount();
      wrapper = null;
    }
  });

  function mountDialog() {
    wrapper = mount(WinDialogHost);
    return wrapper;
  }

  it("does not render when no dialog is open", () => {
    mountDialog();
    expect(document.body.querySelector(".dialog-overlay")).toBeNull();
  });

  it("renders the dialog panel when visible", async () => {
    mountDialog();
    const {showAlert} = useDialog();
    showAlert("Test message");
    await nextTick();

    expect(document.body.querySelector(".dialog-overlay")).not.toBeNull();
  });

  it("shows the message text", async () => {
    mountDialog();
    const {showAlert} = useDialog();
    showAlert("Hello World");
    await nextTick();

    const message = document.body.querySelector(".dialog-message");
    expect(message).not.toBeNull();
    expect(message!.textContent).toBe("Hello World");
  });

  it("shows the title", async () => {
    mountDialog();
    const {showAlert} = useDialog();
    showAlert("msg", {title: "Custom Title"});
    await nextTick();

    const h3 = document.body.querySelector(".dialog-header h3");
    expect(h3).not.toBeNull();
    expect(h3!.textContent).toBe("Custom Title");
  });

  it("shows tone icon", async () => {
    mountDialog();
    const {showAlert} = useDialog();

    showAlert("msg", {tone: "success"});
    await nextTick();
    let icon = document.body.querySelector(".dialog-icon.tone-success");
    expect(icon).not.toBeNull();
    expect(icon!.textContent).toBe("✓");
    useDialogState().confirmDialog();
    await nextTick();

    showAlert("msg", {tone: "error"});
    await nextTick();
    icon = document.body.querySelector(".dialog-icon.tone-error");
    expect(icon).not.toBeNull();
    expect(icon!.textContent).toBe("×");
    useDialogState().confirmDialog();
    await nextTick();

    showAlert("msg", {tone: "warning"});
    await nextTick();
    icon = document.body.querySelector(".dialog-icon.tone-warning");
    expect(icon).not.toBeNull();
    expect(icon!.textContent).toBe("!");
    useDialogState().confirmDialog();
    await nextTick();

    showAlert("msg", {tone: "info"});
    await nextTick();
    icon = document.body.querySelector(".dialog-icon.tone-info");
    expect(icon).not.toBeNull();
    expect(icon!.textContent).toBe("i");
  });

  it("renders confirm + cancel buttons in confirm mode", async () => {
    mountDialog();
    const {showConfirm} = useDialog();
    showConfirm("Proceed?");
    await nextTick();

    const buttons = document.body.querySelectorAll(".dialog-actions button");
    expect(buttons.length).toBe(2);
  });

  it("renders only confirm button in alert mode", async () => {
    mountDialog();
    const {showAlert} = useDialog();
    showAlert("FYI");
    await nextTick();

    const buttons = document.body.querySelectorAll(".dialog-actions button");
    expect(buttons.length).toBe(1);
  });

  it("hides after confirmDialog", async () => {
    mountDialog();
    const {showAlert} = useDialog();
    showAlert("msg");
    await nextTick();

    const {confirmDialog} = useDialogState();
    confirmDialog();
    await nextTick();

    expect(document.body.querySelector(".dialog-overlay")).toBeNull();
  });
});
