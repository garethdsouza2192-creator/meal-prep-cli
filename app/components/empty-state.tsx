import type { LucideIcon } from "lucide-react";

type Props = {
  icon: LucideIcon;
  title: string;
  message?: string;
  action?: React.ReactNode;
};

export function EmptyState({ icon: Icon, title, message, action }: Props) {
  return (
    <div className="rounded-2xl bg-card px-6 py-10 text-center ring-1 ring-foreground/10">
      <div className="mx-auto grid size-12 place-items-center rounded-2xl bg-muted text-muted-foreground">
        <Icon className="size-5" />
      </div>
      <h2 className="mt-4 font-heading text-base font-medium">{title}</h2>
      {message && (
        <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
          {message}
        </p>
      )}
      {action && <div className="mt-5 flex justify-center">{action}</div>}
    </div>
  );
}
