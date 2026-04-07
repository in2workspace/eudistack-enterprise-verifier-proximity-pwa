import { Component, input } from '@angular/core';
import { IonicModule } from '@ionic/angular';

/**
 * Header Component
 * 
 * Global header with KPMG branding.
 * 
 * Features:
 * - KPMG logo
 * - Application title
 * - Responsive design (desktop + tablet + mobile)
 * - Ionic toolbar with KPMG brand colors
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
