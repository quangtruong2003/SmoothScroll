// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { toast } from "sonner";

import { Toaster } from "./toast";

describe("Toaster", () => {
  afterEach(() => {
    toast.dismiss();
  });

  it("dismisses only clicked toast and uses 1500ms duration", async () => {
    let renderedToaster: ReturnType<typeof Toaster>;
    function TestToaster() {
      renderedToaster = Toaster();
      return renderedToaster;
    }

    render(<TestToaster />);

    expect(renderedToaster!.props.children.props.duration).toBe(1500);

    toast("First", { duration: Infinity });
    toast("Second", { duration: Infinity });

    const first = await screen.findByText("First");
    const second = await screen.findByText("Second");
    const firstToast = first.closest("[data-sonner-toast]");
    const secondToast = second.closest("[data-sonner-toast]");

    expect(firstToast).not.toBeNull();
    expect(secondToast).not.toBeNull();

    fireEvent.click(first);

    await waitFor(() => expect(document.body.contains(firstToast)).toBe(false));
    expect(document.body.contains(secondToast)).toBe(true);
  });

  it("keeps the close button mounted but hidden", async () => {
    render(<Toaster />);

    toast("Only dismissable by click", { duration: Infinity });

    const toastEl = (await screen.findByText("Only dismissable by click")).closest(
      "[data-sonner-toast]",
    );
    const closeButton = toastEl?.querySelector("[data-close-button]");

    // Sonner exposes no toast id on the DOM, so the button is the only
    // per-toast dismiss channel and must stay mounted for click-to-dismiss.
    expect(closeButton).not.toBeNull();
    expect(closeButton?.className).toContain("!hidden");
  });
});
