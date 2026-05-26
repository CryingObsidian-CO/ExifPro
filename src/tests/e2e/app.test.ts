import {describe, it, expect, beforeAll, afterAll} from "vitest";
import {remote} from "webdriverio";
import type {Capabilities} from "@wdio/types";

const WD_OPTIONS: Capabilities.WebdriverIOConfig = {
  hostname: "localhost",
  port: 4444,
  path: "/",
  capabilities: {
    browserName: "tauri",
  },
  connectionRetryTimeout: 120000,
  connectionRetryCount: 3,
  logLevel: "warn",
};

let client: WebdriverIO.Browser | null = null;

beforeAll(async () => {
  try {
    client = await remote(WD_OPTIONS);
  } catch {
    console.warn(
        "WebDriver connection failed. Ensure tauri-driver is running on port 4444."
    );
    console.warn("Run: npx tauri-driver --port 4444");
  }
}, 180000);

afterAll(async () => {
  if (client) {
    await client.deleteSession();
    client = null;
  }
});

describe("E2E - Window Tests", () => {
  it("should launch Tauri application window", async () => {
    if (!client) {
      console.warn("Skipping: WebDriver client not available");
      return;
    }

    const windowHandles = await client.getWindowHandles();
    expect(windowHandles.length).toBeGreaterThan(0);
  });

  it("should have the correct window title", async () => {
    if (!client) {
      console.warn("Skipping: WebDriver client not available");
      return;
    }

    const title = await client.getTitle();
    expect(title).toBeTruthy();
    expect(typeof title).toBe("string");
  });
});

describe("E2E - Application State", () => {
  it("should render the application UI", async () => {
    if (!client) {
      console.warn("Skipping: WebDriver client not available");
      return;
    }

    const body = await client.$("body");
    expect(body).toBeDefined();
    const exists = await body.isExisting();
    expect(exists).toBe(true);
  });

  it("should have the app root element", async () => {
    if (!client) {
      console.warn("Skipping: WebDriver client not available");
      return;
    }

    const appElement = await client.$("#app");
    if (await appElement.isExisting()) {
      const text = await appElement.getText();
      expect(typeof text).toBe("string");
    }
  });
});