import {describe, it, expect} from "vitest";
import {mount} from "@vue/test-utils";
import WinCard from "../../component/WinCard.vue";

describe("WinCard", () => {
  it("renders a card div", () => {
    const wrapper = mount(WinCard);
    expect(wrapper.find(".win-card").exists()).toBe(true);
  });

  it("shows the title when provided", () => {
    const wrapper = mount(WinCard, {props: {title: "My Card"}});
    const h3 = wrapper.find(".card-header h3");
    expect(h3.exists()).toBe(true);
    expect(h3.text()).toBe("My Card");
  });

  it("hides the header when no title", () => {
    const wrapper = mount(WinCard);
    expect(wrapper.find(".card-header").exists()).toBe(false);
  });

  it("renders default slot in card-content", () => {
    const wrapper = mount(WinCard, {
      slots: {default: "<p>Content</p>"},
    });
    const content = wrapper.find(".card-content");
    expect(content.exists()).toBe(true);
    expect(content.text()).toBe("Content");
  });

  it("renders header-extra slot inside card-header-extra", () => {
    const wrapper = mount(WinCard, {
      props: {title: "Title"},
      slots: {"header-extra": "<span>Extra</span>"},
    });
    const extra = wrapper.find(".card-header-extra");
    expect(extra.exists()).toBe(true);
    expect(extra.text()).toBe("Extra");
  });
});
