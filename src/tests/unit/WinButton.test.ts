import {describe, it, expect} from "vitest";
import {mount} from "@vue/test-utils";
import WinButton from "../../component/WinButton.vue";

describe("WinButton", () => {
  it("renders a button element", () => {
    const wrapper = mount(WinButton);
    expect(wrapper.find("button").exists()).toBe(true);
  });

  it("has default classes", () => {
    const wrapper = mount(WinButton);
    const btn = wrapper.find("button");
    expect(btn.classes()).toContain("variant-secondary");
    expect(btn.classes()).toContain("size-medium");
  });

  it("applies variant class", () => {
    const wrapper = mount(WinButton, {props: {variant: "primary"}});
    expect(wrapper.find("button").classes()).toContain("variant-primary");
  });

  it("applies variant danger", () => {
    const wrapper = mount(WinButton, {props: {variant: "danger"}});
    expect(wrapper.find("button").classes()).toContain("variant-danger");
  });

  it("applies variant ghost", () => {
    const wrapper = mount(WinButton, {props: {variant: "ghost"}});
    expect(wrapper.find("button").classes()).toContain("variant-ghost");
  });

  it("applies size class", () => {
    const wrapper = mount(WinButton, {props: {size: "large"}});
    expect(wrapper.find("button").classes()).toContain("size-large");
  });

  it("applies full-width class when fullWidth is true", () => {
    const wrapper = mount(WinButton, {props: {fullWidth: true}});
    expect(wrapper.find("button").classes()).toContain("full-width");
  });

  it("does NOT have full-width class by default", () => {
    const wrapper = mount(WinButton);
    expect(wrapper.find("button").classes()).not.toContain("full-width");
  });

  it("sets disabled attribute and class when disabled", () => {
    const wrapper = mount(WinButton, {props: {disabled: true}});
    const btn = wrapper.find("button");
    expect(btn.classes()).toContain("disabled");
    expect(btn.attributes("disabled")).toBeDefined();
  });

  it("is not disabled by default", () => {
    const wrapper = mount(WinButton);
    const btn = wrapper.find("button");
    expect(btn.classes()).not.toContain("disabled");
    expect(btn.attributes("disabled")).toBeUndefined();
  });

  it("renders default slot content", () => {
    const wrapper = mount(WinButton, {
      slots: {default: "Click Me"},
    });
    expect(wrapper.find("button").text()).toBe("Click Me");
  });
});
