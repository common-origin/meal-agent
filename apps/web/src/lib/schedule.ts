import dayjs from "dayjs";

export function isSunday8AM(): boolean {
  const now = dayjs();
  return now.day() === 0 && now.hour() === 8 && now.minute() < 30;
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

/** The Monday `weeks` weeks after (or before, if negative) `mondayISO`. */
export function shiftWeekISO(mondayISO: string, weeks: number): string {
  return dayjs(mondayISO).add(weeks, "week").format("YYYY-MM-DD");
}

export function nextWeekMondayISO(): string {
  return shiftWeekISO(mondayOfWeekISO(), 1);
}

/**
 * The planned week to open (#194): the week covering `today` if it has a
 * plan, otherwise the soonest planned week after it, otherwise null. Plans
 * are found by their own `week_start`, never by "next Monday", so a plan made
 * on Sunday for the coming week is still found on the Monday.
 */
export function weekToShow(plannedWeeks: string[], today: dayjs.ConfigType = undefined): string | null {
  const thisWeek = mondayOfWeekISO(today);
  if (plannedWeeks.includes(thisWeek)) return thisWeek;
  const upcoming = plannedWeeks.filter((week) => week > thisWeek).sort();
  return upcoming[0] ?? null;
}

/**
 * The planned week to open with no link saying which (#194): on Friday to
 * Sunday, the soonest planned week from next week on, since a weekend plan
 * is for the week ahead; otherwise, or if nothing is planned from next week,
 * `weekToShow` (today's week if planned, else the soonest after it).
 */
export function weekToOpen(plannedWeeks: string[], today: dayjs.ConfigType = undefined): string | null {
  return weekToShow(plannedWeeks, defaultPlanningWeekISO(today)) ?? weekToShow(plannedWeeks, today);
}

/**
 * The week the planner suggests when nothing says otherwise (#194): next week
 * from Friday to Sunday, when the weekend shop is for the week ahead; this
 * week from Monday to Thursday.
 */
export function defaultPlanningWeekISO(today: dayjs.ConfigType = undefined): string {
  const thisWeek = mondayOfWeekISO(today);
  const day = dayjs(today).day(); // 0 = Sunday
  return day === 0 || day >= 5 ? shiftWeekISO(thisWeek, 1) : thisWeek;
}

/** "Mon 16 – Sun 22 Nov", or "Mon 27 Oct – Sun 2 Nov" across a month. */
export function formatWeekRange(mondayISO: string): string {
  const start = dayjs(mondayISO);
  const end = start.add(6, "day");
  const startLabel = start.month() === end.month() ? start.format("ddd D") : start.format("ddd D MMM");
  return `${startLabel} – ${end.format("ddd D MMM")}`;
}

/** "This week", "Next week", "Last week", or null for any other week. */
export function relativeWeekLabel(mondayISO: string, today: dayjs.ConfigType = undefined): string | null {
  const thisWeek = mondayOfWeekISO(today);
  if (mondayISO === thisWeek) return "This week";
  if (mondayISO === shiftWeekISO(thisWeek, 1)) return "Next week";
  if (mondayISO === shiftWeekISO(thisWeek, -1)) return "Last week";
  return null;
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

/**
 * The week the wizard starts on (#194): the week on screen if it's not past
 * and has no plan; otherwise the week after it if that one is free (so "Start
 * new week" doesn't default to replacing the plan you're looking at);
 * otherwise the week on screen, which the wizard then says it will replace.
 */
export function suggestPlanningWeek(
  pageWeek: string,
  plannedWeeks: string[],
  today: dayjs.ConfigType = undefined
): string {
  const base = pageWeek >= mondayOfWeekISO(today) ? pageWeek : defaultPlanningWeekISO(today);
  if (!plannedWeeks.includes(base)) return base;
  const after = shiftWeekISO(base, 1);
  return plannedWeeks.includes(after) ? base : after;
}

/** The weeks the wizard offers: this week, the next two, and `selected` if it's further out. */
export function planningWeekOptions(selected: string, today: dayjs.ConfigType = undefined): string[] {
  const thisWeek = mondayOfWeekISO(today);
  const weeks = [thisWeek, shiftWeekISO(thisWeek, 1), shiftWeekISO(thisWeek, 2)];
  if (selected >= thisWeek && !weeks.includes(selected)) weeks.push(selected);
  return weeks.sort();
}

/** The `?week=` a link carries (#194), as that week's Monday; null if it's missing or not a date. */
export function parseWeekParam(param: string | null | undefined): string | null {
  if (!param || !/^\d{4}-\d{2}-\d{2}$/.test(param)) return null;
  const date = dayjs(param);
  return date.isValid() && date.format("YYYY-MM-DD") === param ? mondayOfWeekISO(date) : null;
}
