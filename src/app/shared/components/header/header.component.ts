import { Component, input, inject } from '@angular/core';
import { IonicModule } from '@ionic/angular';
import { ThemeService } from '../../../core/services/theme.service';

/**
 * Header Component
 * 
 * Global header with organization branding (dynamic from ThemeService).
 * 
 * Features:
 * - Organization logo (dynamic from theme)
 * - Application title
 * - Responsive design (desktop + tablet + mobile)
 * - Multi-tenant support via ThemeService
 * 
 * @component
 * @standalone
 */
@Component({
  selector: 'app-header',
  standalone: true,
  imports: [IonicModule],
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.scss']
})
export class HeaderComponent {
  // ── Dependencies ──
  readonly themeService = inject(ThemeService);

  // ── Inputs ──
  
  /**
   * Optional title override
   * Default: brand name from theme
   */
  title = input<string | null>(null);

  /**
   * Show/hide logo
   * Default: true
   */
  showLogo = input<boolean>(true);

  // ── Computed ──
  
  /**
   * Effective title (input or theme brand name)
   */
  get effectiveTitle(): string {
    return this.title() || this.themeService.brandName();
  }

  /**
   * Logo URL from theme
   */
  get logoUrl(): string {
    return this.themeService.logoUrl();
  }
}
