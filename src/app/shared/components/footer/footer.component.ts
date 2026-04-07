import { Component } from '@angular/core';
import { IonicModule } from '@ionic/angular';
import { CommonModule } from '@angular/common';

/**
 * Footer Component
 * 
 * Global footer with legal links and copyright.
 * 
 * Features:
 * - Legal links (Privacy Policy, Terms of Service)
 * - Copyright notice
 * - Responsive design
 * 
 * @component
 * @standalone
 */
@Component({
  selector: 'app-footer',
  standalone: true,
  imports: [IonicModule, CommonModule],
  templateUrl: './footer.component.html',
  styleUrls: ['./footer.component.scss']
})
export class FooterComponent {
  readonly currentYear = new Date().getFullYear();

  /**
   * Legal links configuration
   */
  readonly legalLinks = [
    {
      label: 'Política de Privacidad',
      url: 'https://kpmg.com/privacy',
      external: true
    },
    {
      label: 'Términos de Uso',
      url: 'https://kpmg.com/terms',
      external: true
    }
  ];

  /**
   * Handle link click
   * 
   * @param url - Link URL
   * @param external - Open in new tab if true
   */
  onLinkClick(url: string, external: boolean): void {
    if (external) {
      window.open(url, '_blank', 'noopener,noreferrer');
    } else {
      window.location.href = url;
    }
  }
}
