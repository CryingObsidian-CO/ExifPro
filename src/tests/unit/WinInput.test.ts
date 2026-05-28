import {describe, it, expect} from "vitest";
import {mount} from "@vue/test-utils";
import WinInput from "../../component/WinInput.vue";

describe("WinInput", () => {
  it("renders an input element", () => {
    const wrapper = mount(WinInput, {props: {modelValue: ""}});
    expect(wrapper.find("input").exists()).toBe(true);
  });

  it("uses type=text by default", () => {
    const wrapper = mount(WinInput, {props: {modelValue: ""}});
    const input = wrapper.find("input").element as HTMLInputElement;
    expect(input.type).toBe("text");
  });

  it("uses type=number when specified", () => {
    const wrapper = mount(WinInput, {
      props: {modelValue: "", type: "number"},
    });
    const input = wrapper.find("input").element as HTMLInputElement;
    expect(input.type).toBe("number");
  });

  it("uses type=password when specified", () => {
    const wrapper = mount(WinInput, {
      props: {modelValue: "", type: "password"},
    });
    const input = wrapper.find("input").element as HTMLInputElement;
    expect(input.type).toBe("password");
  });

  it("sets placeholder attribute", () => {
    const wrapper = mount(WinInput, {
      props: {modelValue: "", placeholder: "Enter text"},
    });
    const input = wrapper.find("input").element as HTMLInputElement;
    expect(input.placeholder).toBe("Enter text");
  });

  it("disables input when disabled prop is true", () => {
    const wrapper = mount(WinInput, {
      props: {modelValue: "", disabled: true},
    });
    const input = wrapper.find("input").element as HTMLInputElement;
    expect(input.disabled).toBe(true);
  });

  it("enables input by default", () => {
    const wrapper = mount(WinInput, {props: {modelValue: ""}});
    const input = wrapper.find("input").element as HTMLInputElement;
    expect(input.disabled).toBe(false);
  });

  it("sets readonly attribute", () => {
    const wrapper = mount(WinInput, {
      props: {modelValue: "", readonly: true},
    });
    const input = wrapper.find("input").element as HTMLInputElement;
    expect(input.readOnly).toBe(true);
  });

  it("has win-input class", () => {
    const wrapper = mount(WinInput, {props: {modelValue: ""}});
    expect(wrapper.find("input").classes()).toContain("win-input");
  });

  it("reflects modelValue in the input value", () => {
    const wrapper = mount(WinInput, {props: {modelValue: "hello"}});
    const input = wrapper.find("input").element as HTMLInputElement;
    expect(input.value).toBe("hello");
  });

  it("reflects numeric modelValue", () => {
    const wrapper = mount(WinInput, {
      props: {modelValue: 42, type: "number"},
    });
    const input = wrapper.find("input").element as HTMLInputElement;
    expect(input.value).toBe("42");
  });
});
