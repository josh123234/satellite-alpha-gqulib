import { Repository } from 'typeorm'; // typeorm ^0.3.0
import { PaginatedDto, PaginationOptions } from '../decorators/api-paginated-response.decorator';

/**
 * Default number of items per page if not specified
 */
export const DEFAULT_PAGE_SIZE = 10;

/**
 * Maximum allowed items per page to prevent performance issues
 */
export const MAX_PAGE_SIZE = 100;

/**
 * Minimum allowed page number (1-based pagination)
 */
export const MIN_PAGE = 1;

/**
 * Creates standardized pagination options with input validation and normalization
 * @param page - Requested page number (1-based)
 * @param pageSize - Number of items per page
 * @returns Normalized and validated pagination parameters
 * @throws Error if validation fails
 */
export function createPaginationOptions(
  page?: number,
  pageSize?: number,
): PaginationOptions {
  // Validate and normalize page number
  const normalizedPage = Math.max(
    Number.isInteger(page) && page > 0 ? page : MIN_PAGE,
    MIN_PAGE,
  );

  // Validate and normalize page size
  let normalizedPageSize = Number.isInteger(pageSize) ? pageSize : DEFAULT_PAGE_SIZE;
  normalizedPageSize = Math.min(
    Math.max(normalizedPageSize, 1),
    MAX_PAGE_SIZE,
  );

  return {
    page: normalizedPage,
    pageSize: normalizedPageSize,
  };
}

/**
 * Generic function to transform data into a paginated response with comprehensive metadata
 * @template T - Type of items in the data array
 * @param data - Array of items for current page
 * @param totalItems - Total number of items across all pages
 * @param options - Pagination options containing page and pageSize
 * @returns Type-safe paginated response with metadata and data
 */
export function paginate<T>(
  data: T[],
  totalItems: number,
  options: PaginationOptions,
): PaginatedDto<T> {
  // Validate inputs
  if (!Array.isArray(data)) {
    throw new Error('Data must be an array');
  }
  if (!Number.isInteger(totalItems) || totalItems < 0) {
    throw new Error('Total items must be a non-negative integer');
  }

  // Calculate total pages using ceiling division
  const totalPages = Math.ceil(totalItems / options.pageSize);

  // Validate data array length
  if (data.length > options.pageSize) {
    throw new Error('Data array length exceeds page size');
  }

  // Construct paginated response
  return new PaginatedDto<T>({
    page: options.page,
    pageSize: options.pageSize,
    totalItems,
    totalPages,
    data,
  });
}

/**
 * Calculates optimized skip and take values for database queries
 * @param options - Pagination options containing page and pageSize
 * @returns Object containing optimized skip and take values
 */
export function getSkipTake(options: PaginationOptions): {
  skip: number;
  take: number;
} {
  // Validate options
  if (!options?.page || !options?.pageSize) {
    throw new Error('Invalid pagination options');
  }

  // Calculate skip value using zero-based indexing
  const skip = (options.page - 1) * options.pageSize;

  // Ensure take value respects MAX_PAGE_SIZE
  const take = Math.min(options.pageSize, MAX_PAGE_SIZE);

  return {
    skip,
    take,
  };
}

/**
 * Type guard to check if an object implements PaginationOptions
 * @param obj - Object to check
 * @returns Boolean indicating if object implements PaginationOptions
 */
export function isPaginationOptions(obj: any): obj is PaginationOptions {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    typeof obj.page === 'number' &&
    typeof obj.pageSize === 'number' &&
    obj.page >= MIN_PAGE &&
    obj.pageSize > 0 &&
    obj.pageSize <= MAX_PAGE_SIZE
  );
}

/**
 * Helper function to apply pagination to a TypeORM repository query
 * @template T - Entity type
 * @param repository - TypeORM repository
 * @param options - Pagination options
 * @returns Promise containing paginated data and total count
 */
export async function paginateRepository<T>(
  repository: Repository<T>,
  options: PaginationOptions,
): Promise<{ data: T[]; total: number }> {
  const { skip, take } = getSkipTake(options);

  const [data, total] = await repository.findAndCount({
    skip,
    take,
  });

  return {
    data,
    total,
  };
}