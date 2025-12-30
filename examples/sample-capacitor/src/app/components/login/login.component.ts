import { Component } from '@angular/core';
import { AuthService } from '../../services/auth.service';

/**
 * Login component with social authentication buttons
 */
@Component({
  selector: 'app-login',
  standalone: true,
  imports: [],
  templateUrl: './login.component.html',
  styleUrl: './login.component.css',
})
export class LoginComponent {
  constructor(public authService: AuthService) {}

  /**
   * Handle Google sign-in
   */
  async onGoogleSignIn(): Promise<void> {
    try {
      await this.authService.signInWithGoogle();
    } catch (error) {
      // Error is handled by the service
    }
  }

  /**
   * Handle Apple sign-in
   */
  async onAppleSignIn(): Promise<void> {
    try {
      await this.authService.signInWithApple();
    } catch (error) {
      // Error is handled by the service
    }
  }

  /**
   * Handle Facebook sign-in
   */
  async onFacebookSignIn(): Promise<void> {
    try {
      await this.authService.signInWithFacebook();
    } catch (error) {
      // Error is handled by the service
    }
  }
}

