import { Component, input } from '@angular/core';
import { IonicModule } from '@ionic/angular';

/**
 * Header Component
 * 
 * Global header with organization branding (configurable via theme.json).
 * 
 * Features:
 * - Organization logo (configurable)
 * - Application title
 * - Responsive design (desktop + tablet + mobile)
 * - Ionic toolbar with brand colors from theme
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
  /**
   * Optional title override
   * Default: "Verificador de Credenciales"
   */
  title = input<string>('Verificador de Credenciales');

  /**
   * Show/hide logo
   * Default: true
   */
  showLogo = input<boolean>(true);
}
