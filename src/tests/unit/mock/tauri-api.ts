/**
 * Shared mock for @tauri-apps/api/core.
 *
 * This file demonstrates the correct vitest mock pattern:
 *   vi.hoisted + vi.mock in the same file, with the variable
 *   created inside vi.hoisted to survive vitest's hoisting phase.
 *
 * Copy this pattern into test files that need @tauri-apps/api/core mocks.
 */
import { vi } from "vitest";

export const { mockInvoke } = vi.hoisted(() => ({ mockInvoke: vi.fn() }));
vi.mock("@tauri-apps/api/core", () => ({ invoke: mockInvoke }));
