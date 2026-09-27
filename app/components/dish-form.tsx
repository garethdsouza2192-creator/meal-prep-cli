import { useRef } from "react";
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
};

export function DishForm({
  dish,
  submitLabel,
  error,
  onAutoFill,
  autoFilling,
  autoFillError,
}: Props) {
  const nav = useNavigation();
  const submitting = nav.state === "submitting";
  const nameRef = useRef<HTMLInputElement>(null);

  return (
    <Form method="post" className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <Label htmlFor="name">Name</Label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            ref={nameRef}
            id="name"
            name="name"
            required
            defaultValue={dish?.name ?? ""}
            placeholder="Rajma Chawal"
            className="flex-1"
          />
          {onAutoFill && (
            <Button
              type="button"
              variant="secondary"
              disabled={autoFilling}
              onClick={() => onAutoFill(nameRef.current?.value ?? "")}
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
