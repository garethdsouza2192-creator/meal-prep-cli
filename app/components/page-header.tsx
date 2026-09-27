import { Link } from "react-router";
import { ArrowLeft } from "lucide-react";

type Props = {
  back?: { to: string; label?: string };
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
};

export function PageHeader({ back, title, subtitle, action }: Props) {
  return (
    <header className="mb-6 sm:mb-8">
      {back && (
        <Link
          to={back.to}
          className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground transition hover:text-foreground"
        >
          <ArrowLeft className="size-4" /> {back.label ?? "Back"}
        </Link>
      )}
      <div className="flex items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="font-heading text-2xl font-semibold tracking-tight sm:text-3xl">
            {title}
          </h1>
          {subtitle && (
            <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
          )}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
    </header>
  );
}
