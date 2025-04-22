export function lastWeekStartEnd(): [string, string] {
  const today = new Date();
  const lastWeekStart = new Date(today);
  lastWeekStart.setDate(today.getDate() - today.getDay() - 7);
  lastWeekStart.setHours(0, 0, 0, 0);

  const lastWeekEnd = new Date(lastWeekStart);
  lastWeekEnd.setDate(lastWeekStart.getDate() + 6);
  lastWeekEnd.setHours(0, 0, 0, 0); // no need to set to end-of-day since we're only returning the date string

  return [
    lastWeekStart.toISOString().split("T")[0],
    lastWeekEnd.toISOString().split("T")[0],
  ];
}

export function lastMonthStartEnd(): [string, string] {
  const today = new Date();
  const lastMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  lastMonthStart.setHours(0, 0, 0, 0);

  const lastMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0);
  lastMonthEnd.setHours(0, 0, 0, 0);

  return [
    lastMonthStart.toISOString().split("T")[0],
    lastMonthEnd.toISOString().split("T")[0],
  ];
}

export function lastYearStartEnd(): [string, string] {
  const lastYear = new Date().getFullYear() - 1;

  const lastYearStart = new Date(lastYear, 0, 1);
  lastYearStart.setHours(0, 0, 0, 0);

  const lastYearEnd = new Date(lastYear, 11, 31); // month 11 is December
  lastYearEnd.setHours(0, 0, 0, 0);

  return [
    lastYearStart.toISOString().split("T")[0],
    lastYearEnd.toISOString().split("T")[0],
  ];
}

export function q1StartEnd(): [string, string] {
  const currentYear = new Date().getFullYear();

  const q1Start = new Date(currentYear, 0, 1);
  q1Start.setHours(0, 0, 0, 0);

  const q1End = new Date(currentYear, 2, 31); // March is month 2
  q1End.setHours(0, 0, 0, 0);

  return [
    q1Start.toISOString().split("T")[0],
    q1End.toISOString().split("T")[0],
  ];
}
