import * as React from "react";
import * as SliderPrimitive from "@radix-ui/react-slider";
import { cn } from "@/lib/utils";

/**
 * Slider with subtle haptic-feel polish:
 *  - Thumb scales on hover/active for tactile feedback
 *  - Track lifts (shadow + lighter bg) when interacting
 *  - Range fill animates smoothly thanks to motion-reduce-respecting transition
 *  - prefers-reduced-motion disables transitions automatically (Tailwind utility)
 */
const Slider = React.forwardRef<
  React.ElementRef<typeof SliderPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SliderPrimitive.Root>
>(({ className, ...props }, ref) => (
  <SliderPrimitive.Root
    ref={ref}
    className={cn(
      "group relative flex w-full touch-none select-none items-center",
      className
    )}
    {...props}
  >
    <SliderPrimitive.Track className="relative h-2 w-full grow overflow-hidden rounded-full bg-secondary motion-safe:transition-colors group-hover:bg-secondary/80">
      <SliderPrimitive.Range className="absolute h-full bg-primary motion-safe:transition-all" />
    </SliderPrimitive.Track>
    <SliderPrimitive.Thumb
      className={cn(
        "block h-5 w-5 rounded-full border-2 border-primary bg-background shadow-sm ring-offset-background",
        "motion-safe:transition-transform motion-safe:duration-150",
        "hover:scale-110 active:scale-125 active:shadow-md",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        "disabled:pointer-events-none disabled:opacity-50"
      )}
    />
  </SliderPrimitive.Root>
));
Slider.displayName = SliderPrimitive.Root.displayName;

export { Slider };
