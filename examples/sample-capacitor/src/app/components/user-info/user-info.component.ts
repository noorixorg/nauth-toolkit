import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../services/auth.service';

/**
 * User info component to display authenticated user information
 */
@Component({
  selector: 'app-user-info',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './user-info.component.html',
  styleUrl: './user-info.component.css',
})
export class UserInfoComponent {
  constructor(public authService: AuthService) {}

  /**
   * Handle logout
   */
  async onLogout(): Promise<void> {
    try {
      await this.authService.logout();
    } catch (error) {
      // Error is handled by the service
    }
  }
}

