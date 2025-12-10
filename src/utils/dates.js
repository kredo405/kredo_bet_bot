export const getCurrentDate = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export const getNextDate = () => {
  const now = new Date();
  now.setDate(now.getDate() + 1);
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export const getTimestampForDate = (dayOffset = 0) => {
  // 1. Get the current date in the user's local timezone
  const localDate = new Date();
  
  // 2. Set the date to the desired day (today, tomorrow, etc.)
  localDate.setDate(localDate.getDate() + dayOffset);
  
  // 3. Create a new date object in UTC using the year, month, and day from the local date.
  // This avoids timezone pollution from the time part of the localDate object.
  const utcDate = new Date(Date.UTC(
    localDate.getFullYear(),
    localDate.getMonth(),
    localDate.getDate(),
    23, 59, 59, 999
  ));
  
  return utcDate.getTime();
};

/**
 * Returns a date string in YYYY-MM-DD format for fbref.com.
 * @param {number} dayOffset - The offset from the current date.
 * @returns {string} - The formatted date string.
 */
export const getFbrefDateString = (dayOffset = 0) => {
  const date = new Date();
  date.setDate(date.getDate() + dayOffset);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// Returns a UNIX timestamp (in seconds) for the start of the day (00:00:00).
export const getStartOfDayTimestampSeconds = (dayOffset = 0) => {
  const date = new Date();
  date.setDate(date.getDate() + dayOffset);
  date.setHours(0, 0, 0, 0); // Set to the beginning of the day in local time
  return Math.floor(date.getTime() / 1000);
};

// Returns a UNIX timestamp (in seconds) for the end of the day (23:59:59.999).
export const getEndOfDayTimestampSeconds = (dayOffset = 0) => {
  const date = new Date();
  date.setDate(date.getDate() + dayOffset);
  date.setHours(23, 59, 59, 999); // Set to the end of the day in local time
  return date.getTime() / 1000;
};