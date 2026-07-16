// @vitest-environment jsdom
import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { sonnerMock } = vi.hoisted(() => ({
  sonnerMock: vi.fn((_props: Record<string, unknown>) => null),
}));

vi.mock("sonner", () => ({
  Toaster: sonnerMock,
  toast: vi.fn(),
}));

import { Toaster } from "./toast";

describe("Toaster", () => {
  beforeEach(() => {
    sonnerMock.mockClear();
  });

  it("uses compact, short-lived operation notifications", () => {
    render(<Toaster />);

    expect(sonnerMock.mock.calls[0][0]).toEqual(
      expect.objectContaining({
        duration: 2500,
        toastOptions: expect.objectContaining({
          className: "text-xs",
          style: expect.objectContaining({
            width: "300px",
            padding: "10px 12px",
          }),
        }),
      }),
    );
  });
});
