import { describe, it, expect } from "vitest";
import router from "../../router/index";

describe("Router configuration", () => {
  it("exports a configured router with hash history", () => {
    expect(router).toBeDefined();
    expect(router.hasRoute("home")).toBe(true);
    expect(router.hasRoute("Edit")).toBe(true);
    expect(router.hasRoute("Settings")).toBe(true);
  });

  it("resolves home path to home route", () => {
    const resolved = router.resolve("/");
    expect(resolved.name).toBe("home");
  });

  it("resolves /edit to Edit route", () => {
    const resolved = router.resolve("/edit");
    expect(resolved.name).toBe("Edit");
  });

  it("resolves /settings to Settings route", () => {
    const resolved = router.resolve("/settings");
    expect(resolved.name).toBe("Settings");
  });

  it("all routes use lazy loading (component is a function)", () => {
    const routes = router.getRoutes();
    for (const route of routes) {
      expect(typeof route.components?.default).toBe("function");
    }
  });
});
