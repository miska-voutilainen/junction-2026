import type { ReactNode } from "react";
import { Console } from "@/components/Console";
import { cn } from "@/lib/utils";

/**
 * What a screen shows when there is nothing to list. It says what is missing
 * and what to do next; when the next step is a command, it is shown in a
 * `Console` so it can be copied.
 *
 * @param command The command that produces the missing data, e.g. "pnpm review run mp-2283".
 * @param actions Buttons or links, shown below the body.
 */
export function EmptyState({
  icon,
  title,
  body,
  command,
  actions,
  className,
}: {
  icon?: ReactNode;
  title: string;
  body: string;
  command?: string;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("mx-auto flex max-w-md flex-col items-center gap-3 py-12 text-center", className)}>
      {icon && (
        <div aria-hidden="true" className="text-text-muted [&_svg]:size-6">
          {icon}
        </div>
      )}
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="text-text-muted">{body}</p>
      {command && <Console label="Command" text={command} kind="output" className="w-full text-left" />}
      {actions && <div className="flex flex-wrap justify-center gap-2">{actions}</div>}
    </section>
  );
}
