/**
 * Shared mock for @tauri-apps/plugin-dialog.
 *
 * Same pattern as tauri-api.ts — export hoisted + vi.mock.
 */
import { vi } from "vitest";

export const { mockOpen } = vi.hoisted(() => ({ mockOpen: vi.fn() }));
vi.mock("@tauri-apps/plugin-dialog", () => ({ open: mockOpen }));
