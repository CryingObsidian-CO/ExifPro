import {describe, it, expect, beforeEach, vi} from "vitest";

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
});
