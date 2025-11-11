/**
 * Utility functions for date parsing and formatting
 * All functions use local time to avoid timezone shifts
 */

/**
 * Parse a date string (YYYY-MM-DD) as local date, not UTC
 * This prevents timezone shifts when parsing date-only strings.
 * 
 * When you do `new Date("2025-11-11")`, JavaScript interprets this as UTC midnight,
 * which can be the previous day in timezones behind UTC (like US Central Time).
 * 
 * This function parses the date as local time instead.
 */
export function parseLocalDate(dateString: string): Date {
  // Validate format
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
    throw new Error(`Invalid date format: ${dateString}. Expected YYYY-MM-DD`);
  }
  
  const [year, month, day] = dateString.split('-').map(Number);
  
  // Use local time constructor to avoid UTC interpretation
  // Month is 0-indexed in JavaScript Date constructor
  return new Date(year, month - 1, day);
}

/**
 * Parse a date string, handling both date-only (YYYY-MM-DD) and datetime strings
 * Date-only strings are parsed as local time, datetime strings are parsed normally
 */
export function parseDate(dateString: string | undefined | null): Date {
  if (!dateString) {
    return new Date();
  }
  
  // If it's a date-only string (YYYY-MM-DD), parse as local time
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
    return parseLocalDate(dateString);
  }
  
  // Otherwise, parse as normal (handles ISO datetime strings, etc.)
  return new Date(dateString);
}

/**
 * Format a Date object to YYYY-MM-DD string in local time (not UTC)
 * Use this when you need to pass a date string to Sequelize DATEONLY fields
 * to avoid timezone conversion issues
 */
export function formatDateString(date: Date | string): string {
  let dateObj: Date;
  
  if (date instanceof Date) {
    dateObj = date;
  } else if (typeof date === 'string') {
    // If already in YYYY-MM-DD format, return as-is
    if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return date;
    }
    dateObj = new Date(date);
  } else {
    dateObj = new Date();
  }
  
  // Use local time methods to avoid UTC conversion
  const year = dateObj.getFullYear();
  const month = String(dateObj.getMonth() + 1).padStart(2, '0');
  const day = String(dateObj.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

