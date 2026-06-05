import {describe, it, expect} from "vitest";
import {builtinPlugins} from "../../composables/builtinPlugins";

describe("builtinPlugins", () => {
  it("is an object", () => {
    expect(typeof builtinPlugins).toBe("object");
    expect(builtinPlugins).not.toBeNull();
  });

  it("is currently empty", () => {
    expect(Object.keys(builtinPlugins)).toHaveLength(0);
  });

  it("can accept a new plugin entry", () => {
    const entry = {
      hooks: {
        onLoad() {},
        onParseExif: (exif: any[]) => exif,
      },
      getDefaultConfig: () => ({threshold: 0.5}),
    };
    try {
      (builtinPlugins as any)["test-plugin"] = entry;
      expect((builtinPlugins as any)["test-plugin"]).toBe(entry);
      expect((builtinPlugins as any)["test-plugin"].hooks.onParseExif).toBeDefined();
      expect((builtinPlugins as any)["test-plugin"].getDefaultConfig()).toEqual({threshold: 0.5});
    } finally {
      delete (builtinPlugins as any)["test-plugin"];
    }
  });
});
