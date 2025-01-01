import { 
  Directive, 
  ElementRef, 
  EventEmitter, 
  HostListener, 
  Output, 
  OnDestroy 
} from '@angular/core'; // @angular/core v17.x

/**
 * Directive that detects clicks outside of a host element and emits an event.
 * Provides enhanced control through enable/disable functionality and improved element boundary detection.
 * 
 * @example
 * <div appClickOutside (clickOutside)="onClickOutside()">Content</div>
 */
@Directive({
  selector: '[appClickOutside]'
})
export class ClickOutsideDirective implements OnDestroy {
  /**
   * Event emitter that fires when a click is detected outside the host element.
   */
  @Output()
  public clickOutside: EventEmitter<void> = new EventEmitter<void>();

  /**
   * Flag to control whether the directive is actively detecting clicks.
   * Can be toggled using enable() and disable() methods.
   */
  private isEnabled: boolean = true;

  /**
   * Reference to the host element for boundary detection.
   */
  private readonly elementRef: ElementRef<HTMLElement>;

  constructor(elementRef: ElementRef<HTMLElement>) {
    this.elementRef = elementRef;
  }

  /**
   * Listens for clicks on the document and determines if they occurred outside
   * the host element's boundaries. Emits an event if a click outside is detected
   * and the directive is enabled.
   * 
   * @param event - The click event from the document
   */
  @HostListener('document:click', ['$event'])
  public onClick(event: Event): void {
    if (!this.isEnabled) {
      return;
    }

    const targetElement = event.target as HTMLElement | null;
    
    if (!targetElement) {
      return;
    }

    // Check if click target is within the host element's boundaries
    const isClickedInside = this.isWithinElementBoundary(targetElement);

    if (!isClickedInside) {
      this.clickOutside.emit();
    }
  }

  /**
   * Checks if a given element is within the boundaries of the host element.
   * Handles nested elements and shadow DOM scenarios.
   * 
   * @param element - The element to check
   * @returns boolean indicating if the element is within boundaries
   */
  private isWithinElementBoundary(element: HTMLElement): boolean {
    // Handle shadow DOM scenarios
    if (this.elementRef.nativeElement.shadowRoot) {
      return this.elementRef.nativeElement.shadowRoot.contains(element);
    }

    // Check if the element or any of its parents is the host element
    let currentElement: HTMLElement | null = element;
    
    while (currentElement) {
      if (currentElement === this.elementRef.nativeElement) {
        return true;
      }
      currentElement = currentElement.parentElement;
    }

    return false;
  }

  /**
   * Enables click outside detection.
   * Use this method to resume click detection after disabling.
   */
  public enable(): void {
    this.isEnabled = true;
  }

  /**
   * Disables click outside detection.
   * Use this method to temporarily suspend click detection.
   */
  public disable(): void {
    this.isEnabled = false;
  }

  /**
   * Cleanup method to prevent memory leaks.
   * Automatically called by Angular when the directive is destroyed.
   */
  public ngOnDestroy(): void {
    this.clickOutside.complete();
  }
}