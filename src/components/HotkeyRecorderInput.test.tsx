// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HotkeyRecorderInput } from "./HotkeyRecorderInput";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

function press(el: Element | Window, type: "keydown" | "keyup", props: {
  key?: string;
  code?: string;
  ctrlKey?: boolean;
  altKey?: boolean;
  shiftKey?: boolean;
  metaKey?: boolean;
}) {
  const event = new KeyboardEvent(type, {
    key: props.key ?? "",
    code: props.code ?? "",
    bubbles: true,
    cancelable: true,
    ctrlKey: props.ctrlKey ?? false,
    altKey: props.altKey ?? false,
    shiftKey: props.shiftKey ?? false,
    metaKey: props.metaKey ?? false,
  });
  el.dispatchEvent(event);
}

describe("HotkeyRecorderInput", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  afterEach(() => cleanup());

  it("starts recording on click and commits Ctrl+A", async () => {
    const onCommit = vi.fn();
    render(<HotkeyRecorderInput value="" onCommit={onCommit} />);
    const el = screen.getByRole("button");

    await userEvent.click(el);
    press(el, "keydown", { key: "a", code: "KeyA", ctrlKey: true });
    press(el, "keyup", { key: "a", code: "KeyA" });

    expect(onCommit).toHaveBeenCalledWith("Ctrl+A");
  });

  it("does not commit a released modifier (tap Alt then press A)", async () => {
    const onCommit = vi.fn();
    render(<HotkeyRecorderInput value="" onCommit={onCommit} />);
    const el = screen.getByRole("button");

    await userEvent.click(el);
    // Tap Alt: down, then release.
    press(el, "keydown", { key: "Alt", code: "AltLeft", altKey: true });
    press(el, "keyup", { key: "Alt", code: "AltLeft" });
    // Now press A with no modifiers held.
    press(el, "keydown", { key: "a", code: "KeyA" });
    press(el, "keyup", { key: "a", code: "KeyA" });

    expect(onCommit).not.toHaveBeenCalled();
  });

  it("commits the combo held at keyup, not modifiers from earlier taps", async () => {
    const onCommit = vi.fn();
    render(<HotkeyRecorderInput value="" onCommit={onCommit} />);
    const el = screen.getByRole("button");

    await userEvent.click(el);
    // Tap Ctrl (release it)…
    press(el, "keydown", { key: "Control", code: "ControlLeft", ctrlKey: true });
    press(el, "keyup", { key: "Control", code: "ControlLeft" });
    // …then hold Shift and press A: must be Shift+A, not Ctrl+Shift+A.
    press(el, "keydown", { key: "a", code: "KeyA", shiftKey: true });
    press(el, "keyup", { key: "A", code: "KeyA", shiftKey: true });

    expect(onCommit).toHaveBeenCalledWith("Shift+A");
  });

  it("cancel recording with Escape without committing", async () => {
    const onCommit = vi.fn();
    render(<HotkeyRecorderInput value="" onCommit={onCommit} />);
    const el = screen.getByRole("button");

    await userEvent.click(el);
    act(() => {
      press(el, "keydown", { key: "Escape", code: "Escape" });
    });

    expect(onCommit).not.toHaveBeenCalled();
  });
});
