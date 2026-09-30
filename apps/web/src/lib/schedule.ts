import dayjs from "dayjs";

export function isSunday8AM(): boolean {
  const now = dayjs();
  return now.day() === 0 && now.hour() === 8 && now.minute() < 30;
}

export function isSaturdayAfter4(): boolean {
  const now = dayjs();
  return now.day() === 6 && now.hour() >= 16;
}

/**
 * Monday of the Monday–Sunday week containing `date`. dayjs numbers Sunday
 * as day 0, so `day(1)` on a Sunday would jump forward to the next Monday —
 * count back from the day index instead.
 */
export function mondayOfWeekISO(date: dayjs.ConfigType = undefined): string {
  const d = dayjs(date);
  const daysSinceMonday = (d.day() + 6) % 7;
  return d.subtract(daysSinceMonday, "day").format("YYYY-MM-DD");
}

export function thisWeekMondayISO(): string {
  return mondayOfWeekISO();
}

export function nextWeekMondayISO(): string {
  return dayjs(mondayOfWeekISO()).add(1, "week").format("YYYY-MM-DD");
}

export type PlanWeek = "this" | "next";

const PLAN_WEEK_KEY = "meal_agent_plan_week";

// The choice made in this session, which wins over storage. It keeps the
// choice across pages even when localStorage can be read but not written
// (module state survives client-side navigation).
let inMemoryPlanWeek: string | null = null;

function storedPlanWeek(): string | null {
  if (inMemoryPlanWeek !== null) return inMemoryPlanWeek;
  try {
    return window.localStorage.getItem(PLAN_WEEK_KEY);
  } catch {
    return null;
  }
}

/**
 * Which week the user is planning. Defaults to "next", the weekend-planning
 * routine the app was built around. "This week" is stored with the Monday it
 * was chosen in and only holds for that week, so a mid-week switch can't
 * make the following weekend's plan overwrite the week that's just ending.
 */
export function getPlanWeek(): PlanWeek {
  return storedPlanWeek() === `this:${thisWeekMondayISO()}` ? "this" : "next";
}

export function setPlanWeek(week: PlanWeek): void {
  const value = week === "this" ? `this:${thisWeekMondayISO()}` : "next";
  inMemoryPlanWeek = value;
  try {
    window.localStorage.setItem(PLAN_WEEK_KEY, value);
  } catch {
    // Storage unavailable (private mode etc.) — the in-memory value above
    // still applies for the rest of the session.
  }
}

export function planWeekMondayISO(week: PlanWeek): string {
  return week === "this" ? thisWeekMondayISO() : nextWeekMondayISO();
}

/** Monday ISO of the week currently selected for planning. */
export function selectedWeekMondayISO(): string {
  return planWeekMondayISO(getPlanWeek());
}

/** e.g. "Mon 28 Sep – Sun 4 Oct" */
export function formatWeekRange(mondayISO: string): string {
  const monday = dayjs(mondayISO);
  return `${monday.format("ddd D MMM")} – ${monday.add(6, "day").format("ddd D MMM")}`;
}

export function getNextSunday8AM(): Date {
  const now = dayjs();
  let nextSunday = now.day(0); // This Sunday
  
  // If it's already past 8 AM on Sunday, get next Sunday
  if (now.day() === 0 && now.hour() >= 8) {
    nextSunday = nextSunday.add(1, "week");
  }
  // If it's not Sunday, get the coming Sunday
  else if (now.day() !== 0) {
    nextSunday = nextSunday.add(1, "week");
  }
  
  return nextSunday.hour(8).minute(0).second(0).toDate();
}

export function scheduleSundayToast(): void {
  if (typeof window === "undefined") return;
  
  if (isSunday8AM()) {
    // Show toast notification
    showMealPlanningToast();
  }
  
  // Set up interval to check every minute
  const checkInterval = setInterval(() => {
    if (isSunday8AM()) {
      showMealPlanningToast();
      clearInterval(checkInterval);
    }
  }, 60000); // Check every minute
  
  // Clear interval after 8 hours to avoid memory leaks
  setTimeout(() => {
    clearInterval(checkInterval);
  }, 8 * 60 * 60 * 1000);
}

function showMealPlanningToast(): void {
  // For now, use browser alert. Later this could be replaced with 
  // a proper toast component from the design system
  if (confirm("Good morning! Ready to plan this week's meals? Click OK to start planning.")) {
    window.location.href = "/plan";
  }
}

export function formatTimeUntilSunday(): string {
  const now = dayjs();
  const nextSunday = dayjs(getNextSunday8AM());
  const duration = nextSunday.diff(now);
  
  const days = Math.floor(duration / (1000 * 60 * 60 * 24));
  const hours = Math.floor((duration % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  
  if (days > 0) {
    return `${days} day${days > 1 ? "s" : ""} and ${hours} hour${hours > 1 ? "s" : ""}`;
  } else {
    return `${hours} hour${hours > 1 ? "s" : ""}`;
  }
}