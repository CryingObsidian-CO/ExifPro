import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import IconBrand from "../../component/icons/IconBrand.vue";
import IconCheck from "../../component/icons/IconCheck.vue";
import IconClose from "../../component/icons/IconClose.vue";
import IconEdit from "../../component/icons/IconEdit.vue";
import IconError from "../../component/icons/IconError.vue";
import IconFile from "../../component/icons/IconFile.vue";
import IconFolder from "../../component/icons/IconFolder.vue";
import IconHome from "../../component/icons/IconHome.vue";
import IconImage from "../../component/icons/IconImage.vue";
import IconInfo from "../../component/icons/IconInfo.vue";
import IconList from "../../component/icons/IconList.vue";
import IconMaximize from "../../component/icons/IconMaximize.vue";
import IconMerge from "../../component/icons/IconMerge.vue";
import IconMinimize from "../../component/icons/IconMinimize.vue";
import IconMonitor from "../../component/icons/IconMonitor.vue";
import IconMoon from "../../component/icons/IconMoon.vue";
import IconMove from "../../component/icons/IconMove.vue";
import IconPlugin from "../../component/icons/IconPlugin.vue";
import IconPlus from "../../component/icons/IconPlus.vue";
import IconSave from "../../component/icons/IconSave.vue";
import IconSelection from "../../component/icons/IconSelection.vue";
import IconSettings from "../../component/icons/IconSettings.vue";
import IconSun from "../../component/icons/IconSun.vue";
import IconTrash from "../../component/icons/IconTrash.vue";
import IconUndo from "../../component/icons/IconUndo.vue";
import IconUpload from "../../component/icons/IconUpload.vue";
import IconWarning from "../../component/icons/IconWarning.vue";

const allIcons = [
  ["IconBrand", IconBrand],
  ["IconCheck", IconCheck],
  ["IconClose", IconClose],
  ["IconEdit", IconEdit],
  ["IconError", IconError],
  ["IconFile", IconFile],
  ["IconFolder", IconFolder],
  ["IconHome", IconHome],
  ["IconImage", IconImage],
  ["IconInfo", IconInfo],
  ["IconList", IconList],
  ["IconMaximize", IconMaximize],
  ["IconMerge", IconMerge],
  ["IconMinimize", IconMinimize],
  ["IconMonitor", IconMonitor],
  ["IconMoon", IconMoon],
  ["IconMove", IconMove],
  ["IconPlugin", IconPlugin],
  ["IconPlus", IconPlus],
  ["IconSave", IconSave],
  ["IconSelection", IconSelection],
  ["IconSettings", IconSettings],
  ["IconSun", IconSun],
  ["IconTrash", IconTrash],
  ["IconUndo", IconUndo],
  ["IconUpload", IconUpload],
  ["IconWarning", IconWarning],
] as const;

describe("Icons", () => {
  it.each(allIcons)("%s renders an SVG with default size 24", (_name, component) => {
    const wrapper = mount(component);
    const svg = wrapper.find("svg");
    expect(svg.exists()).toBe(true);
    expect(svg.attributes("width")).toBe("24");
    expect(svg.attributes("height")).toBe("24");
  });

  it.each(allIcons)("%s accepts custom size prop", (_name, component) => {
    const wrapper = mount(component, { props: { size: 32 } });
    const svg = wrapper.find("svg");
    expect(svg.attributes("width")).toBe("32");
    expect(svg.attributes("height")).toBe("32");
  });

  it.each(allIcons)("%s has stroke attributes", (_name, component) => {
    const wrapper = mount(component);
    const svg = wrapper.find("svg");
    expect(svg.attributes("fill")).toBe("none");
    expect(svg.attributes("stroke")).toBe("currentColor");
    expect(svg.attributes("viewBox")).toBe("0 0 24 24");
  });
});
