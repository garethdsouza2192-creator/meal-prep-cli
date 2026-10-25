import { useState } from "react";
import { X } from "lucide-react";
import { DishForm } from "~/components/dish-form";
import type { Dish } from "~/lib/dishes";

type AddDishDrawerProps = {
  open: boolean;
  onClose: () => void;
  existingDishes: Dish[];
};

export function AddDishDrawer({ open, onClose, existingDishes }: AddDishDrawerProps) {
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const handleCreateDish = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);

    try {
      const response = await fetch("/dishes/new", {
        method: "POST",
        body: formData,
        credentials: "same-origin",
      });

      if (response.ok) {
        setError(null);
        onClose();
        window.location.reload();
        return;
      }

      setError("Unable to save the dish. Please check the form and try again.");
    } catch {
      setError("Unable to save the dish right now.");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/20 backdrop-blur-[1px]">
      <div className="flex h-full w-full max-w-md flex-col border-l border-foreground/10 bg-background p-4 shadow-2xl">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Add a dish</div>
            <h3 className="text-xl font-semibold">New dish</h3>
          </div>
          <button
            type="button"
            onClick={() => {
              setError(null);
              onClose();
            }}
            className="inline-flex size-8 items-center justify-center rounded-full border border-foreground/10 bg-background text-muted-foreground transition hover:text-foreground"
            aria-label="Close add dish panel"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="overflow-y-auto">
          <DishForm
            submitLabel="Save dish"
            action="/dishes/new"
            onSubmit={handleCreateDish}
            error={error}
            existingDishes={existingDishes}
          />
        </div>
      </div>
    </div>
  );
}
