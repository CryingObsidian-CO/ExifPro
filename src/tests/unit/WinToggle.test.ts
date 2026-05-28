import {describe, it, expect} from "vitest";
import {mount} from "@vue/test-utils";
import WinToggle from "../../component/WinToggle.vue";

describe("WinToggle", () => {
  it("renders a checkbox input", () => {
    const wrapper = mount(WinToggle, {props: {modelValue: false}});
    expect(wrapper.find('input[type="checkbox"]').exists()).toBe(true);
  });

  it("renders toggle-track and toggle-thumb", () => {
    const wrapper = mount(WinToggle, {props: {modelValue: false}});
    expect(wrapper.find(".toggle-track").exists()).toBe(true);
    expect(wrapper.find(".toggle-thumb").exists()).toBe(true);
  });

  it("reflects modelValue=true as checked", () => {
    const wrapper = mount(WinToggle, {props: {modelValue: true}});
    const input = wrapper.find("input").element as HTMLInputElement;
    expect(input.checked).toBe(true);
  });

  it("reflects modelValue=false as unchecked", () => {
    const wrapper = mount(WinToggle, {props: {modelValue: false}});
    const input = wrapper.find("input").element as HTMLInputElement;
    expect(input.checked).toBe(false);
  });

  it("applies disabled class when disabled", () => {
    const wrapper = mount(WinToggle, {
      props: {modelValue: false, disabled: true},
    });
    expect(wrapper.find(".win-toggle").classes()).toContain("disabled");
  });

  it("disables the input when disabled", () => {
    const wrapper = mount(WinToggle, {
      props: {modelValue: false, disabled: true},
    });
    const input = wrapper.find("input").element as HTMLInputElement;
    expect(input.disabled).toBe(true);
  });

  it("is not disabled by default", () => {
    const wrapper = mount(WinToggle, {props: {modelValue: false}});
    const input = wrapper.find("input").element as HTMLInputElement;
    expect(input.disabled).toBe(false);
    expect(wrapper.find(".win-toggle").classes()).not.toContain("disabled");
  });

  it("emits update:modelValue on toggle", async () => {
    const wrapper = mount(WinToggle, {props: {modelValue: false}});
    const input = wrapper.find("input");

    await input.setValue(true);

    const emitted = wrapper.emitted("update:modelValue");
    expect(emitted).toBeDefined();
    expect(emitted![0]).toEqual([true]);
  });
});
