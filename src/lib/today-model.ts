import { addDays, DAY_START_HOUR, isoWeekStart } from "@/lib/dates";
import { UNCATEGORIZED_COLOR } from "@/lib/colors";
import { selectLastNightGoals } from "@/lib/last-night";
import { classifyGoalForLogicalDay, scoredDoneBefore } from "@/lib/today-required";
import { todaySummary } from "@/lib/today-summary";

type Status = "done" | "skipped";

export type TodayModelGoal = {
  id: string;
  name: string;
  target_days: number[];
  weekly_target: number | null;
  created_at: string;
  category?: { color: string | null } | null;
};

export type TodayModelCheckIn = {
  goal_id: string;
  date: string;
  status: string;
};

export type TodayModelExtraGoal = {
  id: string;
  name: string;
  categoryColor: string;
  status: Status | null;
  kind: "off_target" | "over_quota";
};

export type TodaySummaryInput = {
  requiredCount: number;
  doneCount: number;
  skippedCount: number;
  remaining: number;
  extraToday: number;
  overQuotaCount: number;
  isNightOwl: boolean;
};

/**
 * Pure Today-page state model. The server component fetches rows; this function
 * owns the product classification so daytime, night-owl, extras, and header
 * copy cannot drift through separate local branches.
 */
export function buildTodayModel<G extends TodayModelGoal, C extends TodayModelCheckIn>(args: {
  goals: G[];
  checkIns: C[];
  today: string;
  dow: number;
  hour: number;
  timezone: string;
}): {
  isNightOwl: boolean;
  yesterday: string;
  extraDate: string;
  requiredGoals: G[];
  overQuotaGoals: G[];
  lastNightRequiredGoals: G[];
  lastNightOverQuotaGoals: G[];
  extraGoals: TodayModelExtraGoal[];
  todayCheckIns: C[];
  checkInByGoal: Map<string, C>;
  summaryInput: TodaySummaryInput;
  summary: string;
} {
  const { goals, checkIns, today, dow, hour, timezone } = args;
  const weekStart = isoWeekStart(today);
  const yesterday = addDays(today, -1);
  const yesterdayDow = (dow + 6) % 7;
  const isNightOwl = hour < DAY_START_HOUR;
  const extraDate = isNightOwl ? yesterday : today;
  const extraDow = isNightOwl ? yesterdayDow : dow;

  const todayCheckIns = checkIns.filter((c) => c.date === today);
  const checkInByGoal = new Map(todayCheckIns.map((c) => [c.goal_id, c]));
  const goalsToday = goals.filter((g) => g.target_days.includes(dow));

  const requiredGoals: G[] = [];
  const overQuotaGoals: G[] = [];
  for (const g of goalsToday) {
    const cls = classifyGoalForLogicalDay({
      weeklyTarget: g.weekly_target,
      inTargetDay: true,
      hasCheckInOnDay: checkInByGoal.has(g.id),
      scoredDoneBeforeDay: scoredDoneBefore(
        checkIns,
        g.id,
        today,
        weekStart,
        g.target_days
      ),
    });
    if (cls === "over_quota") overQuotaGoals.push(g);
    else requiredGoals.push(g);
  }

  const loggedYesterday = new Set(
    checkIns.filter((c) => c.date === yesterday).map((c) => c.goal_id)
  );
  const { required: lastNightRequiredGoals, overQuota: lastNightOverQuotaGoals } =
    selectLastNightGoals({
      goals,
      hour,
      yesterday,
      yesterdayDow,
      yesterdayWeekStart: isoWeekStart(yesterday),
      loggedYesterday,
      weekCheckIns: checkIns,
      timezone,
    });

  const extraCheckInByGoal = new Map(
    checkIns.filter((c) => c.date === extraDate).map((c) => [c.goal_id, c])
  );
  const offTargetExtras = goals
    .filter((g) => !g.target_days.includes(extraDow))
    .map((g) => ({
      id: g.id,
      name: g.name,
      categoryColor: g.category?.color ?? UNCATEGORIZED_COLOR,
      status: normalizeStatus(extraCheckInByGoal.get(g.id)?.status),
      kind: "off_target" as const,
    }));

  const overQuotaSource = isNightOwl ? lastNightOverQuotaGoals : overQuotaGoals;
  const overQuotaExtras = overQuotaSource
    .map((g) => ({
      id: g.id,
      name: g.name,
      categoryColor: g.category?.color ?? UNCATEGORIZED_COLOR,
      status: normalizeStatus(extraCheckInByGoal.get(g.id)?.status),
      kind: "over_quota" as const,
    }))
    .filter((g) => g.status !== "skipped");

  const extraGoals = [...offTargetExtras, ...overQuotaExtras];
  const requiredGoalIds = new Set(requiredGoals.map((g) => g.id));
  const scheduledToday = todayCheckIns.filter((c) => requiredGoalIds.has(c.goal_id));
  const doneCount = scheduledToday.filter((c) => c.status === "done").length;
  const skippedCount = scheduledToday.filter((c) => c.status === "skipped").length;
  const remaining = requiredGoals.length - doneCount - skippedCount;
  const extraToday = extraGoals.filter((g) => g.status === "done").length;

  const summaryInput: TodaySummaryInput = {
    requiredCount: requiredGoals.length,
    doneCount,
    skippedCount,
    remaining,
    extraToday,
    overQuotaCount: isNightOwl ? 0 : overQuotaGoals.length,
    isNightOwl,
  };

  return {
    isNightOwl,
    yesterday,
    extraDate,
    requiredGoals,
    overQuotaGoals,
    lastNightRequiredGoals,
    lastNightOverQuotaGoals,
    extraGoals,
    todayCheckIns,
    checkInByGoal,
    summaryInput,
    summary: todaySummary(summaryInput),
  };
}

function normalizeStatus(status: string | undefined): Status | null {
  return status === "done" || status === "skipped" ? status : null;
}
