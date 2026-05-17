import { describe, it, expect } from "vitest";
import { bootReducer, initialBootState, type BootState } from "./bootMachine";
import type { Update } from "@tauri-apps/plugin-updater";

const fakeUpdate = { version: "1.2.3", body: "" } as unknown as Update;

describe("bootReducer", () => {
  it("init -> tray-panel when window is tray-panel", () => {
    expect(
      bootReducer(initialBootState, { type: "WINDOW_DETECTED", label: "tray-panel" }),
    ).toEqual({ kind: "tray-panel" });
  });

  it("init -> checking-accessibility when window is main", () => {
    expect(
      bootReducer(initialBootState, { type: "WINDOW_DETECTED", label: "main" }),
    ).toEqual({ kind: "checking-accessibility" });
  });

  it("checking-accessibility -> needs-accessibility on denied", () => {
    const s: BootState = { kind: "checking-accessibility" };
    expect(bootReducer(s, { type: "ACCESSIBILITY_RESULT", granted: false })).toEqual({
      kind: "needs-accessibility",
    });
  });

  it("checking-accessibility -> checking-update on granted", () => {
    const s: BootState = { kind: "checking-accessibility" };
    expect(bootReducer(s, { type: "ACCESSIBILITY_RESULT", granted: true })).toEqual({
      kind: "checking-update",
      trusted: null,
    });
  });

  it("needs-accessibility -> checking-update on grant event", () => {
    const s: BootState = { kind: "needs-accessibility" };
    expect(bootReducer(s, { type: "ACCESSIBILITY_GRANTED" })).toEqual({
      kind: "checking-update",
      trusted: null,
    });
  });

  it("checking-update stores trusted result", () => {
    const s: BootState = { kind: "checking-update", trusted: null };
    expect(bootReducer(s, { type: "TRUSTED_RESULT", trusted: true })).toEqual({
      kind: "checking-update",
      trusted: true,
    });
  });

  it("checking-update -> ready when no update", () => {
    const s: BootState = { kind: "checking-update", trusted: true };
    expect(bootReducer(s, { type: "UPDATE_NONE" })).toEqual({ kind: "ready" });
  });

  it("checking-update -> update-required with trusted known", () => {
    const s: BootState = { kind: "checking-update", trusted: true };
    const next = bootReducer(s, {
      type: "UPDATE_AVAILABLE",
      update: fakeUpdate,
      currentVersion: "1.0.0",
    });
    expect(next).toMatchObject({
      kind: "update-required",
      currentVersion: "1.0.0",
      trusted: true,
      trustedKnown: true,
    });
  });

  it("update-required: trustedKnown=false when trusted not yet known", () => {
    const s: BootState = { kind: "checking-update", trusted: null };
    const next = bootReducer(s, {
      type: "UPDATE_AVAILABLE",
      update: fakeUpdate,
      currentVersion: "1.0.0",
    });
    expect(next).toMatchObject({
      kind: "update-required",
      trusted: false,
      trustedKnown: false,
    });
  });

  it("update-required: late TRUSTED_RESULT upgrades canSkip + trustedKnown", () => {
    const s: BootState = {
      kind: "update-required",
      update: fakeUpdate,
      currentVersion: "1.0.0",
      trusted: false,
      trustedKnown: false,
    };
    const next = bootReducer(s, { type: "TRUSTED_RESULT", trusted: true });
    expect(next).toMatchObject({
      kind: "update-required",
      trusted: true,
      trustedKnown: true,
    });
  });

  it("update-required with trustedKnown=true: late TRUSTED_RESULT ignored", () => {
    const s: BootState = {
      kind: "update-required",
      update: fakeUpdate,
      currentVersion: "1.0.0",
      trusted: true,
      trustedKnown: true,
    };
    expect(bootReducer(s, { type: "TRUSTED_RESULT", trusted: false })).toBe(s);
  });

  it("update-required -> ready on skip when trusted", () => {
    const s: BootState = {
      kind: "update-required",
      update: fakeUpdate,
      currentVersion: "1.0.0",
      trusted: true,
      trustedKnown: true,
    };
    expect(bootReducer(s, { type: "UPDATE_SKIPPED" })).toEqual({ kind: "ready" });
  });

  it("update-required: untrusted cannot skip", () => {
    const s: BootState = {
      kind: "update-required",
      update: fakeUpdate,
      currentVersion: "1.0.0",
      trusted: false,
      trustedKnown: true,
    };
    expect(bootReducer(s, { type: "UPDATE_SKIPPED" })).toBe(s);
  });

  it("ignores out-of-order events (init: ACCESSIBILITY_RESULT)", () => {
    expect(
      bootReducer(initialBootState, { type: "ACCESSIBILITY_RESULT", granted: true }),
    ).toEqual(initialBootState);
  });

  it("ignores duplicate WINDOW_DETECTED", () => {
    const s: BootState = { kind: "tray-panel" };
    expect(bootReducer(s, { type: "WINDOW_DETECTED", label: "main" })).toEqual(s);
  });
});
