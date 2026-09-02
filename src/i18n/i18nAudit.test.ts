import ts from "typescript";
import { describe, expect, it } from "vitest";

const localeModules = import.meta.glob("./locales/*.json", {
  eager: true,
  import: "default",
}) as Record<string, unknown>;

const sourceModules = import.meta.glob("../**/*.{ts,tsx}", {
  eager: true,
  import: "default",
  query: "?raw",
}) as Record<string, string>;

function flattenKeys(value: unknown, prefix = ""): string[] {
  if (!value || typeof value !== "object" || Array.isArray(value)) return [];
  const out: string[] = [];
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    const next = prefix ? `${prefix}.${key}` : key;
    if (child && typeof child === "object" && !Array.isArray(child)) {
      out.push(...flattenKeys(child, next));
    } else {
      out.push(next);
    }
  }
  return out;
}

function productionSources(): [string, string][] {
  return Object.entries(sourceModules).filter(
    ([file]) => !file.includes(".test.") && !file.includes("/__tests__/"),
  );
}

function relative(file: string): string {
  return file.startsWith("../") ? `src/${file.slice(3)}` : file;
}

describe("i18n coverage", () => {
  it("keeps every locale key-complete with English", () => {
    const englishModule = localeModules["./locales/en.json"];
    const english = new Set(flattenKeys(englishModule));
    const failures: string[] = [];

    for (const [file, locale] of Object.entries(localeModules).sort(([a], [b]) =>
      a.localeCompare(b),
    )) {
      const parts = file.split("/");
      const name = parts[parts.length - 1] ?? file;
      const keys = new Set(flattenKeys(locale));
      const missing = [...english].filter((key) => !keys.has(key));
      const extra = [...keys].filter((key) => !english.has(key));
      if (missing.length || extra.length) {
        failures.push(
          `${name}: missing=[${missing.join(", ")}] extra=[${extra.join(", ")}]`,
        );
      }
    }

    expect(failures).toEqual([]);
  });

  it("does not hide missing translations behind English defaults", () => {
    const failures: string[] = [];
    const directFallback = /\bt\s*\(\s*["'`][^"'`]+["'`]\s*,\s*["'`][A-Za-z]/gs;
    const defaultValue = /\bdefaultValue\s*:\s*["'`][A-Za-z]/g;

    for (const [file, source] of productionSources()) {
      if (directFallback.test(source) || defaultValue.test(source)) {
        failures.push(relative(file));
      }
      directFallback.lastIndex = 0;
      defaultValue.lastIndex = 0;
    }

    expect(failures).toEqual([]);
  });

  it("keeps obvious user-facing JSX literals out of production UI", () => {
    const allowed = new Set([
      "SmoothScroll",
      "Nguyễn Quang Trường",
      "github.com/…",
      "steam",
    ]);
    const failures: string[] = [];
    const userFacingAttrs = new Set(["aria-label", "placeholder", "title", "alt"]);

    for (const [file, source] of productionSources().filter(([name]) =>
      name.endsWith(".tsx"),
    )) {
      if (relative(file) === "src/components/preview/sampleContent.tsx") continue;
      const sf = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);

      const record = (node: ts.Node, text: string) => {
        const normalized = text.replace(/\s+/g, " ").trim();
        if (!/[A-Za-z]{2}/.test(normalized) || allowed.has(normalized)) return;
        const line = sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1;
        failures.push(`${relative(file)}:${line}: ${normalized}`);
      };

      const visit = (node: ts.Node) => {
        if (ts.isJsxText(node)) record(node, node.text);
        if (
          ts.isJsxAttribute(node) &&
          ts.isIdentifier(node.name) &&
          userFacingAttrs.has(node.name.text) &&
          node.initializer
        ) {
          if (ts.isStringLiteral(node.initializer)) {
            record(node, node.initializer.text);
          } else if (ts.isJsxExpression(node.initializer) && node.initializer.expression) {
            const expression = node.initializer.expression;
            if (ts.isStringLiteralLike(expression)) {
              record(expression, expression.text);
            } else if (ts.isConditionalExpression(expression)) {
              for (const branch of [expression.whenTrue, expression.whenFalse]) {
                if (ts.isStringLiteralLike(branch)) record(branch, branch.text);
              }
            }
          }
        }
        ts.forEachChild(node, visit);
      };
      visit(sf);
    }

    expect(failures).toEqual([]);
  });
});
