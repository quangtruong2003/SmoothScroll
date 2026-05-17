import { ReactNode } from "react";

interface TabContentProps {
  title?: string;
  description?: string;
  /** Whether the inner content should scroll independently (default true). */
  scrollable?: boolean;
  children: ReactNode;
}

/**
 * Standard layout for a Settings tab: optional header (title + description)
 * + scrollable content area. Centralizes the boilerplate
 * `<div className="overflow-y-auto pr-1">` pattern used previously per tab.
 */
export function TabContent({
  title,
  description,
  scrollable = true,
  children,
}: TabContentProps) {
  return (
    <div className="flex flex-col h-full gap-3">
      {(title || description) && (
        <div className="space-y-0.5 shrink-0">
          {title && (
            <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
          )}
          {description && (
            <p className="text-sm text-muted-foreground">{description}</p>
          )}
        </div>
      )}
      <div className={scrollable ? "flex-1 overflow-y-auto pr-1" : "flex-1"}>
        <div className="space-y-3">{children}</div>
      </div>
    </div>
  );
}
