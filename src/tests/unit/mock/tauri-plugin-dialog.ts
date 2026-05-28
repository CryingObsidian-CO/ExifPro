import {vi} from "vitest";

export const mockOpen = vi.fn();

vi.mock("@tauri-apps/plugin-dialog", () => ({
  open: mockOpen,
}));
