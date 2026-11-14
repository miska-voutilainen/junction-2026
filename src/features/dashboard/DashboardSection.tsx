import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** A titled block of the dashboard: an h2 with one line saying what the block answers. */
export function DashboardSection({
  title,
  subtitle,
  children,
  className,
}: Readonly<{
  title: string;
  subtitle: string;
  children: ReactNode;
  className?: string;
}>) {
  return (
    <section className={cn("flex min-w-0 flex-col gap-3", className)}>
      <div className="flex flex-col gap-0.5">
        <h2 className="text-lg font-semibold">{title}</h2>
        <p className="text-sm text-text-muted">{subtitle}</p>
      </div>
      {children}
    </section>
  );
}
