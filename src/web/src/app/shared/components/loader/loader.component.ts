import { Component, Input, ChangeDetectionStrategy } from '@angular/core'; // @angular/core v17.x

/**
 * LoaderComponent provides a reusable, accessible loading indicator that follows
 * the design system specifications. It supports different sizes, colors, and an
 * overlay mode for blocking user interaction during loading states.
 * 
 * @example
 * <app-loader size="medium" color="primary"></app-loader>
 * <app-loader size="large" overlay="true"></app-loader>
 */
@Component({
  selector: 'app-loader',
  templateUrl: './loader.component.html',
  styleUrls: ['./loader.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class.loader--small]': 'size === "small"',
    '[class.loader--medium]': 'size === "medium"',
    '[class.loader--large]': 'size === "large"',
    '[class.loader--overlay]': 'overlay',
    '[attr.aria-busy]': 'true',
    '[attr.role]': '"progressbar"'
  }
})
export class LoaderComponent {
  /**
   * Size of the loader based on 8px design system unit
   * - small: 16px (2 units)
   * - medium: 24px (3 units)
   * - large: 32px (4 units)
   */
  @Input()
  size: 'small' | 'medium' | 'large' = 'medium';

  /**
   * Color of the loader using design system colors
   * - primary: #2563EB
   * - secondary: #3B82F6
   * - accent: #60A5FA
   */
  @Input()
  color: 'primary' | 'secondary' | 'accent' = 'primary';

  /**
   * Whether to show the loader with a blocking overlay
   */
  @Input()
  overlay = false;

  /**
   * Accessible label for screen readers
   */
  @Input()
  ariaLabel = 'Loading...';

  // Design system color mappings
  private readonly colorMap = {
    primary: '#2563EB',
    secondary: '#3B82F6',
    accent: '#60A5FA'
  };

  // Size mappings in pixels (based on 8px unit)
  private readonly sizeMap = {
    small: 16,
    medium: 24,
    large: 32
  };

  /**
   * Lifecycle hook to validate inputs and set up accessibility
   */
  ngOnInit(): void {
    this.validateInputs();
    this.setupAccessibility();
  }

  /**
   * Validates that inputs match allowed values
   * @private
   */
  private validateInputs(): void {
    if (!this.sizeMap[this.size]) {
      console.warn(`Invalid loader size: ${this.size}. Using default: medium`);
      this.size = 'medium';
    }

    if (!this.colorMap[this.color]) {
      console.warn(`Invalid loader color: ${this.color}. Using default: primary`);
      this.color = 'primary';
    }
  }

  /**
   * Sets up ARIA attributes for accessibility
   * @private
   */
  private setupAccessibility(): void {
    // Role and aria-busy are set via host bindings
    if (!this.ariaLabel) {
      this.ariaLabel = 'Loading...';
    }
  }

  /**
   * Gets the computed size in pixels based on the size input
   * @returns number Size in pixels
   */
  get computedSize(): number {
    return this.sizeMap[this.size];
  }

  /**
   * Gets the computed color based on the color input
   * @returns string Color hex code
   */
  get computedColor(): string {
    return this.colorMap[this.color];
  }
}