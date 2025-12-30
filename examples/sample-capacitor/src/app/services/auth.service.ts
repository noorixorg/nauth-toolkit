import { Injectable, signal, inject } from '@angular/core';
import { Router } from '@angular/router';
import { NAuthClient, type AuthResponse, type SocialVerifyRequest } from '@nauth-toolkit/client';
import { SocialLogin } from '@capgo/capacitor-social-login';
import { environment } from '../../environments/environment';

/**
 * Authentication service for handling social login with Capacitor and nauth-toolkit
 */
@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private client: NAuthClient;
  private initialized = false;
  private router = inject(Router);

  // Reactive state using signals
  public readonly user = signal<AuthResponse['user'] | null>(null);
  public readonly isAuthenticated = signal<boolean>(false);
  public readonly isLoading = signal<boolean>(false);
  public readonly error = signal<string | null>(null);

  constructor() {
    // Initialize nauth-toolkit client
    this.client = new NAuthClient({
      baseUrl: `${environment.apiBaseUrl}/auth`,
      tokenDelivery: 'json',
      onAuthStateChange: (user) => {
        this.user.set(user);
        this.isAuthenticated.set(!!user);
      },
      onSessionExpired: () => {
        this.logout();
      },
    });
  }

  /**
   * Initialize the auth service and social login providers
   * Call this on app startup
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      this.isLoading.set(true);

      // Initialize Capacitor social login
      // Note: Facebook clientToken is optional for Android, only required for iOS
      await SocialLogin.initialize({
        google: {
          webClientId: '1010280037829-ccl2aoaflruq2ao22gkpkbj4jpkj6fn4.apps.googleusercontent.com',
          iOSClientId: '1010280037829-0b8tfd7h23bp1onjr03rp9p25albkraq.apps.googleusercontent.com',
          mode: 'online',
        },
        facebook: {
          appId: '9612640992193714',
          clientToken: '71d139ded04d03eff091810720d7a67b', // Required for iOS, optional for Android
        },
        apple: {
          clientId: 'com.noorix.nauth',
          redirectUrl: 'https://your-app.com/auth/apple/callback',
        },
      });

      // Initialize nauth-toolkit client
      await this.client.initialize();

      // Check if user is already authenticated
      const currentUser = this.client.getCurrentUser();
      if (currentUser) {
        this.user.set(currentUser);
        this.isAuthenticated.set(true);
      }

      this.initialized = true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Initialization failed';
      this.error.set(errorMessage);
      console.error('Auth initialization error:', error);
    } finally {
      this.isLoading.set(false);
    }
  }

  /**
   * Sign in with Google
   */
  async signInWithGoogle(): Promise<void> {
    try {
      this.isLoading.set(true);
      this.error.set(null);

      // Get native token from Capacitor
      const result = await SocialLogin.login({
        provider: 'google',
        options: {
          scopes: ['email', 'profile'],
        },
      });

      // Type assertion for the response - the plugin returns different types based on mode
      // The plugin types don't fully match the runtime structure, so we use type assertion
      const googleResult = result.result as {
        idToken?: string;
        accessToken?: { token?: string } | string;
      };

      if (!googleResult?.idToken) {
        throw new Error('No ID token received from Google');
      }

      // Extract access token - can be an object with token property or a string
      const accessToken =
        typeof googleResult.accessToken === 'string'
          ? googleResult.accessToken
          : googleResult.accessToken?.token;

      // Verify token with nauth-toolkit backend
      const verifyRequest: SocialVerifyRequest = {
        provider: 'google',
        idToken: googleResult.idToken,
        accessToken,
      };

      const authResponse = await this.client.verifyNativeSocial(verifyRequest);
      this.user.set(authResponse.user);
      this.isAuthenticated.set(true);

      // Navigate to user info page using Angular Router
      await this.router.navigate(['/user']);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Google sign-in failed';
      this.error.set(errorMessage);
      console.error('Google sign-in error:', error);
      throw error;
    } finally {
      this.isLoading.set(false);
    }
  }

  /**
   * Sign in with Apple
   */
  async signInWithApple(): Promise<void> {
    try {
      this.isLoading.set(true);
      this.error.set(null);

      // Get native token from Capacitor
      const result = await SocialLogin.login({
        provider: 'apple',
        options: {
          scopes: ['email', 'name'],
        },
      });

      // Type assertion for the response
      const appleResult = result.result as any;

      if (!appleResult?.idToken) {
        throw new Error('No ID token received from Apple');
      }

      // Verify token with nauth-toolkit backend
      const verifyRequest: SocialVerifyRequest = {
        provider: 'apple',
        idToken: appleResult.idToken,
        authorizationCode: appleResult.authorizationCode,
      };

      const authResponse = await this.client.verifyNativeSocial(verifyRequest);
      this.user.set(authResponse.user);
      this.isAuthenticated.set(true);

      // Navigate to user info page using Angular Router
      await this.router.navigate(['/user']);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Apple sign-in failed';
      this.error.set(errorMessage);
      console.error('Apple sign-in error:', error);
      throw error;
    } finally {
      this.isLoading.set(false);
    }
  }

  /**
   * Sign in with Facebook
   */
  async signInWithFacebook(): Promise<void> {
    try {
      this.isLoading.set(true);
      this.error.set(null);

      // Get native token from Capacitor
      const result = await SocialLogin.login({
        provider: 'facebook',
        options: {
          permissions: ['email', 'public_profile'],
        },
      });

      // Type assertion for the response
      const facebookResult = result.result as any;

      const accessToken = facebookResult?.accessToken?.token || facebookResult?.accessToken;
      if (!accessToken) {
        throw new Error('No access token received from Facebook');
      }

      // Verify token with nauth-toolkit backend
      const verifyRequest: SocialVerifyRequest = {
        provider: 'facebook',
        accessToken,
      };

      const authResponse = await this.client.verifyNativeSocial(verifyRequest);
      this.user.set(authResponse.user);
      this.isAuthenticated.set(true);

      // Navigate to user info page using Angular Router
      await this.router.navigate(['/user']);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Facebook sign-in failed';
      this.error.set(errorMessage);
      console.error('Facebook sign-in error:', error);
      throw error;
    } finally {
      this.isLoading.set(false);
    }
  }

  /**
   * Logout the current user
   */
  async logout(): Promise<void> {
    try {
      this.isLoading.set(true);
      await this.client.logout();
      this.user.set(null);
      this.isAuthenticated.set(false);
      this.error.set(null);

      // Navigate to login page using Angular Router
      await this.router.navigate(['/login']);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Logout failed';
      this.error.set(errorMessage);
      console.error('Logout error:', error);
    } finally {
      this.isLoading.set(false);
    }
  }
}
