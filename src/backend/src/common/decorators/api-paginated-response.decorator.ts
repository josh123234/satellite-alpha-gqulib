import { applyDecorators, Type } from '@nestjs/common'; // @nestjs/common v10.x
import { ApiOkResponse, ApiProperty } from '@nestjs/swagger'; // @nestjs/swagger v7.x

/**
 * Interface defining pagination request parameters
 */
export interface PaginationOptions {
  /** Current page number (1-based indexing) */
  page: number;
  
  /** Number of items per page */
  pageSize: number;
}

/**
 * Generic class representing a paginated response with metadata
 * @template T - Type of items in the data array
 */
export class PaginatedDto<T> {
  /** Current page number (1-based indexing) */
  @ApiProperty({
    description: 'Current page number',
    type: Number,
    example: 1,
    minimum: 1,
  })
  page: number;

  /** Number of items per page */
  @ApiProperty({
    description: 'Number of items per page',
    type: Number,
    example: 10,
    minimum: 1,
  })
  pageSize: number;

  /** Total number of items across all pages */
  @ApiProperty({
    description: 'Total number of items across all pages',
    type: Number,
    example: 100,
  })
  totalItems: number;

  /** Total number of available pages */
  @ApiProperty({
    description: 'Total number of available pages',
    type: Number,
    example: 10,
  })
  totalPages: number;

  /** Array of items for the current page */
  @ApiProperty({
    description: 'Array of items for the current page',
    isArray: true,
  })
  data: T[];

  constructor(partial: Partial<PaginatedDto<T>>) {
    this.page = partial.page || 1;
    this.pageSize = partial.pageSize || 10;
    this.totalItems = partial.totalItems || 0;
    this.totalPages = Math.ceil(this.totalItems / this.pageSize);
    this.data = partial.data || [];
  }
}

/**
 * Decorator factory that generates OpenAPI/Swagger documentation for paginated API responses
 * @template T - DTO type for the items in the response data array
 * @param dataDto - Class reference for the DTO type
 * @returns MethodDecorator - Combined decorator for documenting paginated responses
 * 
 * @example
 * ```typescript
 * @ApiPaginatedResponse(UserDto)
 * async findAll(@Query() options: PaginationOptions): Promise<PaginatedDto<UserDto>> {
 *   // Implementation
 * }
 * ```
 */
export function ApiPaginatedResponse<T>(dataDto: Type<T>): MethodDecorator {
  class PageDto extends PaginatedDto<T> {
    @ApiProperty({
      description: 'Array of paginated items',
      type: dataDto,
      isArray: true,
    })
    declare data: T[];
  }

  return applyDecorators(
    ApiOkResponse({
      description: 'Successful paginated response',
      type: PageDto,
    })
  );
}