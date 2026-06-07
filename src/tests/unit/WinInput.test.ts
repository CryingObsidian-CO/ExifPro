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

  it("sets step attribute", () => {
    const wrapper = mount(WinInput, {
      props: {modelValue: 0, type: "number", step: 0.1},
    });
    const input = wrapper.find("input").element as HTMLInputElement;
    expect(input.getAttribute("step")).toBe("0.1");
  });

  it("sets min attribute", () => {
    const wrapper = mount(WinInput, {
      props: {modelValue: 0, type: "number", min: 1},
    });
    const input = wrapper.find("input").element as HTMLInputElement;
    expect(input.getAttribute("min")).toBe("1");
  });

  it("sets max attribute", () => {
    const wrapper = mount(WinInput, {
      props: {modelValue: 0, type: "number", max: 100},
    });
    const input = wrapper.find("input").element as HTMLInputElement;
    expect(input.getAttribute("max")).toBe("100");
  });

  it("emits update:modelValue on blur", async () => {
    const wrapper = mount(WinInput, {props: {modelValue: ""}});
    const input = wrapper.find("input");
    await input.setValue("new value");
    await input.trigger("blur");
    expect(wrapper.emitted("update:modelValue")).toBeDefined();
  });

  it("clamps value to min on blur when below min", async () => {
    const wrapper = mount(WinInput, {
      props: {modelValue: 0, type: "number", min: 5},
    });
    const input = wrapper.find("input");
    await input.setValue("1");
    await input.trigger("blur");
    expect(wrapper.emitted("update:modelValue")!.slice(-1)[0]).toEqual(["5"]);
  });

  it("clamps value to max on blur when above max", async () => {
    const wrapper = mount(WinInput, {
      props: {modelValue: 0, type: "number", max: 10},
    });
    const input = wrapper.find("input");
    await input.setValue("20");
    await input.trigger("blur");
    expect(wrapper.emitted("update:modelValue")!.slice(-1)[0]).toEqual(["10"]);
  });

  it("integerOnly rejects decimal input on blur", async () => {
    const wrapper = mount(WinInput, {
      props: {modelValue: 5, type: "number", integerOnly: true},
    });
    const input = wrapper.find("input");
    await input.setValue("5.5");
    await input.trigger("blur");
    expect(wrapper.emitted("update:modelValue")).toBeUndefined();
  });

  it("allowNegativeOne permits -1 even when min is higher", async () => {
    const wrapper = mount(WinInput, {
      props: {modelValue: 0, type: "number", min: 0, allowNegativeOne: true},
    });
    const input = wrapper.find("input");
    await input.setValue("-1");
    await input.trigger("blur");
    expect(wrapper.emitted("update:modelValue")!.slice(-1)[0]).toEqual(["-1"]);
  });

  it("does not affect non-number type with integerOnly", async () => {
    const wrapper = mount(WinInput, {
      props: {modelValue: "text", type: "text", integerOnly: true},
    });
    const input = wrapper.find("input");
    await input.setValue("hello");
    await input.trigger("blur");
    expect(wrapper.emitted("update:modelValue")!.slice(-1)[0]).toEqual(["hello"]);
  });
});
