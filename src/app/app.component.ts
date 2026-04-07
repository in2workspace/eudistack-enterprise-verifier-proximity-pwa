import { Component } from '@angular/core';
import { IonicModule } from '@ionic/angular';
import { RouterOutlet } from '@angular/router';
import { HeaderComponent, FooterComponent } from './shared/components';

/**
 * Root Application Component
 * 
 * Master layout with header, footer, and router outlet.
 * 
 * @component
 */
@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    IonicModule,
    RouterOutlet,
    HeaderComponent,
    FooterComponent
  ],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent {
  constructor() {}
}
