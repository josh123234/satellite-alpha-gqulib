import { 
  Component, 
  Input, 
  Output, 
  EventEmitter, 
  ChangeDetectionStrategy 
} from '@angular/core'; // @angular/core v17.x

@Component({
  selector: 'app-card',
  templateUrl: './card.component.html',
  styleUrls: ['./card.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CardComponent {
  /**
   * Controls the visual variant of the card.
   * Default variant uses 2px elevation, while dialog variant uses 4px elevation
   * per design system specifications.
   */
  @Input() variant: string = 'default';

  /**
   * Enables interactive mode which adds hover states and click handling.
   * When true, the card will emit click events and show hover effects.
   */
  @Input() interactive: boolean = false;

  /**
   * Controls the loading state of the card.
   * When true, displays a loading indicator and may disable interactions.
   */
  @Input() loading: boolean = false;

  /**
   * Event emitter for card click events when in interactive mode.
   * Only emits if interactive property is true.
   */
  @Output() cardClick: EventEmitter<void> = new EventEmitter<void>();

  /**
   * Handles click events on the card component.
   * Only processes clicks when interactive mode is enabled.
   * 
   * @param event The DOM click event
   */
  onClick(event: Event): void {
    if (this.interactive) {
      event.stopPropagation();
      this.cardClick.emit();
    }
  }

  /**
   * Generates the CSS classes for the card based on its current configuration.
   * Implements design system specifications for elevation, spacing, and states.
   * 
   * @returns An object containing class names mapped to boolean values
   */
  getCardClasses(): { [key: string]: boolean } {
    return {
      'card': true, // Base class with 8px base unit spacing
      'card--default': this.variant === 'default', // 2px elevation
      'card--dialog': this.variant === 'dialog', // 4px elevation
      'card--interactive': this.interactive, // Adds hover states
      'card--loading': this.loading, // Shows loading state
      'card--mobile': window.innerWidth < 640, // Mobile responsive adjustments
      'card--tablet': window.innerWidth >= 641 && window.innerWidth <= 1024, // Tablet responsive adjustments
      'card--desktop': window.innerWidth > 1024 // Desktop responsive adjustments
    };
  }
}