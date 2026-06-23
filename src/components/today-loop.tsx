"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import TodayGoalCard from "@/components/today-goal-card";
import { DAY_START_HOUR } from "@/lib/dates";
import { UNCATEGORIZED_COLOR } from "@/lib/colors";
import { todaySummary } from "@/lib/today-summary";
import type { CheckIn } from "@/lib/actions/check-ins";
import type { TodaySummaryInput } from "@/lib/today-model";

type RequiredGoal = {
  id: string;
  name: string;
  description: string | null;
  weekly_target: number | null;
  category: { color: string | null } | null;
};

export default function TodayLoop({
  timezone,
  firstName,
  prettyDate,
  date,
  initialSummaryInput,
  goals,
  checkIns,
  paceByGoal,
}: {
  timezone: string;
  firstName?: string;
  prettyDate: string;
  date: string;
  initialSummaryInput: TodaySummaryInput;
  goals: RequiredGoal[];
  checkIns: Array<[string, CheckIn]>;
  paceByGoal: Array<[string, number]>;
}) {
  const [checkInByGoal, setCheckInByGoal] = useState<Record<string, CheckIn | null>>(
    () => Object.fromEntries(checkIns)
  );
  // Per-goal local intent that stays ahead of route refreshes until server
  // props match it. This protects rapid same-tab taps from cross-card flicker;
  // it deliberately assumes a single owner editing their own Today loop, not a
  // collaborative conflict-resolution model across devices.
  const localOverrideByGoal = useRef<Record<string, CheckIn | null>>({});
  const pace = useMemo(() => new Map(paceByGoal), [paceByGoal]);

  useEffect(() => {
    const server = Object.fromEntries(checkIns) as Record<string, CheckIn | null>;
    const nextOverrides: Record<string, CheckIn | null> = {};
    for (const [goalId, local] of Object.entries(localOverrideByGoal.current)) {
      const serverValue = server[goalId] ?? null;
      if (!sameCheckInState(serverValue, local)) {
        nextOverrides[goalId] = local;
      }
    }
    localOverrideByGoal.current = nextOverrides;
    setCheckInByGoal({ ...server, ...nextOverrides });
  }, [checkIns]);

  const doneCount = goals.filter((g) => checkInByGoal[g.id]?.status === "done").length;
  const skippedCount = goals.filter((g) => checkInByGoal[g.id]?.status === "skipped").length;
  const summary = todaySummary({
    ...initialSummaryInput,
    doneCount,
    skippedCount,
    remaining: goals.length - doneCount - skippedCount,
  });

  return (
    <>
      <Header
        timezone={timezone}
        firstName={firstName}
        prettyDate={prettyDate}
        summary={summary}
      />

      {goals.length === 0 ? null : (
        <div className="space-y-2 mt-6">
          {goals.map((g) => {
            const paceLabel =
              g.weekly_target != null
                ? (pace.get(g.id) ?? 0) >= g.weekly_target
                  ? `✓ ${g.weekly_target} of ${g.weekly_target} this week`
                  : `${pace.get(g.id) ?? 0} of ${g.weekly_target} this week`
                : undefined;
            return (
              <TodayGoalCard
                key={g.id}
                goalId={g.id}
                name={g.name}
                description={g.description}
                categoryColor={g.category?.color ?? UNCATEGORIZED_COLOR}
                date={date}
                timezone={timezone}
                checkIn={checkInByGoal[g.id] ?? null}
                paceLabel={paceLabel}
                onLocalCheckInChange={(next) => {
                  localOverrideByGoal.current = {
                    ...localOverrideByGoal.current,
                    [g.id]: next,
                  };
                  setCheckInByGoal((prev) => ({ ...prev, [g.id]: next }));
                }}
              />
            );
          })}
        </div>
      )}
    </>
  );
}

function Header({
  timezone,
  firstName,
  prettyDate,
  summary,
}: {
  timezone: string;
  firstName?: string;
  prettyDate: string;
  summary?: string;
}) {
  return (
    <header className="mb-2">
      <h1 className="text-xl font-light tracking-tight">
        {greeting(timezone)}, {firstName ?? "friend"}.
      </h1>
      <p className="mt-1 text-sm text-[color:var(--muted)]">
        {prettyDate}
        {summary ? ` · ${summary}` : ""}
      </p>
    </header>
  );
}

function greeting(timezone: string): string {
  const hour = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour: "numeric",
    hour12: false,
  }).format(new Date());
  const n = Number(hour);
  if (n < DAY_START_HOUR) return "Still up";
  if (n < 12) return "Morning";
  if (n < 17) return "Afternoon";
  if (n < 21) return "Evening";
  return "Night";
}

function sameCheckInState(a: CheckIn | null, b: CheckIn | null): boolean {
  if (a === null || b === null) return a === b;
  return (
    a.status === b.status &&
    a.skip_reason === b.skip_reason &&
    a.note === b.note &&
    a.effort_texture === b.effort_texture
  );
}
