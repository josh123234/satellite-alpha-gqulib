import { Pipe, PipeTransform } from '@angular/core'; // @angular/core v17.x

/**
 * Angular pipe that transforms numeric byte values into human-readable file size strings.
 * Implements pure pipe transformation for performance optimization through result caching.
 * 
 * @example
 * {{ 1024 | fileSize }} // outputs "1 KB"
 * {{ 1536 | fileSize:2 }} // outputs "1.50 KB"
 */
@Pipe({
  name: 'fileSize',
  pure: true // Enable transformation result caching for better performance
})
export class FileSizePipe implements PipeTransform {
  /**
   * Array of file size units in ascending order
   * @private
   */
  private readonly units: string[] = ['B', 'KB', 'MB', 'GB', 'TB'];

  /**
   * Transforms a numeric byte value into a human-readable file size string.
   * 
   * @param bytes - The size in bytes to transform
   * @param decimals - Number of decimal places to display (default: 2)
   * @returns Formatted file size string with appropriate unit
   * @throws Error if input is negative
   */
  transform(bytes: number, decimals: number = 2): string {
    // Handle null/undefined input
    if (bytes == null) {
      return '0 B';
    }

    // Validate input
    if (bytes < 0) {
      throw new Error('FileSizePipe: Input value cannot be negative');
    }

    // Handle zero bytes
    if (bytes === 0) {
      return '0 B';
    }

    // Calculate the appropriate unit index using logarithmic division
    const unitIndex = Math.floor(Math.log(bytes) / Math.log(1024));

    // Ensure we don't exceed available units
    if (unitIndex >= this.units.length) {
      const maxUnitIndex = this.units.length - 1;
      const size = bytes / Math.pow(1024, maxUnitIndex);
      return `${size.toFixed(decimals)} ${this.units[maxUnitIndex]}`;
    }

    // Calculate the size in the determined unit
    const size = bytes / Math.pow(1024, unitIndex);

    // Format the result with specified decimal places
    const formattedSize = size.toFixed(decimals);

    // Remove trailing zeros after decimal point if decimals is 0
    const finalSize = decimals === 0 ? parseInt(formattedSize, 10) : formattedSize;

    // Return the formatted string with proper spacing
    return `${finalSize} ${this.units[unitIndex]}`;
  }
}