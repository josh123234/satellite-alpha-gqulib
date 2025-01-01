import { Directive, ElementRef, Input, OnChanges, SimpleChanges } from '@angular/core'; // v17.0.0
import { sanitizeSearchTerm } from './utils/string.utils';

@Directive({
  selector: '[appHighlight]'
})
export class HighlightDirective implements OnChanges {
  @Input() searchTerm: string = '';
  @Input() highlightClass: string = 'highlight-text';

  private originalContent: string;
  private searchPattern: RegExp | null = null;
  private readonly debounceTime: number = 150;
  private debounceTimer: any;

  constructor(private el: ElementRef) {
    this.originalContent = this.el.nativeElement.innerHTML;
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['searchTerm']) {
      // Clear existing timer
      if (this.debounceTimer) {
        clearTimeout(this.debounceTimer);
      }

      // Store original content on first change if not already stored
      if (!this.originalContent) {
        this.originalContent = this.el.nativeElement.innerHTML;
      }

      // Debounce highlight updates
      this.debounceTimer = setTimeout(() => {
        try {
          const term = this.searchTerm?.trim();
          
          if (!term) {
            // Restore original content if search term is empty
            this.el.nativeElement.innerHTML = this.originalContent;
            return;
          }

          const sanitizedTerm = sanitizeSearchTerm(term);
          const content = this.originalContent;
          
          // Apply highlighting
          const highlightedContent = this.highlight(content, sanitizedTerm);
          this.el.nativeElement.innerHTML = highlightedContent;
        } catch (error) {
          console.error('Error applying highlight:', error);
          // Restore original content on error
          this.el.nativeElement.innerHTML = this.originalContent;
        }
      }, this.debounceTime);
    }
  }

  /**
   * Applies highlighting to text content with security and performance optimizations
   * @param content - Original content to highlight
   * @param term - Sanitized search term
   * @returns Safely highlighted HTML content
   */
  private highlight(content: string, term: string): string {
    if (!content || !term) {
      return content;
    }

    try {
      // Create or reuse case-insensitive pattern
      if (!this.searchPattern || this.searchPattern.source !== this.escapeRegExp(term)) {
        this.searchPattern = new RegExp(`(${this.escapeRegExp(term)})`, 'gi');
      }

      // Replace matches with highlighted spans
      return content.replace(this.searchPattern, (match) => {
        return `<span class="${this.highlightClass}" 
                      role="mark" 
                      aria-label="Highlighted text: ${match}"
                      data-highlight="${this.encodeAttribute(match)}">
                  ${match}
                </span>`;
      });
    } catch (error) {
      console.error('Error in highlight function:', error);
      return content;
    }
  }

  /**
   * Escapes special characters in search term for RegExp
   * @param term - Search term to escape
   * @returns Escaped string safe for RegExp
   */
  private escapeRegExp(term: string): string {
    return term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * Encodes attribute value to prevent XSS
   * @param value - Value to encode
   * @returns Safely encoded attribute value
   */
  private encodeAttribute(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }
}