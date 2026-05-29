"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Category } from "@/lib/actions/categories";
import { createCategory } from "@/lib/actions/categories";
import {
  createGoal,
  updateGoal,
  type Goal,
  type GoalInput,
} from "@/lib/actions/goals";
import { buildGCalUrl } from "@/lib/gcal";

const DAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"];
const PRESETS: Array<{ label: string; days: number[] }> = [
  { label: "Daily", days: [0, 1, 2, 3, 4, 5, 6] },
  { label: "Weekdays", days: [1, 2, 3, 4, 5] },
  { label: "Weekends", days: [0, 6] },
];

export default function GoalForm({
  mode,
  initial,
  categories: initialCategories,
}: {
  mode: "create" | "edit";
  initial?: Goal;
  categories: Category[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [categories, setCategories] = useState(initialCategories);
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [docUrl, setDocUrl] = useState(initial?.doc_url ?? "");
  const [categoryId, setCategoryId] = useState<string | "">(
    initial?.category_id ?? ""
  );
  const [targetDays, setTargetDays] = useState<number[]>(
    initial?.target_days ?? [0, 1, 2, 3, 4, 5, 6]
  );
  // Postgres returns HH:MM:SS; the input wants HH:MM
  const [reminderTime, setReminderTime] = useState(
    initial?.reminder_time ? initial.reminder_time.slice(0, 5) : ""
  );
  // null = specific-day goal; a number = "N times per week" (count goal)
  const [weeklyTarget, setWeeklyTarget] = useState<number | null>(
    initial?.weekly_target ?? null
  );
  const isCount = weeklyTarget !== null;

  const [showNewCategory, setShowNewCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [creatingCategory, setCreatingCategory] = useState(false);

  // Keep the weekly target from exceeding the number of eligible days.
  function setDays(next: number[]) {
    setTargetDays(next);
    setWeeklyTarget((wt) => (wt == null ? null : Math.min(wt, next.length || 1)));
  }

  function toggleDay(d: number) {
    setDays(
      targetDays.includes(d)
        ? targetDays.filter((x) => x !== d)
        : [...targetDays, d].sort()
    );
  }

  async function handleAddCategory() {
    const trimmed = newCategoryName.trim();
    if (!trimmed) return;
    setCreatingCategory(true);
    try {
      const created = await createCategory({ name: trimmed });
      setCategories((cur) => [...cur, created]);
      setCategoryId(created.id);
      setNewCategoryName("");
      setShowNewCategory(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to add category");
    } finally {
      setCreatingCategory(false);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const payload: GoalInput = {
      name,
      description: description || undefined,
      doc_url: docUrl || undefined,
      category_id: categoryId || null,
      target_days: targetDays,
      reminder_time: isCount ? null : reminderTime || null,
      weekly_target: weeklyTarget,
    };
    startTransition(async () => {
      try {
        if (mode === "create") {
          await createGoal(payload);
        } else if (initial) {
          await updateGoal(initial.id, payload);
        }
        router.push("/consistencytracker/goals");
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to save goal");
      }
    });
  }

  const presetMatch = PRESETS.find(
    (p) => p.days.length === targetDays.length && p.days.every((d) => targetDays.includes(d))
  );

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Field label="Goal name" htmlFor="name">
        <input
          id="name"
          required
          maxLength={120}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. 30 min of writing"
          className="w-full border border-[color:var(--border)] rounded-md px-3 py-2 text-sm focus:outline-none focus:border-black"
        />
      </Field>

      <Field label="Category" htmlFor="category">
        <div className="flex items-center gap-2">
          <select
            id="category"
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className="flex-1 border border-[color:var(--border)] rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus:border-black"
          >
            <option value="">Uncategorized</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => setShowNewCategory((s) => !s)}
            className="text-xs text-[color:var(--muted)] hover:text-black px-2 py-2"
          >
            {showNewCategory ? "Cancel" : "+ New"}
          </button>
        </div>
        {showNewCategory ? (
          <div className="mt-2 flex items-center gap-2">
            <input
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              placeholder="New category name"
              maxLength={40}
              className="flex-1 border border-[color:var(--border)] rounded-md px-3 py-2 text-sm focus:outline-none focus:border-black"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleAddCategory();
                }
              }}
            />
            <button
              type="button"
              onClick={handleAddCategory}
              disabled={creatingCategory || !newCategoryName.trim()}
              className="text-sm border border-[color:var(--border)] rounded-md px-3 py-2 hover:bg-gray-50 disabled:opacity-50"
            >
              {creatingCategory ? "Adding…" : "Add"}
            </button>
          </div>
        ) : null}
      </Field>

      <Field label="Description (optional)" htmlFor="description">
        <textarea
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          maxLength={400}
          className="w-full border border-[color:var(--border)] rounded-md px-3 py-2 text-sm focus:outline-none focus:border-black resize-none"
        />
      </Field>

      <Field label="Reflection doc URL (optional)" htmlFor="doc_url">
        <input
          id="doc_url"
          type="url"
          value={docUrl}
          onChange={(e) => setDocUrl(e.target.value)}
          placeholder="https://docs.google.com/…"
          className="w-full border border-[color:var(--border)] rounded-md px-3 py-2 text-sm focus:outline-none focus:border-black"
        />
        <p className="mt-1 text-xs text-[color:var(--muted)]">
          A Google Doc, Notion page, or anything you want to link from this goal.
        </p>
      </Field>

      {!isCount ? (
        <Field label="Reminder time (optional)" htmlFor="reminder_time">
          <div className="flex items-center gap-3">
            <input
              id="reminder_time"
              type="time"
              value={reminderTime}
              onChange={(e) => setReminderTime(e.target.value)}
              className="border border-[color:var(--border)] rounded-md px-3 py-2 text-sm focus:outline-none focus:border-black"
            />
            {reminderTime ? (
              <>
                <a
                  href={buildGCalUrl({
                    name: name || "Reminder",
                    description: description || null,
                    reminderTime,
                    targetDays,
                    timezone:
                      typeof window !== "undefined"
                        ? Intl.DateTimeFormat().resolvedOptions().timeZone
                        : "UTC",
                  })}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs underline text-[color:var(--muted)] hover:text-black"
                >
                  Add to Google Calendar ↗
                </a>
                <button
                  type="button"
                  onClick={() => setReminderTime("")}
                  className="text-xs text-[color:var(--muted)] hover:text-black"
                >
                  Clear
                </button>
              </>
            ) : null}
          </div>
          <p className="mt-1 text-xs text-[color:var(--muted)]">
            The Calendar link reflects your current time + target days — click to add a recurring event.
          </p>
        </Field>
      ) : null}

      <Field label="How often">
        <div className="flex items-center gap-2 mb-4">
          <button
            type="button"
            onClick={() => setWeeklyTarget(null)}
            className={`text-xs border rounded-full px-3 py-1 transition ${
              !isCount
                ? "border-black bg-black text-white"
                : "border-[color:var(--border)] hover:border-black"
            }`}
          >
            Specific days
          </button>
          <button
            type="button"
            onClick={() => setWeeklyTarget(Math.min(3, targetDays.length || 7))}
            className={`text-xs border rounded-full px-3 py-1 transition ${
              isCount
                ? "border-black bg-black text-white"
                : "border-[color:var(--border)] hover:border-black"
            }`}
          >
            Times per week
          </button>
        </div>

        {isCount ? (
          <div className="mb-4">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setWeeklyTarget((n) => Math.max(1, (n ?? 1) - 1))}
                disabled={(weeklyTarget ?? 1) <= 1}
                aria-label="Fewer times per week"
                className="w-8 h-8 rounded-md border border-[color:var(--border)] text-sm hover:border-black disabled:opacity-40"
              >
                −
              </button>
              <span className="text-sm tabular-nums w-20 text-center">
                {weeklyTarget}× / week
              </span>
              <button
                type="button"
                onClick={() =>
                  setWeeklyTarget((n) =>
                    Math.min(targetDays.length || 7, (n ?? 1) + 1)
                  )
                }
                disabled={(weeklyTarget ?? 1) >= targetDays.length}
                aria-label="More times per week"
                className="w-8 h-8 rounded-md border border-[color:var(--border)] text-sm hover:border-black disabled:opacity-40"
              >
                +
              </button>
            </div>
            <p className="mt-2 text-xs text-[color:var(--muted)]">
              Shows up in Today until you hit your weekly count — no fixed reminder.
            </p>
          </div>
        ) : null}

        <p className="text-xs text-[color:var(--muted)] mb-2">
          {isCount ? "Which days count" : "Target days"}
        </p>
        <div className="flex items-center gap-2 mb-3">
          {PRESETS.map((p) => (
            <button
              key={p.label}
              type="button"
              onClick={() => setDays(p.days)}
              className={`text-xs border rounded-full px-3 py-1 transition ${
                presetMatch?.label === p.label
                  ? "border-black bg-black text-white"
                  : "border-[color:var(--border)] hover:border-black"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1">
          {DAY_LABELS.map((label, i) => {
            const active = targetDays.includes(i);
            return (
              <button
                key={i}
                type="button"
                onClick={() => toggleDay(i)}
                aria-pressed={active}
                className={`w-9 h-9 text-xs rounded-md border transition ${
                  active
                    ? "border-black bg-black text-white"
                    : "border-[color:var(--border)] text-[color:var(--muted)] hover:border-black"
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
      </Field>

      {error ? (
        <p className="text-xs text-red-600">{error}</p>
      ) : null}

      <div className="flex items-center gap-3 pt-2">
        <button
          type="submit"
          disabled={pending}
          className="bg-black text-white text-sm rounded-md px-4 py-2 hover:bg-gray-800 disabled:opacity-50"
        >
          {pending ? "Saving…" : mode === "create" ? "Create goal" : "Save changes"}
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          className="text-sm text-[color:var(--muted)] hover:text-black"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={htmlFor} className="block text-xs font-medium mb-2">
        {label}
      </label>
      {children}
    </div>
  );
}
