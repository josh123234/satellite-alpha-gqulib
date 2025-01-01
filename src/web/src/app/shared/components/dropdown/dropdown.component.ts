import { 
  Component, 
  Input, 
  Output, 
  EventEmitter, 
  OnInit, 
  OnDestroy, 
  ChangeDetectorRef,
  ElementRef,
  ViewChild,
  ChangeDetectionStrategy
} from '@angular/core'; // @angular/core v17.x
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms'; // @angular/forms v17.x
import { Subject } from 'rxjs'; // rxjs v7.x
import { debounceTime, takeUntil } from 'rxjs/operators'; // rxjs v7.x
import { ScrollingModule } from '@angular/cdk/scrolling'; // @angular/cdk/scrolling v17.x
import { ClickOutsideDirective } from '../../directives/click-outside.directive';

/**
 * Enterprise-grade dropdown component with accessibility, virtual scrolling,
 * and mobile-optimized interactions.
 */
@Component({
  selector: 'app-dropdown',
  templateUrl: './dropdown.component.html',
  styleUrls: ['./dropdown.component.scss'],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: DropdownComponent,
      multi: true
    }
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DropdownComponent implements OnInit, OnDestroy, ControlValueAccessor {
  @Input() placeholder: string = 'Select an option';
  @Input() options: any[] = [];
  @Input() labelKey: string = 'label';
  @Input() valueKey: string = 'value';
  @Input() isMultiple: boolean = false;
  @Input() isSearchable: boolean = false;
  @Input() isDisabled: boolean = false;
  @Input() isLoading: boolean = false;

  @Output() selectionChange = new EventEmitter<any>();
  @Output() searchChange = new EventEmitter<string>();
  @Output() opened = new EventEmitter<void>();
  @Output() closed = new EventEmitter<void>();

  @ViewChild('dropdownContainer') dropdownContainer!: ElementRef;
  @ViewChild('searchInput') searchInput!: ElementRef;

  public value: any = this.isMultiple ? [] : null;
  public isOpen: boolean = false;
  public searchText: string = '';
  public filteredOptions: any[] = [];
  public selectedIndex: number = -1;

  private destroy$ = new Subject<void>();
  private search$ = new Subject<string>();
  private onChange: (value: any) => void = () => {};
  private onTouched: () => void = () => {};
  private resizeObserver: ResizeObserver;

  constructor(
    private cdr: ChangeDetectorRef,
    private elementRef: ElementRef
  ) {
    this.setupSearchDebounce();
    this.setupResizeObserver();
  }

  ngOnInit(): void {
    this.filteredOptions = [...this.options];
    this.setupKeyboardEvents();
    this.setupAccessibility();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.resizeObserver.disconnect();
  }

  private setupSearchDebounce(): void {
    this.search$
      .pipe(
        debounceTime(300),
        takeUntil(this.destroy$)
      )
      .subscribe(searchText => {
        this.searchChange.emit(searchText);
        this.filterOptions(searchText);
        this.cdr.markForCheck();
      });
  }

  private setupResizeObserver(): void {
    this.resizeObserver = new ResizeObserver(() => {
      if (this.isOpen) {
        this.updateDropdownPosition();
      }
    });
  }

  private setupKeyboardEvents(): void {
    this.elementRef.nativeElement.addEventListener('keydown', (event: KeyboardEvent) => {
      if (this.isDisabled) return;

      switch (event.key) {
        case 'Enter':
        case ' ':
          if (!this.isOpen) {
            this.open();
          } else if (this.selectedIndex >= 0) {
            this.selectOption(this.filteredOptions[this.selectedIndex]);
          }
          event.preventDefault();
          break;
        case 'ArrowDown':
          if (!this.isOpen) {
            this.open();
          } else {
            this.selectedIndex = Math.min(this.selectedIndex + 1, this.filteredOptions.length - 1);
            this.scrollToSelected();
          }
          event.preventDefault();
          break;
        case 'ArrowUp':
          if (this.isOpen) {
            this.selectedIndex = Math.max(this.selectedIndex - 1, 0);
            this.scrollToSelected();
          }
          event.preventDefault();
          break;
        case 'Escape':
          this.close();
          event.preventDefault();
          break;
      }
    });
  }

  private setupAccessibility(): void {
    const element = this.elementRef.nativeElement;
    element.setAttribute('role', 'combobox');
    element.setAttribute('aria-haspopup', 'listbox');
    element.setAttribute('aria-expanded', 'false');
    element.setAttribute('aria-controls', 'dropdown-list');
  }

  public onSearchInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.searchText = input.value;
    this.search$.next(this.searchText);
  }

  private filterOptions(searchText: string): void {
    if (!searchText.trim()) {
      this.filteredOptions = [...this.options];
      return;
    }

    this.filteredOptions = this.options.filter(option =>
      option[this.labelKey].toLowerCase().includes(searchText.toLowerCase())
    );
  }

  public selectOption(option: any): void {
    if (this.isMultiple) {
      const index = this.value.findIndex((item: any) => 
        item[this.valueKey] === option[this.valueKey]
      );
      
      if (index === -1) {
        this.value = [...this.value, option];
      } else {
        this.value = this.value.filter((_: any, i: number) => i !== index);
      }
    } else {
      this.value = option;
      this.close();
    }

    this.onChange(this.value);
    this.onTouched();
    this.selectionChange.emit(this.value);
    this.cdr.markForCheck();
  }

  public isSelected(option: any): boolean {
    if (this.isMultiple) {
      return this.value.some((item: any) => 
        item[this.valueKey] === option[this.valueKey]
      );
    }
    return this.value && this.value[this.valueKey] === option[this.valueKey];
  }

  public open(): void {
    if (this.isDisabled || this.isOpen) return;

    this.isOpen = true;
    this.opened.emit();
    this.updateDropdownPosition();
    
    if (this.isSearchable) {
      setTimeout(() => this.searchInput?.nativeElement?.focus(), 0);
    }

    this.elementRef.nativeElement.setAttribute('aria-expanded', 'true');
    this.cdr.markForCheck();
  }

  public close(): void {
    if (!this.isOpen) return;

    this.isOpen = false;
    this.searchText = '';
    this.selectedIndex = -1;
    this.filteredOptions = [...this.options];
    this.closed.emit();
    
    this.elementRef.nativeElement.setAttribute('aria-expanded', 'false');
    this.cdr.markForCheck();
  }

  private updateDropdownPosition(): void {
    if (!this.dropdownContainer) return;

    const containerRect = this.elementRef.nativeElement.getBoundingClientRect();
    const dropdownElement = this.dropdownContainer.nativeElement;
    const viewportHeight = window.innerHeight;
    const spaceBelow = viewportHeight - containerRect.bottom;
    const spaceAbove = containerRect.top;
    const dropdownHeight = dropdownElement.offsetHeight;

    if (spaceBelow < dropdownHeight && spaceAbove > spaceBelow) {
      dropdownElement.style.bottom = `${containerRect.height}px`;
      dropdownElement.style.top = 'auto';
    } else {
      dropdownElement.style.top = `${containerRect.height}px`;
      dropdownElement.style.bottom = 'auto';
    }
  }

  private scrollToSelected(): void {
    if (this.selectedIndex < 0) return;

    const listElement = this.dropdownContainer.nativeElement.querySelector('.dropdown-list');
    const selectedElement = listElement.children[this.selectedIndex];
    
    if (selectedElement) {
      selectedElement.scrollIntoView({ block: 'nearest' });
    }
  }

  // ControlValueAccessor Implementation
  writeValue(value: any): void {
    this.value = value;
    this.cdr.markForCheck();
  }

  registerOnChange(fn: any): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: any): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.isDisabled = isDisabled;
    this.cdr.markForCheck();
  }

  // Click Outside Handler
  onClickOutside(): void {
    this.close();
  }
}