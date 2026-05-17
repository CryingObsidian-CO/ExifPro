import {invoke} from "@tauri-apps/api/core";

type FrontendLogLevel = "error" | "warn" | "info" | "debug" | "trace";

let initialized = false;

function safeStringify(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }
  if (value instanceof Error) {
    return value.stack ?? value.message;
  }
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

export function formatError(value: unknown): string {
  return safeStringify(value);
}

function formatArgs(args: unknown[]): string {
  return args.map((arg) => safeStringify(arg)).join(" ");
}

async function sendLog(level: FrontendLogLevel, message: string, target?: string) {
  try {
    await invoke("frontend_log_command", {
      level,
      message,
      target,
    });
  } catch {
    // 日志失败不处理
  }
}

export function initFrontendLogger() {
  if (initialized) {
    return;
  }
  const original = {
    error: console.error,
    warn: console.warn,
    info: console.info,
    log: console.log,
    debug: console.debug,
    trace: console.trace,
  };

  console.error = (...args: unknown[]) => {
    original.error(...args);
    void sendLog("error", formatArgs(args));
  };
  console.warn = (...args: unknown[]) => {
    original.warn(...args);
    void sendLog("warn", formatArgs(args));
  };
  console.info = (...args: unknown[]) => {
    original.info(...args);
    void sendLog("info", formatArgs(args));
  };
  console.log = (...args: unknown[]) => {
    original.log(...args);
    void sendLog("info", formatArgs(args));
  };
  console.debug = (...args: unknown[]) => {
    original.debug(...args);
    void sendLog("debug", formatArgs(args));
  };
  console.trace = (...args: unknown[]) => {
    original.trace(...args);
    void sendLog("trace", formatArgs(args));
  };

  window.addEventListener("error", (event) => {
    void sendLog(
        "error",
        `window.error message=${event.message} filename=${event.filename} lineno=${event.lineno} colno=${event.colno}`
    );
  });

  window.addEventListener("unhandledrejection", (event) => {
    void sendLog("error", `unhandledrejection reason=${safeStringify(event.reason)}`);
  });

  initialized = true;
}
