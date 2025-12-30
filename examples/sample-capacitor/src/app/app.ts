import { Component, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { AuthService } from './services/auth.service';

/**
 * Root application component
 */
@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App implements OnInit {
  constructor(private authService: AuthService) {}

  /**
   * Initialize auth service on app startup
   */
  async ngOnInit(): Promise<void> {
    await this.authService.initialize();
  }
}
