import {describe, it, expect} from "vitest";
import {mount} from "@vue/test-utils";
import WinCheckbox from "../../component/WinCheckbox.vue";

describe("WinCheckbox", () => {
  it("renders a checkbox input", () => {
    const wrapper = mount(WinCheckbox, {props: {modelValue: false}});
    expect(wrapper.find('input[type="checkbox"]').exists()).toBe(true);
  });

  it("reflects modelValue in checked state", () => {
    const wrapper = mount(WinCheckbox, {props: {modelValue: true}});
    const input = wrapper.find("input").element as HTMLInputElement;
    expect(input.checked).toBe(true);
  });

  it("unchecked when modelValue is false", () => {
    const wrapper = mount(WinCheckbox, {props: {modelValue: false}});
    const input = wrapper.find("input").element as HTMLInputElement;
    expect(input.checked).toBe(false);
  });

  it("renders label text when provided", () => {
    const wrapper = mount(WinCheckbox, {
      props: {modelValue: false, label: "Accept terms"},
    });
    const label = wrapper.find(".checkbox-label");
    expect(label.exists()).toBe(true);
    expect(label.text()).toBe("Accept terms");
  });

  it("does not render label when not provided", () => {
    const wrapper = mount(WinCheckbox, {props: {modelValue: false}});
    expect(wrapper.find(".checkbox-label").exists()).toBe(false);
  });

  it("has disabled class when disabled", () => {
    const wrapper = mount(WinCheckbox, {
      props: {modelValue: false, disabled: true},
    });
    expect(wrapper.find(".win-checkbox").classes()).toContain("disabled");
  });

  it("disables the input when disabled", () => {
    const wrapper = mount(WinCheckbox, {
      props: {modelValue: false, disabled: true},
    });
    const input = wrapper.find("input").element as HTMLInputElement;
    expect(input.disabled).toBe(true);
  });

  it("shows check SVG when checked", () => {
    const wrapper = mount(WinCheckbox, {props: {modelValue: true}});
    expect(wrapper.find("svg").exists()).toBe(true);
  });

  it("hides check SVG when unchecked", () => {
    const wrapper = mount(WinCheckbox, {props: {modelValue: false}});
    expect(wrapper.find("svg").exists()).toBe(false);
  });

  it("emits update:modelValue on change", async () => {
    const wrapper = mount(WinCheckbox, {props: {modelValue: false}});
    const input = wrapper.find("input");

    await input.setValue(true);

    const emitted = wrapper.emitted("update:modelValue");
    expect(emitted).toBeDefined();
    expect(emitted![0]).toEqual([true]);
  });
});
