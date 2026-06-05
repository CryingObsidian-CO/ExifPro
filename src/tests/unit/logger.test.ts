import {describe, it, expect, beforeEach, afterEach, vi} from "vitest";

const {mockInvoke} = vi.hoisted(() => ({mockInvoke: vi.fn()}));
vi.mock("@tauri-apps/api/core", () => ({invoke: mockInvoke}));

import {formatError, initFrontendLogger} from "../../composables/logger";

describe("formatError", () => {
  it("returns the string unchanged", () => {
    expect(formatError("plain message")).toBe("plain message");
  });

  it("returns error stack when available", () => {
    const err = new Error("boom");
    const result = formatError(err);
    expect(result).toContain("boom");
    expect(result).toContain("Error");
  });

  it("returns error message when no stack", () => {
    const err = {message: "no stack"} as Error;
    expect(formatError(err)).toBe('{"message":"no stack"}');
  });

  it("JSON-stringifies plain objects", () => {
    expect(formatError({a: 1})).toBe('{"a":1}');
  });

  it("falls back to String() for unserializable values", () => {
    const circular: any = {};
    circular.self = circular;
    expect(formatError(circular)).toBe("[object Object]");
  });
});

describe("initFrontendLogger", () => {
  beforeEach(() => {
    mockInvoke.mockReset();
  });

  it("is idempotent (early return when already initialized)", () => {
    initFrontendLogger();
    mockInvoke.mockClear();
    initFrontendLogger();
    expect(mockInvoke).not.toHaveBeenCalled();
  });

  it("patches console methods and sends logs to invoke", async () => {
    initFrontendLogger();
    console.error("test error");
    await new Promise((r) => setTimeout(r, 10));

    const calls = mockInvoke.mock.calls.filter(
        (c: any[]) => c[0] === "frontend_log_command"
    );
    expect(calls.length).toBeGreaterThanOrEqual(1);

    const errorCall = calls.find((c: any[]) => c[1]?.level === "error");
    expect(errorCall).toBeDefined();
    expect(errorCall![1].message).toContain("test error");
  });

  it("does not throw when invoke fails", async () => {
    mockInvoke.mockRejectedValue(new Error("tauri unavailable"));
    initFrontendLogger();
    expect(() => console.warn("warn msg")).not.toThrow();
    await new Promise((r) => setTimeout(r, 10));
  });

  it("sends debug logs via invoke", async () => {
    initFrontendLogger();
    console.debug("debug msg");
    await new Promise((r) => setTimeout(r, 10));

    const debugCall = mockInvoke.mock.calls.find(
        (c: any[]) => c[0] === "frontend_log_command" && c[1]?.level === "debug"
    );
    expect(debugCall).toBeDefined();
    expect(debugCall![1].message).toContain("debug msg");
  });

  it("sends trace logs via invoke", async () => {
    initFrontendLogger();
    console.trace("trace msg");
    await new Promise((r) => setTimeout(r, 10));

    const traceCall = mockInvoke.mock.calls.find(
        (c: any[]) => c[0] === "frontend_log_command" && c[1]?.level === "trace"
    );
    expect(traceCall).toBeDefined();
    expect(traceCall![1].message).toContain("trace msg");
  });
});

describe("initFrontendLogger window events", () => {
  beforeEach(() => {
    mockInvoke.mockReset();
  });

  afterEach(() => {
    // remove event listeners added by initFrontendLogger
    // this is a best-effort cleanup since we can't remove specific listeners easily
  });

  it("listens to window error events", async () => {
    initFrontendLogger();
    mockInvoke.mockClear();

    window.dispatchEvent(new ErrorEvent("error", {
      message: "test error",
      filename: "test.js",
      lineno: 10,
      colno: 5,
    }));
    await new Promise((r) => setTimeout(r, 10));

    const errorCall = mockInvoke.mock.calls.find(
        (c: any[]) => c[0] === "frontend_log_command" && c[1]?.level === "error"
    );
    expect(errorCall).toBeDefined();
    expect(errorCall![1].message).toContain("test error");
    expect(errorCall![1].message).toContain("test.js");
  });

  it("listens to unhandledrejection events", async () => {
    initFrontendLogger();
    mockInvoke.mockClear();

    const _promise = new Promise(() => {});
    window.dispatchEvent(new PromiseRejectionEvent("unhandledrejection", {
      promise: _promise,
      reason: new Error("async failure"),
    }));
    await new Promise((r) => setTimeout(r, 10));

    const rejectionCall = mockInvoke.mock.calls.find(
        (c: any[]) => c[0] === "frontend_log_command" && c[1]?.level === "error"
    );
    expect(rejectionCall).toBeDefined();
    expect(rejectionCall![1].message).toContain("async failure");
  });
});
