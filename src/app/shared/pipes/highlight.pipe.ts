import { inject, Pipe, PipeTransform } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

@Pipe({
  name: 'highlight',
  standalone: true,
})
export class HighlightPipe implements PipeTransform {
  private sanitizer = inject(DomSanitizer);

  transform(value: string, searchTerm: string): SafeHtml {
    if (!searchTerm || !value) {
      return value;
    }

    // Escape special regex characters in search term
    const escapedSearchTerm = searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    // Create case-insensitive regex to find all matches
    const regex = new RegExp(`(${escapedSearchTerm})`, 'gi');

    // Replace matches with highlighted version
    const highlighted = value.replace(regex, '<span class="bg-yellow-200 font-semibold">$1</span>');

    return this.sanitizer.bypassSecurityTrustHtml(highlighted);
  }
}
