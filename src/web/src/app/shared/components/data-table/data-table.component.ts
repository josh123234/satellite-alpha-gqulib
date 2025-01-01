import { Component, ChangeDetectionStrategy, OnInit, OnDestroy, Input, Output, EventEmitter, ChangeDetectorRef } from '@angular/core';
import { Sort, MatSort } from '@angular/material/sort';
import { ScrollingModule, CdkVirtualScrollViewport } from '@angular/cdk/scrolling';
import { Subject, BehaviorSubject, Observable } from 'rxjs';
import { takeUntil, map, distinctUntilChanged } from 'rxjs/operators';

import { Subscription } from '../../models/subscription.model';
import { CurrencyFormatPipe } from '../../pipes/currency-format.pipe';
import { DateFormatPipe } from '../../pipes/date-format.pipe';
import { PaginationComponent } from '../pagination/pagination.component';

export interface ITableColumn {
  key: string;
  label: string;
  sortable?: boolean;
  type?: 'text' | 'number' | 'date' | 'currency' | 'status';
  format?: string;
  filterable?: boolean;
  width?: string;
  align?: 'left' | 'center' | 'right';
  formatter?: (value: any) => string;
  ariaLabel?: string;
}

export interface ITableConfig {
  columns: ITableColumn[];
  selectable?: boolean;
  sortable?: boolean;
  filterable?: boolean;
  pageable?: boolean;
  virtualScroll?: boolean;
  pageSize?: number;
  ariaLabel?: string;
  loading?: boolean;
  emptyStateMessage?: string;
}

@Component({
  selector: 'app-data-table',
  templateUrl: './data-table.component.html',
  styleUrls: ['./data-table.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [CurrencyFormatPipe, DateFormatPipe]
})
export class DataTableComponent implements OnInit, OnDestroy {
  @Input() set data(value: any[]) {
    this.dataSource$.next(value || []);
  }
  @Input() config!: ITableConfig;

  @Output() sortChange = new EventEmitter<Sort>();
  @Output() filterChange = new EventEmitter<string>();
  @Output() pageChange = new EventEmitter<number>();
  @Output() selectionChange = new EventEmitter<any[]>();
  @Output() rowClick = new EventEmitter<any>();

  selectedItems: any[] = [];
  filterValue: string = '';
  isLoading: boolean = false;
  
  private destroy$ = new Subject<void>();
  private dataSource$ = new BehaviorSubject<any[]>([]);
  visibleData$: Observable<any[]>;

  private formatters = new Map<string, (value: any) => string>();

  constructor(
    private cdr: ChangeDetectorRef,
    private currencyPipe: CurrencyFormatPipe,
    private datePipe: DateFormatPipe
  ) {
    this.visibleData$ = this.dataSource$.pipe(
      takeUntil(this.destroy$),
      distinctUntilChanged(),
      map(data => this.processData(data))
    );
  }

  ngOnInit(): void {
    this.validateConfig();
    this.initializeFormatters();
    this.setupKeyboardNavigation();
    
    if (this.config.virtualScroll) {
      this.initializeVirtualScroll();
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private validateConfig(): void {
    if (!this.config) {
      throw new Error('Table configuration is required');
    }
    if (!Array.isArray(this.config.columns) || this.config.columns.length === 0) {
      throw new Error('Table must have at least one column defined');
    }
  }

  private initializeFormatters(): void {
    this.config.columns.forEach(column => {
      switch (column.type) {
        case 'currency':
          this.formatters.set(column.key, (value: number) => 
            this.currencyPipe.transform(value));
          break;
        case 'date':
          this.formatters.set(column.key, (value: Date) => 
            this.datePipe.transform(value, column.format));
          break;
        case 'status':
          this.formatters.set(column.key, (value: string) => 
            this.formatStatus(value));
          break;
        default:
          if (column.formatter) {
            this.formatters.set(column.key, column.formatter);
          }
      }
    });
  }

  private formatStatus(status: string): string {
    return `<span class="status-badge status-${status.toLowerCase()}">${status}</span>`;
  }

  private processData(data: any[]): any[] {
    if (!data || !Array.isArray(data)) return [];

    let processed = [...data];

    if (this.filterValue && this.config.filterable) {
      processed = this.filterData(processed);
    }

    if (this.config.sortable && this.currentSort) {
      processed = this.sortData(processed);
    }

    return processed;
  }

  private filterData(data: any[]): any[] {
    const searchValue = this.filterValue.toLowerCase();
    return data.filter(item => 
      this.config.columns.some(column => {
        const value = item[column.key];
        if (value == null) return false;
        return String(value).toLowerCase().includes(searchValue);
      })
    );
  }

  private currentSort?: Sort;
  onSort(sort: Sort): void {
    this.currentSort = sort;
    this.sortChange.emit(sort);
    this.dataSource$.next(this.dataSource$.value);
    this.cdr.markForCheck();
  }

  private sortData(data: any[]): any[] {
    if (!this.currentSort) return data;

    const { active, direction } = this.currentSort;
    if (!direction) return data;

    return [...data].sort((a, b) => {
      const valueA = a[active];
      const valueB = b[active];
      
      if (valueA === valueB) return 0;
      const comparison = valueA < valueB ? -1 : 1;
      return direction === 'asc' ? comparison : -comparison;
    });
  }

  onFilter(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.filterValue = input.value;
    this.filterChange.emit(this.filterValue);
    this.dataSource$.next(this.dataSource$.value);
  }

  onSelectionChange(event: Event, item: any): void {
    const checkbox = event.target as HTMLInputElement;
    if (checkbox.checked) {
      this.selectedItems.push(item);
    } else {
      const index = this.selectedItems.indexOf(item);
      if (index > -1) {
        this.selectedItems.splice(index, 1);
      }
    }
    this.selectionChange.emit(this.selectedItems);
  }

  onRowClick(item: any): void {
    this.rowClick.emit(item);
  }

  getCellValue(item: any, column: ITableColumn): string {
    const value = item[column.key];
    const formatter = this.formatters.get(column.key);
    return formatter ? formatter(value) : String(value ?? '');
  }

  private setupKeyboardNavigation(): void {
    if (!this.config.sortable) return;

    const table = document.querySelector('table');
    if (!table) return;

    table.addEventListener('keydown', (event: KeyboardEvent) => {
      if (event.key === 'Enter' || event.key === ' ') {
        const target = event.target as HTMLElement;
        if (target.matches('th[sortable]')) {
          event.preventDefault();
          target.click();
        }
      }
    });
  }

  private initializeVirtualScroll(): void {
    const viewport = document.querySelector('cdk-virtual-scroll-viewport');
    if (!viewport) return;

    const itemSize = 48; // Default row height
    viewport.setAttribute('itemSize', String(itemSize));
  }

  isSelected(item: any): boolean {
    return this.selectedItems.includes(item);
  }

  getAriaSort(column: ITableColumn): string {
    if (!this.currentSort || !column.sortable) return 'none';
    return this.currentSort.active === column.key ? this.currentSort.direction : 'none';
  }

  getAriaLabel(column: ITableColumn): string {
    return column.ariaLabel || `Sort by ${column.label}`;
  }
}