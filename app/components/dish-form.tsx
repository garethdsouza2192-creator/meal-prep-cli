import { useEffect, useRef, useState } from "react";
import { Form, useNavigation } from "react-router";
import { Sparkles } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";
import { MEAL_TYPES, type Dish } from "~/lib/dishes";
import { ingredientsToText } from "~/lib/ingredients";

type Props = {
  dish?: Dish | null;
  submitLabel: string;
  error?: string | null;
  onAutoFill?: (name: string) => void;
  autoFilling?: boolean;
  autoFillError?: string | null;
  action?: string;
  onSubmit?: (event: React.FormEvent<HTMLFormElement>) => void;
  existingDishes?: Dish[];
};

export function DishForm({
  dish,
  submitLabel,
  error,
  onAutoFill,
  autoFilling,
  autoFillError,
  action,
  onSubmit,
  existingDishes = [],
}: Props) {
  const nav = useNavigation();
  const submitting = nav.state === "submitting";
  const nameRef = useRef<HTMLInputElement>(null);
  const [nameValue, setNameValue] = useState(dish?.name ?? "");
  const [showSuggestions, setShowSuggestions] = useState(false);

  useEffect(() => {
    setNameValue(dish?.name ?? "");
  }, [dish?.name]);

  const suggestions = nameValue.trim()
    ? existingDishes
        .filter((candidate) => {
          const query = nameValue.trim().toLowerCase();
          return (
            candidate.name.toLowerCase().includes(query) &&
            candidate.name.toLowerCase() !== query
          );
        })
        .sort((a, b) => a.name.localeCompare(b.name))
        .slice(0, 5)
    : [];

  const handleSuggestionSelect = (suggestedName: string) => {
    setNameValue(suggestedName);
    setShowSuggestions(false);
    if (nameRef.current) {
      nameRef.current.value = suggestedName;
    }
  };

  return (
    <Form method="post" action={action} onSubmit={onSubmit} className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <Label htmlFor="name">Name</Label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="relative flex-1">
            <Input
              ref={nameRef}
              id="name"
              name="name"
              required
              value={nameValue}
              onChange={(event) => {
                const nextValue = event.target.value;
                setNameValue(nextValue);
                setShowSuggestions(nextValue.trim().length > 0);
              }}
              onFocus={() => setShowSuggestions(nameValue.trim().length > 0)}
              onBlur={() => {
                window.setTimeout(() => setShowSuggestions(false), 120);
              }}
              placeholder="Rajma Chawal"
              className="flex-1"
            />
            {showSuggestions && suggestions.length > 0 && (
              <div className="absolute left-0 right-0 top-full z-20 mt-1 overflow-hidden rounded-xl border border-foreground/10 bg-background shadow-lg">
                <div className="border-b border-foreground/10 bg-muted/40 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  Existing dishes
                </div>
                {suggestions.map((dish) => (
                  <button
                    key={dish.id}
                    type="button"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => handleSuggestionSelect(dish.name)}
                    className="flex w-full items-center justify-between gap-2 border-b border-foreground/5 px-3 py-2 text-left text-sm transition last:border-b-0 hover:bg-muted/70"
                  >
                    <span className="truncate font-medium">{dish.name}</span>
                    {dish.cuisine && (
                      <span className="shrink-0 text-[10px] text-muted-foreground">{dish.cuisine}</span>
                    )}
                  </button>
                ))}
                <button
                  type="button"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => {
                    setShowSuggestions(false);
                    nameRef.current?.focus();
                  }}
                  className="w-full px-3 py-2 text-left text-xs font-medium text-violet-700 transition hover:bg-violet-50 dark:text-violet-200 dark:hover:bg-violet-950/40"
                >
                  Continue with this name
                </button>
              </div>
            )}
          </div>
          {onAutoFill && (
            <Button
              type="button"
              variant="secondary"
              disabled={autoFilling}
              onClick={() => onAutoFill(nameValue)}
              title="Use AI to fill in cuisine, prep time, ingredients, and tags from the dish name"
            >
              <Sparkles className="size-4" />
              {autoFilling ? "Thinking…" : "Auto-fill"}
            </Button>
          )}
        </div>
        {autoFillError && (
          <p className="text-xs text-destructive">{autoFillError}</p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="cuisine">Cuisine</Label>
          <Input
            id="cuisine"
            name="cuisine"
            defaultValue={dish?.cuisine ?? ""}
            placeholder="Indian"
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="prep_time_min">Prep time (min)</Label>
          <Input
            id="prep_time_min"
            name="prep_time_min"
            type="number"
            min={0}
            defaultValue={dish?.prep_time_min ?? ""}
            placeholder="35"
          />
        </div>
      </div>

      <fieldset className="flex flex-col gap-2">
        <Label asChild>
          <legend>Meal types</legend>
        </Label>
        <div className="flex flex-wrap gap-3 text-sm">
          {MEAL_TYPES.map((slot) => (
            <label key={slot} className="flex items-center gap-2 capitalize">
              <input
                type="checkbox"
                name="meal_types"
                value={slot}
                defaultChecked={dish?.meal_types.includes(slot) ?? false}
                className="size-4 rounded border-input"
              />
              {slot}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="flex flex-col gap-2">
        <Label htmlFor="tags">Tags</Label>
        <Input
          id="tags"
          name="tags"
          defaultValue={dish?.tags.join(", ") ?? ""}
          placeholder="kid-friendly, weeknight"
        />
        <p className="text-xs text-muted-foreground">Comma-separated.</p>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="ingredients">Ingredients</Label>
        <Textarea
          id="ingredients"
          name="ingredients"
          rows={6}
          defaultValue={dish ? ingredientsToText(dish.ingredients) : ""}
          placeholder="1 cup rice&#10;2 onions&#10;1 tbsp ginger&#10;salt"
        />
        <p className="text-xs text-muted-foreground">
          One per line. Format: <code>quantity unit name</code> (e.g. "1 cup rice").
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="notes">Notes</Label>
        <Textarea
          id="notes"
          name="notes"
          rows={3}
          defaultValue={dish?.notes ?? ""}
          placeholder="Soak rajma overnight."
        />
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex gap-2">
        <Button type="submit" disabled={submitting}>
          {submitting ? "Saving…" : submitLabel}
        </Button>
      </div>
    </Form>
  );
}
