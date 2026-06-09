const currentTime = new Date();
const readTime= new Date();

export function getTimeSkip(time: number) {
  currentTime.setTime(Date.now())
  readTime.setTime(time);

  const [currentDay, currentMonth, currentYear] = [
    currentTime.getDay(),
    currentTime.getMonth(),
    currentTime.getFullYear()
  ]
  const [readDay, readMonth, readYear] = [
    readTime.getDay(),
    readTime.getMonth(),
    readTime.getFullYear()
    ]
  const [dayDiff, montDiff, yearDiff] = [
    Math.abs(currentDay - readDay),
    Math.abs(currentMonth - readMonth),
    Math.abs(currentYear - readYear)
  ];
  if(yearDiff >= 1 || montDiff >= 1){
    return readTime.toDateString()
  }else if(dayDiff >= 7){
    return `${(dayDiff/7)| 0} Weeks ago`
  }else if(dayDiff >= 2) {
    return `${dayDiff} Days ago`
  }
  else {
    const hours = readTime.getHours()
    const timePrefix = hours >= 0 && hours < 12 ? "AM" : "PM";
    const timeString = `${hours.toString().padStart(2, "0")}:${readTime.getMinutes().toString().padStart(2, "0")} ${timePrefix}`;
    return `${ dayDiff < 1 ? 'Today' : 'Yesterday'} ${timeString}`
  }
}
