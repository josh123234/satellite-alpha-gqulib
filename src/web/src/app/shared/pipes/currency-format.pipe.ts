import { Pipe, PipeTransform } from '@angular/core';
import { formatCurrency } from '../utils/number.utils';

/**
 * Angular pipe for consistent currency formatting across the SaaS Management Platform.
 * Provides locale-aware currency formatting with accessibility support.
 * 
 * @example
 * {{ 542680 | currencyFormat }} // outputs "$542,680.00"
 * {{ 99.99 | currencyFormat:'en-GB':'GBP' }} // outputs "£99.99"
 * 
 * @version 1.0.0
 */
@Pipe({
  name: 'currencyFormat',
  pure: true // Marking as pure for better performance since formatting is deterministic
})
export class CurrencyFormatPipe implements PipeTransform {
  // Default locale for consistent formatting
  private readonly defaultLocale = 'en-US';
  
  // Default currency code
  private readonly defaultCurrency = 'USD';

  // Memoization cache for performance optimization
  private readonly cache = new Map<string, string>();

  /**
   * Transforms a numeric value into a properly formatted currency string.
   * Handles null/undefined values, provides locale support, and includes accessibility attributes.
   * 
   * @param value - The numeric value to format
   * @param locale - Optional locale code (e.g., 'en-US', 'en-GB')
   * @param currency - Optional currency code (e.g., 'USD', 'EUR')
   * @returns Formatted currency string with proper ARIA attributes
   */
  transform(
    value: number | null | undefined,
    locale?: string,
    currency?: string
  ): string {
    // Handle null/undefined values
    if (value === null || value === undefined) {
      return '';
    }

    // Convert string numbers to actual numbers if needed
    const numericValue = typeof value === 'string' ? parseFloat(value) : value;

    // Validate the numeric value
    if (!Number.isFinite(numericValue)) {
      return '';
    }

    // Use provided locale/currency or fall back to defaults
    const finalLocale = locale || this.defaultLocale;
    const finalCurrency = currency || this.defaultCurrency;

    // Generate cache key
    const cacheKey = `${numericValue}-${finalLocale}-${finalCurrency}`;

    // Check cache for existing formatted value
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!;
    }

    // Format the currency using the utility function
    const formattedValue = formatCurrency(
      numericValue,
      finalLocale,
      finalCurrency
    );

    // Cache the result
    this.cache.set(cacheKey, formattedValue);

    return formattedValue;
  }
}