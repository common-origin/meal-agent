import dayjs from "dayjs";

export function isSunday8AM(): boolean {
  const now = dayjs();
  return now.day() === 0 && now.hour() === 8 && now.minute() < 30;
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