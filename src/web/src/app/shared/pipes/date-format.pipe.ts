import { Pipe, PipeTransform } from '@angular/core'; // @angular/core v17.x
import { formatDate } from '../utils/date.utils';

/**
 * Pure Angular pipe that provides standardized date formatting across the SaaS Management Platform.
 * Handles subscription dates, analytics timestamps, and general date values with robust error handling
 * and performance optimization through caching.
 * 
 * @example
 * // In template
 * {{ subscriptionRenewalDate | dateFormat:'MMM dd, yyyy' }}
 * {{ analyticsTimestamp | dateFormat:'MM/dd/yyyy HH:mm:ss' }}
 */
@Pipe({
    name: 'dateFormat',
    pure: true // Ensures optimal performance through result memoization
})
export class DateFormatPipe implements PipeTransform {
    /**
     * Transforms a date value into a formatted string using the application's standardized
     * date formatting patterns.
     * 
     * @param value - The date to format (can be Date object, ISO string, null, or undefined)
     * @param format - The desired output format pattern (defaults to 'MMM dd, yyyy')
     * @returns Formatted date string or empty string if input is invalid
     * 
     * @throws Does not throw - handles all errors internally and returns empty string
     */
    transform(value: Date | string | null | undefined, format: string = 'MMM dd, yyyy'): string {
        // Delegate to the formatDate utility which includes:
        // - Comprehensive error handling
        // - Performance optimization through caching
        // - Timezone consideration
        // - Proper null/undefined handling
        // - Type safety checks
        return formatDate(value, format);
    }
}