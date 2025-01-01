import { format, parseISO, addDays, differenceInDays } from 'date-fns'; // date-fns v2.30.0

// Constants
const DEFAULT_DATE_FORMAT = 'MMM dd, yyyy';
const DATE_RANGE_SEPARATOR = ' - ';
const DEFAULT_LOCALE = 'en-US';
const DATE_CACHE_SIZE = 100;

// Simple LRU cache for formatted dates
class DateFormatCache {
    private cache = new Map<string, string>();

    set(key: string, value: string): void {
        if (this.cache.size >= DATE_CACHE_SIZE) {
            const firstKey = this.cache.keys().next().value;
            this.cache.delete(firstKey);
        }
        this.cache.set(key, value);
    }

    get(key: string): string | undefined {
        return this.cache.get(key);
    }
}

const formatCache = new DateFormatCache();

/**
 * Enhanced date formatting utility with null safety, timezone handling, and locale support
 * @param date - Input date as Date object, ISO string, or null/undefined
 * @param formatPattern - Optional date format pattern (defaults to MMM dd, yyyy)
 * @param locale - Optional locale string (defaults to en-US)
 * @returns Formatted date string or empty string for invalid input
 */
export function formatDate(
    date: Date | string | null | undefined,
    formatPattern: string = DEFAULT_DATE_FORMAT,
    locale: string = DEFAULT_LOCALE
): string {
    try {
        if (!date) {
            return '';
        }

        const cacheKey = `${date}-${formatPattern}-${locale}`;
        const cachedResult = formatCache.get(cacheKey);
        if (cachedResult) {
            return cachedResult;
        }

        const dateObj = typeof date === 'string' ? parseISO(date) : date;
        if (!isValidDate(dateObj)) {
            return '';
        }

        const formatted = format(dateObj, formatPattern, { locale });
        formatCache.set(cacheKey, formatted);
        return formatted;
    } catch (error) {
        console.error('Error formatting date:', error);
        return '';
    }
}

/**
 * Calculate days until subscription renewal with enhanced validation and DST handling
 * @param renewalDate - Renewal date as Date object or ISO string
 * @returns Number of days until renewal or null for invalid input
 */
export function calculateRenewalDays(renewalDate: Date | string | null): number | null {
    try {
        if (!renewalDate) {
            return null;
        }

        const renewalDateObj = typeof renewalDate === 'string' ? parseISO(renewalDate) : renewalDate;
        if (!isValidDate(renewalDateObj)) {
            return null;
        }

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const days = differenceInDays(renewalDateObj, today);
        return days >= 0 ? days : null;
    } catch (error) {
        console.error('Error calculating renewal days:', error);
        return null;
    }
}

/**
 * Format date range for analytics with enhanced type safety and performance optimization
 * @param startDate - Start date as Date object or ISO string
 * @param endDate - End date as Date object or ISO string
 * @param formatPattern - Optional date format pattern
 * @param locale - Optional locale string
 * @returns Formatted date range string with appropriate error handling
 */
export function getDateRangeFormatted(
    startDate: Date | string | null,
    endDate: Date | string | null,
    formatPattern: string = DEFAULT_DATE_FORMAT,
    locale: string = DEFAULT_LOCALE
): string {
    try {
        if (!startDate || !endDate) {
            return '';
        }

        const cacheKey = `${startDate}-${endDate}-${formatPattern}-${locale}`;
        const cachedResult = formatCache.get(cacheKey);
        if (cachedResult) {
            return cachedResult;
        }

        const formattedStart = formatDate(startDate, formatPattern, locale);
        const formattedEnd = formatDate(endDate, formatPattern, locale);

        if (!formattedStart || !formattedEnd) {
            return '';
        }

        const dateRange = `${formattedStart}${DATE_RANGE_SEPARATOR}${formattedEnd}`;
        formatCache.set(cacheKey, dateRange);
        return dateRange;
    } catch (error) {
        console.error('Error formatting date range:', error);
        return '';
    }
}

/**
 * Enhanced date validation with comprehensive type checking and edge case handling
 * @param value - Value to validate as date
 * @returns True if valid date, false otherwise
 */
export function isValidDate(value: any): boolean {
    try {
        if (!value) {
            return false;
        }

        if (value instanceof Date) {
            return !isNaN(value.getTime());
        }

        if (typeof value === 'string') {
            const parsed = parseISO(value);
            return !isNaN(parsed.getTime());
        }

        return false;
    } catch (error) {
        console.error('Error validating date:', error);
        return false;
    }
}

/**
 * Add specified number of days to a date with timezone consideration
 * @param date - Base date to add days to
 * @param days - Number of days to add
 * @returns New date with added days or null for invalid input
 */
export function addDaysToDate(date: Date | string | null, days: number): Date | null {
    try {
        if (!date || !isValidDate(date)) {
            return null;
        }

        const dateObj = typeof date === 'string' ? parseISO(date) : date;
        return addDays(dateObj, days);
    } catch (error) {
        console.error('Error adding days to date:', error);
        return null;
    }
}