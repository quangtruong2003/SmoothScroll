import { ReactNode } from "react";
import { Label } from "@/components/ui/label";

interface Props {
  htmlFor?: string;
  title: string;
  description?: string;
  trailing?: ReactNode;
  children: ReactNode;
}

export function SettingRow({ htmlFor, title, description, trailing, children }: Props) {
  return (
    <div className="flex items-center justify-between gap-6 py-3">
      <div className="flex-1 min-w-0">
        <Label htmlFor={htmlFor} className="text-sm font-medium">
          {title}
        </Label>
        {description && (
          <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
        )}
      </div>
      <div className="flex items-center gap-3 shrink-0">
        {children}
        {trailing && <span className="text-xs tabular-nums w-10 text-right text-muted-foreground">{trailing}</span>}
      </div>
    </div>
  );
}
