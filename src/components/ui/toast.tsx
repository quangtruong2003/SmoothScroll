import { Toaster as Sonner, toast } from "sonner";

export function Toaster() {
  return (
    <Sonner
      position="bottom-right"
      duration={2500}
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
  );
}

export { toast };
