import { 
  Component, 
  Input, 
  Output, 
  EventEmitter, 
  ChangeDetectionStrategy 
} from '@angular/core'; // @angular/core v17.x
import { 
  animate, 
  style, 
  transition, 
  trigger 
} from '@angular/animations'; // @angular/animations v17.x
import { CardComponent } from '@shared/components/card/card.component';
import { IAnalyticsMetric, MetricType } from '@shared/models/analytics.model';

/**
 * Interface defining the structure of AI-generated insights
 */
interface AIInsightDTO {
  id: string;
  type: 'cost' | 'usage' | 'security' | 'optimization';
  title: string;
  description: string;
  metrics?: IAnalyticsMetric[];
  potentialSavings?: number;
  priority: 'high' | 'medium' | 'low';
  timestamp: Date;
}

/**
 * Animation trigger for smooth card transitions
 */
const fadeInOut = trigger('fadeInOut', [
  transition(':enter', [
    style({ opacity: 0, transform: 'translateY(-10px)' }),
    animate('200ms ease-out', style({ opacity: 1, transform: 'translateY(0)' }))
  ]),
  transition(':leave', [
    animate('200ms ease-in', style({ opacity: 0, transform: 'translateY(-10px)' }))
  ])
]);

/**
 * Component for displaying AI-generated insights with interactive capabilities
 * Implements the design specifications from section 6.4 AI Assistant Interface
 */
@Component({
  selector: 'app-insight-card',
  templateUrl: './insight-card.component.html',
  styleUrls: ['./insight-card.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  animations: [fadeInOut]
})
export class InsightCardComponent {
  /**
   * Input property for the AI-generated insight data
   */
  @Input() insight!: AIInsightDTO;

  /**
   * Controls the expanded state of the card
   */
  @Input() expanded: boolean = false;

  /**
   * Event emitter for when user clicks the "Take Action" button
   */
  @Output() takeAction = new EventEmitter<void>();

  /**
   * Event emitter for when user dismisses the insight
   */
  @Output() dismiss = new EventEmitter<void>();

  /**
   * Event emitter for when user clicks to view more details
   */
  @Output() viewDetails = new EventEmitter<void>();

  /**
   * Maps insight types to their corresponding Material icons
   */
  private readonly iconMap: Record<AIInsightDTO['type'], string> = {
    cost: 'savings',
    usage: 'trending_up',
    security: 'security',
    optimization: 'tune'
  };

  /**
   * Returns the appropriate Material icon based on insight type
   */
  getInsightIcon(): string {
    if (!this.insight?.type) {
      return 'info';
    }
    return this.iconMap[this.insight.type] || 'info';
  }

  /**
   * Formats potential savings amount with proper currency localization
   * @param amount - The amount to format
   */
  formatSavings(amount: number): string {
    if (typeof amount !== 'number') {
      return '$0.00';
    }
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  }

  /**
   * Formats metric values based on their type
   * @param metric - The analytics metric to format
   */
  formatMetric(metric: IAnalyticsMetric): string {
    if (!metric) return '';

    switch (metric.metricType) {
      case MetricType.COST:
        return this.formatSavings(metric.value);
      case MetricType.LICENSE_USAGE:
        return `${metric.value}%`;
      default:
        return metric.value.toString();
    }
  }

  /**
   * Handles the take action button click
   */
  onTakeAction(): void {
    if (!this.insight) return;
    
    // Log the interaction for analytics
    console.log(`Taking action on insight: ${this.insight.id}`);
    
    this.takeAction.emit();
  }

  /**
   * Handles the dismiss button click with animation
   */
  onDismiss(): void {
    if (!this.insight) return;

    // Log the dismissal for analytics
    console.log(`Dismissing insight: ${this.insight.id}`);
    
    this.dismiss.emit();
  }

  /**
   * Handles the view details button click
   */
  onViewDetails(): void {
    if (!this.insight) return;

    // Toggle expanded state
    this.expanded = !this.expanded;
    
    // Log the interaction for analytics
    console.log(`Viewing details for insight: ${this.insight.id}`);
    
    this.viewDetails.emit();
  }

  /**
   * Returns CSS classes for priority-based styling
   */
  getPriorityClasses(): { [key: string]: boolean } {
    if (!this.insight) return { 'priority-default': true };

    return {
      'priority-high': this.insight.priority === 'high',
      'priority-medium': this.insight.priority === 'medium',
      'priority-low': this.insight.priority === 'low'
    };
  }

  /**
   * Checks if the insight has associated metrics
   */
  hasMetrics(): boolean {
    return !!this.insight?.metrics && this.insight.metrics.length > 0;
  }

  /**
   * Returns the relative time since the insight was generated
   */
  getRelativeTime(): string {
    if (!this.insight?.timestamp) return '';
    
    const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
    const diff = new Date().getTime() - new Date(this.insight.timestamp).getTime();
    const minutes = Math.floor(diff / 60000);
    
    if (minutes < 60) {
      return rtf.format(-minutes, 'minute');
    }
    
    const hours = Math.floor(minutes / 60);
    if (hours < 24) {
      return rtf.format(-hours, 'hour');
    }
    
    const days = Math.floor(hours / 24);
    return rtf.format(-days, 'day');
  }
}