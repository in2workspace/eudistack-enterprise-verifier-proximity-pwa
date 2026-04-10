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
  public readonly currentYear = new Date().getFullYear();

  /**
   * Legal links configuration
   */
  public readonly legalLinks = [
    {
      label: 'Política de Privacidad',
      url: '/privacy',
      external: false
    },
    {
      label: 'Términos de Uso',
      url: '/terms',
      external: false
    }
  ];

  /**
   * Handle link click
   * 
   * @param url - Link URL
   * @param external - Open in new tab if true
   */
  public onLinkClick(url: string, external: boolean): void {
    if (external) {
      window.open(url, '_blank', 'noopener,noreferrer');
    } else {
      window.location.href = url;
    }
  }
}
