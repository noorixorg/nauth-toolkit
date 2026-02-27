import type { AuthResponse } from '../types/auth.types';
import type { NAuthClientError } from './errors';

/**
 * Authentication event types emitted by NAuthClient
 *
 * Events are emitted throughout the authentication lifecycle,
 * allowing applications to react to auth state changes.
 */
export type AuthEventType =
  | 'auth:login'
  | 'auth:signup'
  | 'auth:success'
  | 'auth:challenge'
  | 'auth:error'
  | 'auth:logout'
  | 'auth:refresh'
  | 'auth:session_expired'
  | 'oauth:started'
  | 'oauth:callback'
  | 'oauth:completed'
  | 'oauth:error';

/**
 * Discriminated union of all authentication events with type-safe payloads
 *
 * Each event has a specific payload type for better type safety.
 */
export type AuthEvent =
  | AuthLoginEvent
  | AuthSignupEvent
  | AuthSuccessEvent
  | AuthChallengeEvent
  | AuthErrorEvent
  | AuthLogoutEvent
  | AuthRefreshEvent
  | AuthSessionExpiredEvent
  | OAuthStartedEvent
  | OAuthCallbackEvent
  | OAuthCompletedEvent
  | OAuthErrorEvent;

/**
 * Login initiated event
 */
export interface AuthLoginEvent {
  type: 'auth:login';
  data: {
    identifier: string;
  };
  timestamp: number;
}

/**
 * Signup initiated event
 */
export interface AuthSignupEvent {
  type: 'auth:signup';
  data: {
    email: string;
  };
  timestamp: number;
}

/**
 * Successful authentication event
 */
export interface AuthSuccessEvent {
  type: 'auth:success';
  data: AuthResponse;
  timestamp: number;
}

/**
 * Challenge required event
 */
export interface AuthChallengeEvent {
  type: 'auth:challenge';
  data: AuthResponse;
  timestamp: number;
}

/**
 * Authentication error event
 */
export interface AuthErrorEvent {
  type: 'auth:error';
  data: NAuthClientError;
  timestamp: number;
}

/**
 * User logged out event
 */
export interface AuthLogoutEvent {
  type: 'auth:logout';
  data: {
    forgetDevice?: boolean;
    global?: boolean;
  };
  timestamp: number;
}

/**
 * Token refreshed event
 */
export interface AuthRefreshEvent {
  type: 'auth:refresh';
  data: {
    success: boolean;
  };
  timestamp: number;
}

/**
 * Session expired event (refresh token expired or invalid)
 *
 * Emitted when token refresh fails with 401, indicating the session
 * has expired and the user needs to re-authenticate.
 */
export interface AuthSessionExpiredEvent {
  type: 'auth:session_expired';
  data: Record<string, never>;
  timestamp: number;
}

/**
 * OAuth flow started event
 */
export interface OAuthStartedEvent {
  type: 'oauth:started';
  data: {
    provider: string;
  };
  timestamp: number;
}

/**
 * OAuth callback received event
 */
export interface OAuthCallbackEvent {
  type: 'oauth:callback';
  data: {
    provider: string;
  };
  timestamp: number;
}

/**
 * OAuth flow completed event
 */
export interface OAuthCompletedEvent {
  type: 'oauth:completed';
  data: AuthResponse;
  timestamp: number;
}

/**
 * OAuth error event
 */
export interface OAuthErrorEvent {
  type: 'oauth:error';
  data: NAuthClientError;
  timestamp: number;
}

/**
 * Event listener callback function
 */
export type AuthEventListener = (event: AuthEvent) => void;

/**
 * Internal event emitter for authentication events
 *
 * Provides pub/sub functionality for auth lifecycle events.
 *
 * @internal
 */
export class EventEmitter {
  private listeners = new Map<AuthEventType | '*', Set<AuthEventListener>>();

  /**
   * Subscribe to an authentication event
   *
   * @param event - Event type or '*' for all events
   * @param listener - Callback function
   * @returns Unsubscribe function
   *
   * @example
   * ```typescript
   * const unsubscribe = emitter.on('auth:success', (event) => {
   *   console.log('User logged in:', event.data);
   * });
   *
   * // Later
   * unsubscribe();
   * ```
   */
  on(event: AuthEventType | '*', listener: AuthEventListener): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(listener);

    // Return unsubscribe function
    return () => this.off(event, listener);
  }

  /**
   * Unsubscribe from an authentication event
   *
   * @param event - Event type or '*'
   * @param listener - Callback function to remove
   */
  off(event: AuthEventType | '*', listener: AuthEventListener): void {
    this.listeners.get(event)?.delete(listener);
  }

  /**
   * Emit an authentication event
   *
   * Notifies all listeners for the specific event type and wildcard listeners.
   *
   * @param event - Event to emit
   * @internal
   */
  emit(event: AuthEvent): void {
    const specificListeners = this.listeners.get(event.type);
    const wildcardListeners = this.listeners.get('*');

    // Emit to specific event listeners
    specificListeners?.forEach((listener) => {
      try {
        listener(event);
      } catch (error) {
        console.error(`Error in ${event.type} event listener:`, error);
      }
    });

    // Emit to wildcard listeners
    wildcardListeners?.forEach((listener) => {
      try {
        listener(event);
      } catch (error) {
        console.error(`Error in wildcard event listener:`, error);
      }
    });
  }

  /**
   * Remove all listeners
   *
   * @internal
   */
  clear(): void {
    this.listeners.clear();
  }
}
