import {reactive, readonly} from "vue";
import i18n from "../i18n";

export type DialogTone = "info" | "success" | "warning" | "error";
export type DialogMode = "alert" | "confirm";

export interface DialogOptions {
  title?: string;
  tone?: DialogTone;
  confirmText?: string;
  cancelText?: string;
  closeOnOverlay?: boolean;
}

interface DialogState {
  visible: boolean;
  mode: DialogMode;
  title: string;
  message: string;
  tone: DialogTone;
  confirmText: string;
  cancelText: string;
  closeOnOverlay: boolean;
}

const {t} = i18n.global;

const dialogState = reactive<DialogState>({
  visible: false,
  mode: "alert",
  title: t('common.tip'),
  message: "",
  tone: "info",
  confirmText: t('common.confirm'),
  cancelText: t('common.cancel'),
  closeOnOverlay: true,
});

let resolver: ((value: boolean) => void) | null = null;

function resolveDialog(value: boolean) {
  if (resolver) {
    resolver(value);
  }
  resolver = null;
  dialogState.visible = false;
}

function openDialog(mode: DialogMode, message: string, options?: DialogOptions): Promise<boolean> {
  if (dialogState.visible) {
    resolveDialog(false);
  }

  dialogState.mode = mode;
  dialogState.message = message;
  dialogState.tone = options?.tone || "info";
  dialogState.title = options?.title || (mode === "confirm" ? t('common.please_confirm') : t('common.tip'));
  dialogState.confirmText = options?.confirmText || t('common.confirm');
  dialogState.cancelText = options?.cancelText || t('common.cancel');
  dialogState.closeOnOverlay = options?.closeOnOverlay ?? mode === "alert";
  dialogState.visible = true;

  return new Promise<boolean>((resolve) => {
    resolver = resolve;
  });
}

export function useDialog() {
  async function showAlert(message: string, options?: DialogOptions): Promise<void> {
    await openDialog("alert", message, options);
    return undefined;
  }

  function showConfirm(message: string, options?: DialogOptions): Promise<boolean> {
    return openDialog("confirm", message, options);
  }

  return {
    showAlert,
    showConfirm,
  };
}

export function useDialogState() {
  function confirmDialog() {
    resolveDialog(true);
  }

  function cancelDialog() {
    resolveDialog(false);
  }

  function closeByOverlay() {
    if (!dialogState.closeOnOverlay) {
      return;
    }
    resolveDialog(dialogState.mode === "alert");
  }

  return {
    dialogState: readonly(dialogState),
    confirmDialog,
    cancelDialog,
    closeByOverlay,
  };
}

