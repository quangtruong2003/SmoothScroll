import { type MouseEvent, useRef } from "react";
import { Toaster as Sonner, toast } from "sonner";

export function Toaster() {
  const rootRef = useRef<HTMLDivElement>(null);

  const dismissClickedToast = (event: MouseEvent<HTMLDivElement>) => {
    const target = event.target;
    if (!(target instanceof Element) || target.closest("button")) return;

    const clickedToast = target.closest("[data-sonner-toast]");
    if (!clickedToast || !rootRef.current?.contains(clickedToast)) return;

    clickedToast.querySelector<HTMLButtonElement>("[data-close-button]")?.click();
  };

  return (
    <div ref={rootRef} className="contents" onClick={dismissClickedToast}>
      <Sonner
        closeButton
        position="bottom-right"
        duration={1500}
        toastOptions={{
          style: {
            background: "hsl(var(--background))",
            color: "hsl(var(--foreground))",
            border: "1px solid hsl(var(--border))",
            width: "300px",
            padding: "10px 12px",
          },
          className: "text-xs",
        }}
      />
    </div>
  );
}

export { toast };
