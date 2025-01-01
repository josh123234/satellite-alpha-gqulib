/**
 * @fileoverview Utility functions for number formatting, currency handling, and numerical calculations
 * with enhanced precision handling and internationalization support.
 * @version 1.0.0
 */

// External imports
// Using TypeScript 5.0.0 for enhanced type safety and native Intl support

/**
 * Memoization decorator for caching function results
 */
function memoize(target: any, propertyKey: string, descriptor: PropertyDescriptor) {
  const originalMethod = descriptor.value;
  const cache = new Map();

  descriptor.value = function(...args: any[]) {
    const key = JSON.stringify(args);
    if (cache.has(key)) {
      return cache.get(key);
    }
    const result = originalMethod.apply(this, args);
    cache.set(key, result);
    return result;
  };

  return descriptor;
}

/**
 * Type guard to check if value is a valid number
 */
const isValidNumber = (value: any): value is number => {
  return typeof value === 'number' && !isNaN(value) && isFinite(value);
};

/**
 * Formats a number as currency with comprehensive locale support and high precision
 * @param value - The numerical value to format
 * @param locale - The locale to use for formatting (defaults to 'en-US')
 * @param currency - The currency code (defaults to 'USD')
 * @returns Formatted currency string
 */
@memoize
export function formatCurrency(
  value: number,
  locale: string = 'en-US',
  currency: string = 'USD'
): string {
  try {
    if (!isValidNumber(value)) {
      return '—';
    }

    const formatter = new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });

    const formatted = formatter.format(value);
    return `<span aria-label="${value} ${currency}">${formatted}</span>`;
  } catch (error) {
    console.error('Currency formatting error:', error);
    return `${value} ${currency}`;
  }
}

/**
 * Formats a number as a percentage with configurable precision
 * @param value - The numerical value to format as percentage
 * @param decimals - Number of decimal places (defaults to 1)
 * @returns Formatted percentage string
 */
@memoize
export function formatPercentage(value: number, decimals: number = 1): string {
  try {
    if (!isValidNumber(value)) {
      return '—';
    }

    const formatter = new Intl.NumberFormat('en-US', {
      style: 'percent',
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    });

    const formatted = formatter.format(value);
    return `<span aria-label="${value * 100}%">${formatted}</span>`;
  } catch (error) {
    console.error('Percentage formatting error:', error);
    return `${(value * 100).toFixed(decimals)}%`;
  }
}

/**
 * Calculates percentage change between two values with high precision
 * @param oldValue - The original value
 * @param newValue - The new value
 * @returns Calculated percentage change
 */
@memoize
export function calculatePercentageChange(oldValue: number, newValue: number): number {
  try {
    if (!isValidNumber(oldValue) || !isValidNumber(newValue)) {
      return 0;
    }

    if (oldValue === 0) {
      return newValue > 0 ? 1 : 0;
    }

    return (newValue - oldValue) / Math.abs(oldValue);
  } catch (error) {
    console.error('Percentage change calculation error:', error);
    return 0;
  }
}

/**
 * Rounds a number to specified decimal places using configurable strategies
 * @param value - The number to round
 * @param decimals - Number of decimal places
 * @returns Rounded number
 */
@memoize
export function roundToDecimals(value: number, decimals: number = 2): number {
  try {
    if (!isValidNumber(value) || decimals < 0) {
      return value;
    }

    const multiplier = Math.pow(10, decimals);
    return Math.round(value * multiplier) / multiplier;
  } catch (error) {
    console.error('Rounding error:', error);
    return value;
  }
}

/**
 * Formats large numbers with metric scaling and unit support
 * @param value - The number to format
 * @param unit - Optional unit to append
 * @returns Formatted metric string
 */
@memoize
export function formatMetricValue(value: number, unit?: string): string {
  try {
    if (!isValidNumber(value)) {
      return '—';
    }

    const scales = [
      { threshold: 1e12, suffix: 'T' },
      { threshold: 1e9, suffix: 'B' },
      { threshold: 1e6, suffix: 'M' },
      { threshold: 1e3, suffix: 'K' }
    ];

    let scaledValue = value;
    let suffix = '';

    for (const scale of scales) {
      if (Math.abs(value) >= scale.threshold) {
        scaledValue = value / scale.threshold;
        suffix = scale.suffix;
        break;
      }
    }

    const formatted = new Intl.NumberFormat('en-US', {
      maximumFractionDigits: 1,
      minimumFractionDigits: 0
    }).format(scaledValue);

    const unitString = unit ? ` ${unit}` : '';
    return `<span aria-label="${value}${unitString}">${formatted}${suffix}${unitString}</span>`;
  } catch (error) {
    console.error('Metric formatting error:', error);
    return `${value}${unit ? ` ${unit}` : ''}`;
  }
}