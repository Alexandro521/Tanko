const date = new Date();
const DAY = 8.64e7;
const DAY2 = 1.728e8;
const WEEK = 6.048e8;

export function getTimeSkip(time: number) {
  const now = Date.now();
  if (time <= 0) {
    date.setTime(now);
    return date.toLocaleTimeString();
  }
  date.setTime(time);
  const timeDiff = Math.abs(time - now);
  const hours = date.getHours();
  const timePrefix = hours >= 0 && hours < 12 ? "AM" : "PM";
  const timeString = `${hours.toString().padStart(2, "0")}:${date.getMinutes().toString().padStart(2, "0")} ${timePrefix}`;
  if (timeDiff < DAY && hours >= 0 && hours <= 23) {
    return `Today ${timeString}`;
  } else if (timeDiff >= DAY && timeDiff < DAY2) {
    return `Yesterday ${timeString}`;
  } else if (timeDiff >= DAY2 && timeDiff <= WEEK) {
    return `${Math.ceil(timeDiff / DAY)} Ago`;
  } else {
    return date.toLocaleDateString();
  }
}
