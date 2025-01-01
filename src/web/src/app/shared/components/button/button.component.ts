import { 
  Component, 
  ChangeDetectionStrategy, 
  OnDestroy,
  Input,
  Output,
  EventEmitter
} from '@angular/core'; // @angular/core v17.x

type ButtonVariant = 'primary' | 'secondary' | 'accent' | 'error';
type ButtonSize = 'sm' | 'md' | 'lg';

@Component({
  selector: 'app-button',
  templateUrl: './button.component.html',
  styleUrls: ['./button.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    'role': 'button',
    '[attr.aria-disabled]': 'disabled',
    '[attr.aria-busy]': 'loading',
    '[class.app-button--block]': 'block',
    '[tabindex]': 'disabled ? -1 : 0'
  }
})
export class ButtonComponent implements OnDestroy {
  /**
   * Button style variant based on design system
   * @default 'primary'
   */
  @Input() variant: ButtonVariant = 'primary';

  /**
   * Button size following 8px base unit system
   * @default 'md'
   */
  @Input() size: ButtonSize = 'md';

  /**
   * Disabled state of the button
   * @default false
   */
  @Input() disabled = false;

  /**
   * Loading state with spinner animation
   * @default false
   */
  @Input() loading = false;

  /**
   * Full width block display mode
   * @default false
   */
  @Input() block = false;

  /**
   * Click event emitter
   */
  @Output() clicked = new EventEmitter<void>();

  // Ripple animation properties
  isRippleActive = false;
  rippleX = 0;
  rippleY = 0;
  private rippleTimeout?: number;

  constructor() {
    // Initialize with default accessibility attributes
    this.setAccessibilityDefaults();
  }

  /**
   * Handles button click events and ripple animation
   * @param event Mouse event from click
   */
  onClick(event: MouseEvent): void {
    // Don't process click if button is disabled or loading
    if (this.disabled || this.loading) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }

    // Calculate ripple position
    const rect = (event.target as HTMLElement).getBoundingClientRect();
    this.rippleX = event.clientX - rect.left;
    this.rippleY = event.clientY - rect.top;

    // Trigger ripple animation
    this.isRippleActive = true;
    
    // Clear previous timeout if exists
    if (this.rippleTimeout) {
      window.clearTimeout(this.rippleTimeout);
    }

    // Reset ripple after animation
    this.rippleTimeout = window.setTimeout(() => {
      this.isRippleActive = false;
    }, 600); // Match ripple animation duration

    // Emit click event
    this.clicked.emit();
  }

  /**
   * Generates CSS classes based on component state
   * @returns Object with CSS classes
   */
  getButtonClasses(): { [key: string]: boolean } {
    return {
      'app-button': true,
      [`app-button--${this.variant}`]: true,
      [`app-button--${this.size}`]: true,
      'app-button--disabled': this.disabled,
      'app-button--loading': this.loading,
      'app-button--block': this.block,
      'app-button--ripple': this.isRippleActive
    };
  }

  /**
   * Get ripple style for animation
   * @returns Ripple style object
   */
  getRippleStyle(): { [key: string]: string } {
    return {
      left: `${this.rippleX}px`,
      top: `${this.rippleY}px`
    };
  }

  /**
   * Sets default accessibility attributes
   */
  private setAccessibilityDefaults(): void {
    // ARIA labels based on state
    if (this.loading) {
      this.setLoadingAttributes();
    }
  }

  /**
   * Sets loading state ARIA attributes
   */
  private setLoadingAttributes(): void {
    // Add loading state announcements for screen readers
    const loadingText = 'Loading, please wait';
    this.setAriaLabel(loadingText);
  }

  /**
   * Sets ARIA label for accessibility
   * @param label ARIA label text
   */
  private setAriaLabel(label: string): void {
    // Implementation would be handled in template
  }

  /**
   * Cleanup on component destruction
   */
  ngOnDestroy(): void {
    // Clear any active timeouts
    if (this.rippleTimeout) {
      window.clearTimeout(this.rippleTimeout);
    }

    // Complete event emitter
    this.clicked.complete();
  }

  /**
   * Keyboard event handler for accessibility
   * @param event Keyboard event
   */
  onKeyDown(event: KeyboardEvent): void {
    // Handle enter and space for button activation
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      if (!this.disabled && !this.loading) {
        this.clicked.emit();
      }
    }
  }
}