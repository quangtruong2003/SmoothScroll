// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { VERSION_KEY, detectFreshVersion } from "./appVersion";

beforeEach(() => {
  localStorage.clear();
});

describe("detectFreshVersion", () => {
  it("records a baseline on first run without reporting an update", async () => {
    const result = await detectFreshVersion(async () => "1.35.1");

    expect(result).toBeNull();
    expect(localStorage.getItem(VERSION_KEY)).toBe("1.35.1");
  });

  it("reports nothing when the version is unchanged", async () => {
    localStorage.setItem(VERSION_KEY, "1.35.1");

    expect(await detectFreshVersion(async () => "1.35.1")).toBeNull();
    expect(localStorage.getItem(VERSION_KEY)).toBe("1.35.1");
  });

  it("reports the new version after an update and rolls the baseline forward", async () => {
    localStorage.setItem(VERSION_KEY, "1.35.1");

    expect(await detectFreshVersion(async () => "1.36.0")).toBe("1.36.0");
    expect(localStorage.getItem(VERSION_KEY)).toBe("1.36.0");
  });

  it("swallows a failing version lookup instead of throwing", async () => {
    const result = await detectFreshVersion(async () => {
      throw new Error("tauri unavailable");
    });

    expect(result).toBeNull();
  });
});
