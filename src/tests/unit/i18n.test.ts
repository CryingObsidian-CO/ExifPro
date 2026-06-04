import {describe, it, expect, beforeEach, afterEach} from "vitest";
import i18n, {setLocale, getCurrentLocale} from "../../i18n";

const STORAGE_KEY = "locale";

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  setLocale("en");
});

describe("i18n locale management", () => {
  it("default locale is 'en' when no localStorage and navigator is en-US", () => {
    expect(getCurrentLocale()).toBe("en");
  });

  it("setLocale changes the locale to zh", () => {
    setLocale("zh");
    expect(getCurrentLocale()).toBe("zh");
  });

  it("setLocale changes the locale to en", () => {
    setLocale("en");
    expect(getCurrentLocale()).toBe("en");
  });

  it("setLocale persists to localStorage", () => {
    setLocale("zh");
    expect(localStorage.getItem(STORAGE_KEY)).toBe("zh");

    setLocale("en");
    expect(localStorage.getItem(STORAGE_KEY)).toBe("en");
  });

  it("setLocale updates document lang attribute", () => {
    setLocale("zh");
    expect(document.documentElement.getAttribute("lang")).toBe("zh");

    setLocale("en");
    expect(document.documentElement.getAttribute("lang")).toBe("en");
  });
});

describe("i18n translations", () => {
  it("returns English translations when locale is en", () => {
    setLocale("en");
    expect(i18n.global.t("common.confirm")).toBe("Confirm");
    expect(i18n.global.t("common.cancel")).toBe("Cancel");
    expect(i18n.global.t("common.tip")).toBe("Tip");
    expect(i18n.global.t("common.please_confirm")).toBe("Please Confirm");
  });

  it("returns Chinese translations when locale is zh", () => {
    setLocale("zh");
    expect(i18n.global.t("common.confirm")).toBe("确定");
    expect(i18n.global.t("common.cancel")).toBe("取消");
    expect(i18n.global.t("common.tip")).toBe("提示");
    expect(i18n.global.t("common.please_confirm")).toBe("请确认");
  });

  it("uses nested key paths correctly", () => {
    setLocale("en");
    expect(i18n.global.t("app.nav.home")).toBe("Home");
    expect(i18n.global.t("home.title")).toBe("Photo Analysis");

    setLocale("zh");
    expect(i18n.global.t("app.nav.home")).toBe("首页");
    expect(i18n.global.t("home.title")).toBe("照片分析");
  });

  it("interpolates parameters in translations", () => {
    setLocale("en");
    expect(i18n.global.t("home.analysis_failed", {message: "timeout"})).toBe("Analysis failed: timeout");

    setLocale("zh");
    expect(i18n.global.t("home.analysis_failed", {message: "超时"})).toBe("分析失败: 超时");
  });

  it("returns key path for missing translation keys", () => {
    setLocale("en");
    expect(i18n.global.t("nonexistent.key")).toBe("nonexistent.key");

    setLocale("zh");
    expect(i18n.global.t("nonexistent.key")).toBe("nonexistent.key");
  });
});

describe("i18n locale persistence", () => {
  it("stores and retrieves locale via setLocale/getCurrentLocale roundtrip", () => {
    setLocale("zh");
    expect(getCurrentLocale()).toBe("zh");
    expect(localStorage.getItem(STORAGE_KEY)).toBe("zh");

    setLocale("en");
    expect(getCurrentLocale()).toBe("en");
    expect(localStorage.getItem(STORAGE_KEY)).toBe("en");
  });

  it("ignores invalid localStorage values by falling back to default", () => {
    localStorage.setItem(STORAGE_KEY, "fr");
    expect(getCurrentLocale()).not.toBe("fr");
  });
});
