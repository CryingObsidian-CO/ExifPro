import {describe, it, expect, beforeEach} from "vitest";
import {PluginAPIContext} from "../../types/plugin";

describe("PluginAPIContext", () => {
  let ctx: PluginAPIContext;

  beforeEach(() => {
    ctx = new PluginAPIContext("test-plugin", {key: "initial"});
  });

  it("stores the plugin id", () => {
    expect(ctx.id).toBe("test-plugin");
  });

  it("getConfig returns the initial config", () => {
    expect(ctx.getConfig()).toEqual({key: "initial"});
  });

  it("updateConfig replaces the config entirely", () => {
    ctx.updateConfig({key: "updated", extra: true});
    expect(ctx.getConfig()).toEqual({key: "updated", extra: true});
  });

  it("getConfig returns a reference (mutable by caller)", () => {
    const cfg = ctx.getConfig();
    cfg.key = "mutated";
    expect(ctx.getConfig().key).toBe("mutated");
  });
});
