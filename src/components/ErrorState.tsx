import { Console } from "@/components/Console";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * What a screen shows when something failed. It says what happened, shows the
 * real error text in a wrapped console (so a validation error or file path can
 * be copied into an issue) and offers a way out.
 *
 * @param details The actual error message or file path; never a stack trace.
 * @param onRetry Called by "Try again"; the button is hidden when absent.
 */
export function ErrorState({
  title,
  body,
  details,
  onRetry,
  className,
}: {
  title: string;
  body: string;
  details?: string;
  onRetry?: () => void;
  className?: string;
}) {
  return (
    <section className={cn("mx-auto flex max-w-lg flex-col gap-3 py-12", className)}>
      <div role="alert" className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">{title}</h2>
        <p className="text-text-muted">{body}</p>
      </div>
      {details && <Console label="Error details" text={details} kind="log" defaultWrap />}
      {onRetry && (
        <div>
          <Button type="button" variant="secondary" onClick={onRetry}>
            Try again
          </Button>
        </div>
      )}
    </section>
  );
}
