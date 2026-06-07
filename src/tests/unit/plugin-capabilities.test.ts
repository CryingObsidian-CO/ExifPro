import {describe, it, expect} from "vitest";
import {CAPABILITY_INFO} from "../../types/plugin";

describe("CAPABILITY_INFO", () => {
  it("contains all capability types", () => {
    const types = Object.keys(CAPABILITY_INFO);
    expect(types).toContain("exif_enhancement");
    expect(types).toContain("grouping");
    expect(types).toContain("merging");
    expect(types).toContain("ui_extensions");
    expect(types).toContain("file_read");
    expect(types).toContain("file_write");
    expect(types).toContain("directory_create");
    expect(types).toHaveLength(7);
  });

  it("each capability has required fields", () => {
    for (const [key, info] of Object.entries(CAPABILITY_INFO)) {
      expect(info.type).toBe(key);
      expect(typeof info.label).toBe("string");
      expect(info.label.length).toBeGreaterThan(0);
      expect(["low", "medium", "high"]).toContain(info.riskLevel);
      expect(typeof info.description).toBe("string");
      expect(info.description.length).toBeGreaterThan(0);
    }
  });

  it("file ops have medium risk level", () => {
    expect(CAPABILITY_INFO.file_read.riskLevel).toBe("medium");
    expect(CAPABILITY_INFO.file_write.riskLevel).toBe("medium");
    expect(CAPABILITY_INFO.directory_create.riskLevel).toBe("medium");
  });

  it("data-only capabilities have low risk level", () => {
    expect(CAPABILITY_INFO.exif_enhancement.riskLevel).toBe("low");
    expect(CAPABILITY_INFO.grouping.riskLevel).toBe("low");
    expect(CAPABILITY_INFO.merging.riskLevel).toBe("low");
    expect(CAPABILITY_INFO.ui_extensions.riskLevel).toBe("low");
  });
});
