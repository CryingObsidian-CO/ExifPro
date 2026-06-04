import {describe, it, expect, beforeAll, beforeEach} from "vitest";
import {useDialog, useDialogState} from "../../composables/dialog";
import i18n from "../../i18n";

beforeAll(() => {
  i18n.global.locale.value = "zh";
});

beforeEach(async () => {
  const {dialogState, cancelDialog, closeByOverlay} = useDialogState();
  if (dialogState.visible) {
    if (dialogState.closeOnOverlay) {
      closeByOverlay();
    } else {
      cancelDialog();
    }
  }
});

describe("useDialog – showAlert", () => {
  it("resolves after confirm is called", async () => {
    const {showAlert} = useDialog();
    const {dialogState, confirmDialog} = useDialogState();

    const promise = showAlert("Something happened");
    await Promise.resolve();

    expect(dialogState.visible).toBe(true);
    expect(dialogState.mode).toBe("alert");
    expect(dialogState.message).toBe("Something happened");

    confirmDialog();
    await expect(promise).resolves.toBeUndefined();
    expect(dialogState.visible).toBe(false);
  });

  it("uses default tone=info and title=提示", async () => {
    const {showAlert} = useDialog();
    const {dialogState} = useDialogState();

    const promise = showAlert("msg");
    await Promise.resolve();

    expect(dialogState.tone).toBe("info");
    expect(dialogState.title).toBe("提示");
    expect(dialogState.confirmText).toBe("确定");

    const {confirmDialog} = useDialogState();
    confirmDialog();
    await promise;
  });

  it("accepts custom options (title, tone, confirmText)", async () => {
    const {showAlert} = useDialog();
    const {dialogState} = useDialogState();

    const promise = showAlert("done", {
      title: "完成",
      tone: "success",
      confirmText: "好的",
    });
    await Promise.resolve();

    expect(dialogState.title).toBe("完成");
    expect(dialogState.tone).toBe("success");
    expect(dialogState.confirmText).toBe("好的");
    expect(dialogState.mode).toBe("alert");

    const {confirmDialog} = useDialogState();
    confirmDialog();
    await promise;
  });

  it("overlay click closes alert by default", async () => {
    const {showAlert} = useDialog();
    const {dialogState, closeByOverlay} = useDialogState();

    const promise = showAlert("msg");
    await Promise.resolve();

    expect(dialogState.closeOnOverlay).toBe(true);
    closeByOverlay();
    await expect(promise).resolves.toBeUndefined();
    expect(dialogState.visible).toBe(false);
  });

  it("overlay click does NOT close alert when closeOnOverlay=false", async () => {
    const {showAlert} = useDialog();
    const {dialogState, closeByOverlay} = useDialogState();

    const promise = showAlert("msg", {closeOnOverlay: false});
    await Promise.resolve();

    expect(dialogState.closeOnOverlay).toBe(false);
    closeByOverlay();
    expect(dialogState.visible).toBe(true);

    const {confirmDialog} = useDialogState();
    confirmDialog();
    await promise;
  });
});

describe("useDialog – showConfirm", () => {
  it("resolves true on confirm", async () => {
    const {showConfirm} = useDialog();
    const {dialogState, confirmDialog} = useDialogState();

    const promise = showConfirm("Are you sure?");
    await Promise.resolve();

    expect(dialogState.mode).toBe("confirm");
    expect(dialogState.title).toBe("请确认");

    confirmDialog();
    const result = await promise;
    expect(result).toBe(true);
  });

  it("resolves false on cancel", async () => {
    const {showConfirm} = useDialog();
    const {cancelDialog} = useDialogState();

    const promise = showConfirm("Proceed?");
    await Promise.resolve();

    cancelDialog();
    const result = await promise;
    expect(result).toBe(false);
  });

  it("resolves false on overlay click when closeOnOverlay is true", async () => {
    const {showConfirm} = useDialog();
    const {dialogState, closeByOverlay} = useDialogState();

    const promise = showConfirm("Proceed?", {closeOnOverlay: true});
    await Promise.resolve();

    expect(dialogState.closeOnOverlay).toBe(true);
    closeByOverlay();
    const result = await promise;
    expect(result).toBe(false);
    expect(dialogState.visible).toBe(false);
  });

  it("accepts custom cancelText", async () => {
    const {showConfirm} = useDialog();
    const {dialogState} = useDialogState();

    const promise = showConfirm("Delete?", {cancelText: "No"});
    await Promise.resolve();

    expect(dialogState.cancelText).toBe("No");

    const {cancelDialog} = useDialogState();
    cancelDialog();
    await promise;
  });
});

describe("useDialog – overlapping calls", () => {
  it("a new dialog dismisses the previous one with false", async () => {
    const {showConfirm} = useDialog();

    const first = showConfirm("First");
    await Promise.resolve();

    const second = showConfirm("Second");
    await Promise.resolve();

    const firstResult = await first;
    expect(firstResult).toBe(false);
    expect(useDialogState().dialogState.message).toBe("Second");

    const {confirmDialog} = useDialogState();
    confirmDialog();
    await second;
  });
});
