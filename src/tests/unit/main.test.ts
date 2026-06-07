import { describe, it, expect, vi, beforeAll } from "vitest";

const mockCreateApp = vi.hoisted(() => {
  const app = { use: vi.fn().mockReturnThis(), mount: vi.fn() };
  return vi.fn(() => app);
});

const mockInitFrontendLogger = vi.hoisted(() => vi.fn());

vi.mock("vue", () => ({ createApp: mockCreateApp }));
vi.mock("../../App.vue", () => ({ default: {} }));
vi.mock("../../router", () => ({ default: {} }));
vi.mock("../../i18n", () => ({ default: { global: { locale: { value: "en" } } } }));
vi.mock("../../composables/logger", () => ({ initFrontendLogger: mockInitFrontendLogger }));

describe("main.ts", () => {
  beforeAll(async () => {
    await import("../../main");
  });

  it("calls initFrontendLogger", () => {
    expect(mockInitFrontendLogger).toHaveBeenCalled();
  });

  it("overrides window.confirm", () => {
    expect(typeof window.confirm).toBe("function");
    expect(() => (window.confirm as any)()).toThrow();
  });

  it("creates Vue app with App component", () => {
    expect(mockCreateApp).toHaveBeenCalled();
    const app = mockCreateApp.mock.results[0]?.value;
    expect(app).toBeTruthy();
  });

  it("installs router and i18n plugins", () => {
    const app = mockCreateApp.mock.results[0]?.value;
    expect(app.use).toHaveBeenCalledTimes(2);
  });

  it("mounts the app to #app", () => {
    const app = mockCreateApp.mock.results[0]?.value;
    expect(app.mount).toHaveBeenCalledWith("#app");
  });
});
