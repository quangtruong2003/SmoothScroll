import { describe, it, expect } from "vitest";
import { parseChangelog } from "./changelogParser";

const SAMPLE = `# Changelog

## [Unreleased]

## [1.11.0] - 2026-07-03

### Added
- native UI theming + platform bugfixes
- show beta warning for Linux and macOS users
- add Linux support to download page

### Fixed
- show correct download label for Linux users

## [1.10.7] - 2026-06-22

### Fixed
- make wayland module pub for cross-crate access

## [1.10.0] - 2026-06-21

### Added
- implement Wayland support design and detailed implementation plan
- keep terminal pty alive across reconnects

### Performance
- reduce lock contention in scroll event hot path

### Removed
- legacy IPC channel (deprecated since 0.5)

## [0.2.0] - 2026-05-21

### Added
- onboarding wizard
`;

describe("parseChangelog", () => {
  it("returns exact match with sections grouped by kind", () => {
    const result = parseChangelog(SAMPLE, "1.11.0");
    expect(result).not.toBeNull();
    expect(result!.version).toBe("1.11.0");
    expect(result!.date).toBe("2026-07-03");
    expect(result!.sections).toEqual([
      {
        kind: "Added",
        items: [
          "native UI theming + platform bugfixes",
          "show beta warning for Linux and macOS users",
          "add Linux support to download page",
        ],
      },
      {
        kind: "Fixed",
        items: ["show correct download label for Linux users"],
      },
    ]);
  });

  it("strips pre-release suffix then matches", () => {
    const result = parseChangelog(SAMPLE, "1.11.0-beta.1");
    expect(result).not.toBeNull();
    expect(result!.version).toBe("1.11.0");
  });

  it("falls back to same major.minor when exact version not found", () => {
    const result = parseChangelog(SAMPLE, "1.10.5");
    expect(result).not.toBeNull();
    expect(result!.version).toMatch(/^1\.10\./);
  });

  it("returns latest entry when version not in changelog", () => {
    const result = parseChangelog(SAMPLE, "9.9.9");
    expect(result).not.toBeNull();
    expect(result!.version).toBe("1.11.0");
  });

  it("returns null when changelog is empty", () => {
    expect(parseChangelog("", "1.11.0")).toBeNull();
  });

  it("returns null when changelog has no version headers", () => {
    expect(parseChangelog("# Just some text\n\nNo headers here.", "1.11.0")).toBeNull();
  });

  it("ignores Removed, Deprecated, Security sections", () => {
    const result = parseChangelog(SAMPLE, "1.10.0");
    expect(result).not.toBeNull();
    const kinds = result!.sections.map((s) => s.kind);
    expect(kinds).not.toContain("Removed");
    expect(kinds).toContain("Added");
    expect(kinds).toContain("Performance");
  });

  it("returns entry with empty sections array when version has no items", () => {
    const md = `## [1.0.0] - 2026-01-01\n\n## [0.5.0] - 2025-12-01\n`;
    const result = parseChangelog(md, "1.0.0");
    expect(result).not.toBeNull();
    expect(result!.sections).toEqual([]);
  });

  it("stops at next ## [ header", () => {
    const result = parseChangelog(SAMPLE, "1.10.7");
    expect(result).not.toBeNull();
    expect(result!.sections).toEqual([
      { kind: "Fixed", items: ["make wayland module pub for cross-crate access"] },
    ]);
  });

  it("parses bullets from CRLF input (Windows line endings)", () => {
    const mdCRLF = [
      "# Changelog",
      "",
      "## [1.0.0] - 2026-01-01",
      "",
      "### Added",
      "- feature one",
      "- feature two",
      "",
    ].join("\r\n");

    const result = parseChangelog(mdCRLF, "1.0.0");
    expect(result).not.toBeNull();
    expect(result!.sections).toEqual([
      { kind: "Added", items: ["feature one", "feature two"] },
    ]);
  });
});