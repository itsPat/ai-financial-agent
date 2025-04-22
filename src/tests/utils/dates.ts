export const relativeDates = {
  lastWeek(): [string, string] {
    const today = new Date();
    const lastWeekStart = new Date(today);
    lastWeekStart.setDate(today.getDate() - today.getDay() - 7);
    lastWeekStart.setHours(0, 0, 0, 0);

    const lastWeekEnd = new Date(lastWeekStart);
    lastWeekEnd.setDate(lastWeekStart.getDate() + 6);
    lastWeekEnd.setHours(0, 0, 0, 0);

    return [
      lastWeekStart.toISOString().split("T")[0],
      lastWeekEnd.toISOString().split("T")[0],
    ];
  },

  lastMonth(): [string, string] {
    const today = new Date();
    const start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const end = new Date(today.getFullYear(), today.getMonth(), 0);
    start.setHours(0, 0, 0, 0);
    end.setHours(0, 0, 0, 0);
    return [start.toISOString().split("T")[0], end.toISOString().split("T")[0]];
  },

  monthBeforeLastMonth(): [string, string] {
    const today = new Date();
    const start = new Date(today.getFullYear(), today.getMonth() - 2, 1);
    const end = new Date(today.getFullYear(), today.getMonth() - 1, 0);
    start.setHours(0, 0, 0, 0);
    end.setHours(0, 0, 0, 0);
    return [start.toISOString().split("T")[0], end.toISOString().split("T")[0]];
  },

  lastYear(): [string, string] {
    const year = new Date().getFullYear() - 1;
    const start = new Date(year, 0, 1);
    const end = new Date(year, 11, 31);
    start.setHours(0, 0, 0, 0);
    end.setHours(0, 0, 0, 0);
    return [start.toISOString().split("T")[0], end.toISOString().split("T")[0]];
  },

  q1(): [string, string] {
    const year = new Date().getFullYear();
    const start = new Date(year, 0, 1);
    const end = new Date(year, 2, 31);
    start.setHours(0, 0, 0, 0);
    end.setHours(0, 0, 0, 0);
    return [start.toISOString().split("T")[0], end.toISOString().split("T")[0]];
  },
};
