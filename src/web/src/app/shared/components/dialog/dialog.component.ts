import { 
  Component, 
  Input, 
  Output, 
  EventEmitter, 
  ChangeDetectionStrategy 
} from '@angular/core'; // @angular/core v17.x
import { 
  MatDialogRef, 
  MAT_DIALOG_DATA 
} from '@angular/material/dialog'; // @angular/material/dialog v17.x
import { ButtonComponent } from '../button/button.component';

export interface DialogAction {
  label: string;
  value: string;
  color?: string;
  closeOnClick?: boolean;
  callback?: Function;
  ariaLabel?: string;
  icon?: string;
  testId?: string;
}

@Component({
  selector: 'app-dialog',
  templateUrl: './dialog.component.html',
  styleUrls: ['./dialog.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DialogComponent {
  // Configurable inputs
  @Input() title: string = '';
  @Input() message: string = '';
  @Input() data: any;
  @Input() showCloseButton: boolean = true;
  @Input() actions: DialogAction[] = [];
  @Input() size: 'sm' | 'md' | 'lg' = 'md';
  @Input() fullScreen: boolean = false;
  @Input() preventClose: boolean = false;
  @Input() customClass: string = '';

  // Event emitters
  @Output() actionClick = new EventEmitter<any>();
  @Output() close = new EventEmitter<void>();

  // Track focused element for restoration
  private previouslyFocusedElement: HTMLElement | null = null;

  constructor(
    private dialogRef: MatDialogRef<DialogComponent>,
    private data: any
  ) {
    // Store previously focused element
    this.previouslyFocusedElement = document.activeElement as HTMLElement;

    // Initialize dialog with data if provided
    if (this.data) {
      this.title = this.data.title || this.title;
      this.message = this.data.message || this.message;
      this.actions = this.data.actions || this.actions;
      this.size = this.data.size || this.size;
      this.fullScreen = this.data.fullScreen || this.fullScreen;
      this.preventClose = this.data.preventClose || this.preventClose;
      this.customClass = this.data.customClass || this.customClass;
    }

    // Configure dialog close behavior
    this.dialogRef.disableClose = this.preventClose;
    
    // Handle escape key and backdrop clicks
    this.dialogRef.backdropClick().subscribe(() => {
      if (!this.preventClose) {
        this.onClose();
      }
    });
  }

  /**
   * Handles dialog action button clicks
   * @param action The clicked action configuration
   */
  onActionClick(action: DialogAction): void {
    try {
      // Emit action click event
      this.actionClick.emit({ action, data: this.data });

      // Execute callback if provided
      if (action.callback) {
        action.callback(action);
      }

      // Close dialog if configured
      if (action.closeOnClick !== false) {
        this.onClose();
      }
    } catch (error) {
      console.error('Error handling dialog action:', error);
    } finally {
      // Restore focus
      this.restoreFocus();
    }
  }

  /**
   * Handles dialog close
   */
  onClose(): void {
    try {
      // Emit close event
      this.close.emit();
      
      // Close dialog
      this.dialogRef.close();
    } finally {
      // Restore focus
      this.restoreFocus();
    }
  }

  /**
   * Gets CSS classes for dialog container
   */
  getDialogClasses(): { [key: string]: boolean } {
    return {
      'app-dialog': true,
      [`app-dialog--${this.size}`]: true,
      'app-dialog--fullscreen': this.fullScreen,
      [this.customClass]: !!this.customClass
    };
  }

  /**
   * Gets button variant based on action color
   */
  getButtonVariant(action: DialogAction): 'primary' | 'secondary' | 'accent' | 'error' {
    switch (action.color) {
      case 'primary':
        return 'primary';
      case 'secondary':
        return 'secondary';
      case 'error':
        return 'error';
      default:
        return 'accent';
    }
  }

  /**
   * Restores focus to previously focused element
   */
  private restoreFocus(): void {
    if (this.previouslyFocusedElement && 'focus' in this.previouslyFocusedElement) {
      this.previouslyFocusedElement.focus();
    }
  }

  /**
   * Handles keyboard events for accessibility
   */
  onKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Escape' && !this.preventClose) {
      event.preventDefault();
      this.onClose();
    }
  }

  /**
   * Gets ARIA label for action button
   */
  getActionAriaLabel(action: DialogAction): string {
    return action.ariaLabel || `${action.label} dialog action`;
  }

  /**
   * Gets test ID for action button
   */
  getActionTestId(action: DialogAction): string {
    return action.testId || `dialog-action-${action.value}`;
  }
}