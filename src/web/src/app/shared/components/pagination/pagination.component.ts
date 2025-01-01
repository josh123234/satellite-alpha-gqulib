import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy, OnInit } from '@angular/core';
import { roundToDecimals } from '../../utils/number.utils';

/**
 * Interface defining pagination configuration options
 */
export interface IPaginationConfig {
  totalItems: number;
  itemsPerPage: number;
  currentPage: number;
  pageSizeOptions: number[];
  showTotalPages?: boolean;
}

/**
 * A comprehensive, accessible pagination component that provides standardized
 * pagination controls for data tables and lists across the application.
 */
@Component({
  selector: 'app-pagination',
  templateUrl: './pagination.component.html',
  styleUrls: ['./pagination.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    'role': 'navigation',
    'aria-label': 'Pagination',
  }
})
export class PaginationComponent implements OnInit {
  @Input() config!: IPaginationConfig;
  @Output() pageChange = new EventEmitter<number>();
  @Output() pageSizeChange = new EventEmitter<number>();

  totalPages: number = 0;
  visiblePages: number[] = [];
  isLoading: boolean = false;

  // Constants for pagination display
  private readonly MAX_VISIBLE_PAGES = 5;
  private readonly ELLIPSIS = -1;

  constructor() {}

  ngOnInit(): void {
    this.validateConfig();
    this.calculateTotalPages();
    this.updateVisiblePages();
    this.initializeAriaAttributes();
  }

  /**
   * Validates the pagination configuration
   * @throws Error if configuration is invalid
   */
  private validateConfig(): void {
    if (!this.config) {
      throw new Error('Pagination configuration is required');
    }

    if (this.config.totalItems < 0) {
      throw new Error('Total items must be non-negative');
    }

    if (this.config.itemsPerPage <= 0) {
      throw new Error('Items per page must be positive');
    }

    if (this.config.currentPage <= 0) {
      throw new Error('Current page must be positive');
    }

    if (!Array.isArray(this.config.pageSizeOptions) || 
        !this.config.pageSizeOptions.every(size => size > 0)) {
      throw new Error('Page size options must be an array of positive numbers');
    }
  }

  /**
   * Calculates the total number of pages
   */
  private calculateTotalPages(): void {
    this.totalPages = Math.ceil(this.config.totalItems / this.config.itemsPerPage);
    this.totalPages = roundToDecimals(this.totalPages, 0);
  }

  /**
   * Updates the array of visible page numbers
   */
  private updateVisiblePages(): void {
    const { currentPage } = this.config;
    const pages: number[] = [];
    
    if (this.totalPages <= this.MAX_VISIBLE_PAGES) {
      // Show all pages if total pages is less than or equal to max visible pages
      for (let i = 1; i <= this.totalPages; i++) {
        pages.push(i);
      }
    } else {
      // Complex pagination with ellipsis
      const leftBound = Math.max(1, currentPage - Math.floor(this.MAX_VISIBLE_PAGES / 2));
      const rightBound = Math.min(this.totalPages, leftBound + this.MAX_VISIBLE_PAGES - 1);

      if (leftBound > 1) {
        pages.push(1);
        if (leftBound > 2) pages.push(this.ELLIPSIS);
      }

      for (let i = leftBound; i <= rightBound; i++) {
        pages.push(i);
      }

      if (rightBound < this.totalPages) {
        if (rightBound < this.totalPages - 1) pages.push(this.ELLIPSIS);
        pages.push(this.totalPages);
      }
    }

    this.visiblePages = pages;
  }

  /**
   * Initializes ARIA attributes for accessibility
   */
  private initializeAriaAttributes(): void {
    const element = document.querySelector('app-pagination');
    if (element) {
      element.setAttribute('aria-label', `Page ${this.config.currentPage} of ${this.totalPages}`);
    }
  }

  /**
   * Handles page change events
   * @param pageNumber - The new page number to navigate to
   */
  onPageChange(pageNumber: number): void {
    if (pageNumber === this.ELLIPSIS || pageNumber === this.config.currentPage) {
      return;
    }

    if (pageNumber < 1 || pageNumber > this.totalPages) {
      console.error('Invalid page number:', pageNumber);
      return;
    }

    this.isLoading = true;
    try {
      this.config.currentPage = pageNumber;
      this.updateVisiblePages();
      this.initializeAriaAttributes();
      this.pageChange.emit(pageNumber);
    } finally {
      this.isLoading = false;
    }
  }

  /**
   * Handles page size change events
   * @param newSize - The new page size
   */
  onPageSizeChange(newSize: number): void {
    if (!this.config.pageSizeOptions.includes(newSize)) {
      console.error('Invalid page size:', newSize);
      return;
    }

    this.isLoading = true;
    try {
      const firstItemIndex = (this.config.currentPage - 1) * this.config.itemsPerPage;
      this.config.itemsPerPage = newSize;
      this.config.currentPage = Math.floor(firstItemIndex / newSize) + 1;
      
      this.calculateTotalPages();
      this.updateVisiblePages();
      this.initializeAriaAttributes();
      
      this.pageSizeChange.emit(newSize);
      this.pageChange.emit(this.config.currentPage);
    } finally {
      this.isLoading = false;
    }
  }

  /**
   * Checks if a page number is the current page
   * @param page - The page number to check
   * @returns boolean indicating if the page is current
   */
  isCurrentPage(page: number): boolean {
    return page === this.config.currentPage;
  }

  /**
   * Checks if a page number is an ellipsis
   * @param page - The page number to check
   * @returns boolean indicating if the page is an ellipsis
   */
  isEllipsis(page: number): boolean {
    return page === this.ELLIPSIS;
  }

  /**
   * Gets the aria-label for a page button
   * @param page - The page number
   * @returns The aria-label string
   */
  getPageAriaLabel(page: number): string {
    if (this.isEllipsis(page)) {
      return 'More pages';
    }
    return `Go to page ${page}`;
  }

  /**
   * Checks if the previous page button should be disabled
   * @returns boolean indicating if previous is disabled
   */
  isPreviousDisabled(): boolean {
    return this.config.currentPage <= 1 || this.isLoading;
  }

  /**
   * Checks if the next page button should be disabled
   * @returns boolean indicating if next is disabled
   */
  isNextDisabled(): boolean {
    return this.config.currentPage >= this.totalPages || this.isLoading;
  }
}