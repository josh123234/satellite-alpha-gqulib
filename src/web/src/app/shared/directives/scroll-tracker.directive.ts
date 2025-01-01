import { 
  Directive, 
  ElementRef, 
  EventEmitter, 
  Input, 
  OnDestroy, 
  OnInit, 
  Output 
} from '@angular/core'; // @angular/core v17.x
import { fromEvent, Subject } from 'rxjs'; // rxjs v7.x
import { debounceTime, takeUntil } from 'rxjs/operators'; // rxjs/operators v7.x

/**
 * High-performance scroll tracking directive optimized for handling large subscription lists
 * and implementing infinite scrolling patterns in the SaaS Management Platform.
 * 
 * Features:
 * - Configurable scroll threshold (default 80%)
 * - Debounced event handling for optimal performance
 * - Automatic resource cleanup
 * - Safe scroll calculations with error handling
 * 
 * @example
 * <div appScrollTracker 
 *      [threshold]="90" 
 *      (scrolledToThreshold)="loadMoreData()">
 *   <!-- Content -->
 * </div>
 */
@Directive({
  selector: '[appScrollTracker]'
})
export class ScrollTrackerDirective implements OnInit, OnDestroy {
  /**
   * Configurable scroll threshold percentage (0-100)
   * Default: 80%
   */
  @Input() threshold = 80;

  /**
   * Event emitted when scroll position reaches the configured threshold
   */
  @Output() scrolledToThreshold = new EventEmitter<void>();

  /**
   * Subject for managing subscription cleanup
   */
  private readonly destroy$ = new Subject<void>();

  /**
   * Creates an instance of ScrollTrackerDirective.
   * @param el Reference to the host DOM element
   * @throws Error if ElementRef is not properly injected
   */
  constructor(private el: ElementRef) {
    if (!this.el?.nativeElement) {
      throw new Error('ScrollTrackerDirective requires a valid ElementRef');
    }
  }

  /**
   * Initializes scroll event tracking with performance optimizations
   */
  ngOnInit(): void {
    // Create and configure the scroll event observable
    fromEvent(this.el.nativeElement, 'scroll')
      .pipe(
        // Optimize performance by limiting event emission frequency
        debounceTime(100),
        // Ensure proper cleanup on directive destruction
        takeUntil(this.destroy$)
      )
      .subscribe({
        next: () => {
          if (this.isScrolledToThreshold()) {
            this.scrolledToThreshold.emit();
          }
        },
        error: (error) => {
          console.error('Error in scroll tracking:', error);
        }
      });
  }

  /**
   * Performs thorough cleanup of subscriptions and resources
   */
  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.scrolledToThreshold.complete();
  }

  /**
   * Calculates if the current scroll position has reached the configured threshold
   * @returns boolean indicating if threshold is reached
   */
  private isScrolledToThreshold(): boolean {
    try {
      const element = this.el.nativeElement;
      
      // Get current scroll metrics
      const scrollTop = element.scrollTop;
      const scrollHeight = element.scrollHeight;
      const clientHeight = element.clientHeight;

      // Guard against invalid scroll values
      if (!scrollHeight || !clientHeight || scrollHeight <= clientHeight) {
        return false;
      }

      // Calculate the maximum scrollable distance
      const scrollableDistance = scrollHeight - clientHeight;
      
      // Convert threshold percentage to actual scroll position
      const thresholdPosition = (scrollableDistance * this.threshold) / 100;

      // Check if current scroll position exceeds threshold
      return scrollTop >= thresholdPosition;
    } catch (error) {
      console.error('Error calculating scroll threshold:', error);
      return false;
    }
  }
}