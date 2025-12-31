import { IUser } from '../interfaces/entities.interface';
import { StorageAdapter } from '../interfaces/storage-adapter.interface';
import { InternalAuthAuditService as AuthAuditService } from './auth-audit.service';
import { AuthAuditEventType } from '../enums/auth-audit-event-type.enum';
import { RiskFactor } from '../enums/risk-factor.enum';
import { RiskDetectionService } from './risk-detection.service';
import { RiskScoringService } from './risk-scoring.service';
import { ClientInfoService } from './client-info.service';
import { ClientInfo } from '../interfaces/client-info.interface';
import { NAuthConfig, AdaptiveMFARiskEventPayload, SignInBlockedPayload } from '../interfaces/config.interface';
import { NAuthLogger } from '../utils/nauth-logger';

/**
 * Adaptive MFA decision result
 */
export interface AdaptiveMFADecision {
  /**
   * Action to take
   */
  action: 'allow' | 'require_mfa' | 'block_signin';

  /**
   * Risk score (0-100)
   */
  riskScore: number;

  /**
   * Risk level classification
   */
  riskLevel: 'low' | 'medium' | 'high';

  /**
   * Detected risk factors
   * Array of RiskFactor enum values (stored as strings at runtime)
   */
  riskFactors: RiskFactor[];

  /**
   * Whether user should be notified
   */
  notifyUser: boolean;

  /**
   * Whether lifecycle hook overrode the decision
   */
  hookOverride: boolean;

  /**
   * Risk event payload (included when action requires it or notifyUser is true)
   * Contains full client context for use in blockUserSignIn or audit logging
   */
  payload?: AdaptiveMFARiskEventPayload;
}

/**
 * Adaptive MFA Decision Service
 *
 * Makes context-aware MFA requirement decisions based on risk analysis.
 * Supports multiple actions (allow, require_mfa, block_signin) based on risk level.
 *
 * **Decision Flow:**
 * 1. Detect risk factors (via RiskDetectionService)
 * 2. Calculate risk score (via RiskScoringService)
 * 3. Determine risk level and action from configuration
 * 4. Call lifecycle hooks if notifyUser is true
 * 5. Record audit event (non-blocking)
 * 6. Return decision object
 *
 * **Default Risk Levels:**
 * - Low (0-20): action 'allow', notifyUser false
 * - Medium (21-50): action 'require_mfa', notifyUser true
 * - High (51-100): action 'require_mfa', notifyUser true (conservative default)
 *
 * **User Blocking:**
 * When action is 'block_signin', user is blocked in storage adapter with optional TTL.
 * Block status is checked before evaluation to prevent blocked users from attempting sign-in.
 *
 * @example
 * ```typescript
 * const decision = await adaptiveMFADecisionService.evaluateAdaptiveMFA(user, 'password');
 * if (decision.action === 'block_signin') {
 *   throw new NAuthException(AuthErrorCode.SIGNIN_BLOCKED_HIGH_RISK, 'Sign-in blocked');
 * }
 * return decision.action === 'require_mfa';
 * ```
 */
export class AdaptiveMFADecisionService {
  /**
   * Default risk level configuration
   *
   * Conservative defaults that prioritize security:
   * - Low risk: Allow without MFA (normal flow)
   * - Medium risk: Require MFA
   * - High risk: Require MFA (conservative - don't block by default)
   */
  private readonly defaultRiskLevels: {
    low: { maxScore: number; action?: 'allow' | 'require_mfa' | 'block_signin'; notifyUser?: boolean };
    medium: { maxScore: number; action?: 'allow' | 'require_mfa' | 'block_signin'; notifyUser?: boolean };
    high: { maxScore: number; action?: 'allow' | 'require_mfa' | 'block_signin'; notifyUser?: boolean };
  } = {
    low: {
      maxScore: 20,
      action: 'allow',
      notifyUser: false,
    },
    medium: {
      maxScore: 50,
      action: 'require_mfa',
      notifyUser: true,
    },
    high: {
      maxScore: 100,
      action: 'require_mfa', // Conservative default (don't block)
      notifyUser: true,
    },
  };

  constructor(
    private readonly riskDetectionService: RiskDetectionService,
    private readonly riskScoringService: RiskScoringService,
    private readonly storageAdapter: StorageAdapter,
    private readonly clientInfoService: ClientInfoService,
    private readonly config: NAuthConfig,
    private readonly logger: NAuthLogger,
    private readonly auditService?: AuthAuditService, // Optional - audit trail service (enabled via config.auditLogs.enabled)
  ) {}

  /**
   * Evaluate adaptive MFA requirement with risk-based actions
   *
   * Main entry point for adaptive MFA evaluation. Analyzes current login context,
   * calculates risk score, determines action, and calls lifecycle hooks.
   *
   * @param user - User being authenticated
   * @param authMethod - Authentication method ('password', 'google', 'apple', etc.)
   * @returns Decision object with action, risk details, and hook override status
   *
   * @example
   * ```typescript
   * const decision = await adaptiveMFADecisionService.evaluateAdaptiveMFA(user, 'password');
   * if (decision.action === 'block_signin') {
   *   // Handle blocking
   * }
   * ```
   */
  async evaluateAdaptiveMFA(user: IUser, authMethod: string): Promise<AdaptiveMFADecision> {
    // Validate email is present (required by IUser interface but runtime check for safety)
    if (!user.email) {
      this.logger?.error?.(`User ${user.sub} missing email - cannot evaluate adaptive MFA`, {
        userId: user.id,
        userSub: user.sub,
      });
      throw new Error(`User email is required for adaptive MFA evaluation`);
    }

    // Get current client context
    const clientInfo: ClientInfo = this.clientInfoService.get();

    // Detect risk factors
    const riskFactors = await this.riskDetectionService.detectRiskFactors(user, clientInfo);

    // Calculate risk score
    const riskScore = this.riskScoringService.calculateRiskScore(riskFactors);

    // Determine risk level and action
    const riskLevels = this.config.mfa?.adaptive?.riskLevels || this.defaultRiskLevels;
    const { level, action, notifyUser } = this.determineRiskLevelAndAction(riskScore, riskLevels);

    this.logger?.log?.(
      `Adaptive MFA evaluation: user=${user.sub}, score=${riskScore}, level=${level}, action=${action}, notify=${notifyUser}, factors=[${riskFactors.join(', ')}]`,
    );

    // Prepare payload for hooks and audit
    // Include payload when action requires it (block_signin) or when notifyUser is true
    const payload: AdaptiveMFARiskEventPayload = {
      user: {
        sub: user.sub,
        email: user.email, // Safe after validation above
        username: user.username || undefined,
        phoneNumber: user.phone || undefined,
      },
      riskScore,
      riskLevel: level,
      riskFactors,
      action,
      clientInfo: {
        ipAddress: clientInfo.ipAddress,
        ipCountry: clientInfo.ipCountry,
        ipCity: clientInfo.ipCity,
        deviceId: clientInfo.deviceToken, // deviceToken maps to deviceId in sessions
        deviceName: clientInfo.deviceName,
        deviceType: clientInfo.deviceType,
        userAgent: clientInfo.userAgent,
        platform: clientInfo.platform,
        browser: clientInfo.browser,
      },
      authMethod,
      timestamp: new Date(),
    };

    // TODO: Implement provider-based hook for onAdaptiveMFATriggered
    // Call lifecycle hook if configured and user should be notified
    let hookOverride = false;

    // Record in audit trail (non-blocking)
    // This logs the risk assessment result
    // Determine event status based on risk level and action:
    // - block_signin: SUSPICIOUS (security violation)
    // - require_mfa with high/medium risk or suspicious factors: SUSPICIOUS
    // - require_mfa with low risk: INFO (normal security measure)
    // - allow: INFO (no risk detected)
    const hasSuspiciousFactors =
      riskFactors.includes(RiskFactor.SUSPICIOUS_ACTIVITY) ||
      riskFactors.includes(RiskFactor.IMPOSSIBLE_TRAVEL) ||
      level === 'high';
    const eventStatus =
      action === 'block_signin'
        ? 'SUSPICIOUS'
        : action === 'require_mfa' && hasSuspiciousFactors
          ? 'SUSPICIOUS'
          : 'INFO';

    this.auditService
      ?.recordEvent({
        userId: user.id,
        eventType: AuthAuditEventType.ADAPTIVE_MFA_RISK_ASSESSED,
        eventStatus,
        riskFactor: riskScore,
        riskFactors,
        adaptiveMfaTriggered: action !== 'allow',
        description: `Adaptive MFA risk assessment: ${action} (score: ${riskScore}, level: ${level})`,
        authMethod,
        metadata: {
          riskScore,
          riskLevel: level,
          action,
          riskFactors,
        },
        // Client info automatically included from context
      })
      .catch((err) => {
        this.logger?.warn?.(`Failed to record ADAPTIVE_MFA_RISK_ASSESSED audit: ${err.message}`);
      });

    return {
      action: hookOverride ? 'allow' : action,
      riskScore,
      riskLevel: level,
      riskFactors,
      notifyUser,
      hookOverride,
      // Include payload when action requires it or when notifyUser is true
      // This ensures consistent clientInfo data for blockUserSignIn and audit logs
      payload: action === 'block_signin' || notifyUser ? payload : undefined,
    };
  }

  /**
   * Determine risk level and action based on score and configured thresholds
   *
   * Evaluates risk score against configured thresholds in order: low → medium → high.
   * Returns the first level that the score falls within.
   *
   * @param riskScore - Calculated risk score (0-100)
   * @param riskLevels - Configured risk level thresholds
   * @returns Risk level, action, and notifyUser flag
   * @private
   */
  private determineRiskLevelAndAction(
    riskScore: number,
    riskLevels: {
      low?: { maxScore: number; action?: 'allow' | 'require_mfa' | 'block_signin'; notifyUser?: boolean };
      medium?: { maxScore: number; action?: 'allow' | 'require_mfa' | 'block_signin'; notifyUser?: boolean };
      high?: { maxScore: number; action?: 'allow' | 'require_mfa' | 'block_signin'; notifyUser?: boolean };
    },
  ): {
    level: 'low' | 'medium' | 'high';
    action: 'allow' | 'require_mfa' | 'block_signin';
    notifyUser: boolean;
  } {
    // Check in order: low → medium → high
    if (riskScore <= (riskLevels.low?.maxScore ?? 20)) {
      return {
        level: 'low',
        action: riskLevels.low?.action ?? 'allow',
        notifyUser: riskLevels.low?.notifyUser ?? false,
      };
    }

    if (riskScore <= (riskLevels.medium?.maxScore ?? 50)) {
      return {
        level: 'medium',
        action: riskLevels.medium?.action ?? 'require_mfa',
        notifyUser: riskLevels.medium?.notifyUser ?? true,
      };
    }

    return {
      level: 'high',
      action: riskLevels.high?.action ?? 'require_mfa',
      notifyUser: riskLevels.high?.notifyUser ?? true,
    };
  }

  /**
   * Check if user is currently blocked due to high-risk sign-in
   *
   * Uses storage adapter to check for existing block. Block is stored with
   * key format: `adaptive_mfa_block:{userId}`.
   *
   * @param userId - Internal user ID (integer)
   * @returns Block status with expiration and message if blocked
   *
   * @example
   * ```typescript
   * const blockStatus = await adaptiveMFADecisionService.isUserBlocked(user.id);
   * if (blockStatus.blocked) {
   *   throw new NAuthException(AuthErrorCode.SIGNIN_BLOCKED_HIGH_RISK, blockStatus.message);
   * }
   * ```
   */
  async isUserBlocked(userId: number): Promise<{
    blocked: boolean;
    expiresAt?: Date;
    message?: string;
  }> {
    try {
      const blockKey = `adaptive_mfa_block:${userId}`;
      const blockData = await this.storageAdapter.get(blockKey);

      if (!blockData) {
        return { blocked: false };
      }

      const parsed = JSON.parse(blockData);
      const expiresAt = parsed.expiresAt ? new Date(parsed.expiresAt) : undefined;

      // Check if block has expired (if temporary)
      if (expiresAt && expiresAt < new Date()) {
        // Block expired - clean up
        await this.storageAdapter.del(blockKey);
        return { blocked: false };
      }

      return {
        blocked: true,
        expiresAt,
        message: parsed.message,
      };
    } catch (error) {
      // Non-blocking: Log error but assume not blocked (safer for UX)
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger?.warn?.(`Failed to check user block status: ${errorMessage}`, { error, userId });
      return { blocked: false };
    }
  }

  /**
   * Block user sign-in due to high risk
   *
   * Stores block in storage adapter with optional TTL. Block data includes:
   * - userId, userSub (for reference)
   * - message (shown to user)
   * - riskScore, riskFactors (for audit)
   * - blockedAt, expiresAt (timestamps)
   *
   * Also calls onSignInBlocked lifecycle hook if configured.
   *
   * @param user - User to block
   * @param payload - Risk event payload with all context
   *
   * @example
   * ```typescript
   * await adaptiveMFADecisionService.blockUserSignIn(user, payload);
   * ```
   */
  async blockUserSignIn(user: IUser, payload: AdaptiveMFARiskEventPayload): Promise<void> {
    const blockConfig = this.config.mfa?.adaptive?.blockedSignIn;
    const blockDuration = blockConfig?.blockDuration; // minutes
    const message = blockConfig?.message || 'Sign-in blocked due to suspicious activity. Please contact support.';

    // Store block in storage adapter
    const blockKey = `adaptive_mfa_block:${user.id}`;
    const blockData = {
      userId: user.id,
      userSub: user.sub,
      message,
      riskScore: payload.riskScore,
      riskFactors: payload.riskFactors,
      blockedAt: new Date().toISOString(),
      expiresAt: blockDuration ? new Date(Date.now() + blockDuration * 60 * 1000).toISOString() : undefined,
    };

    const ttl = blockDuration ? blockDuration * 60 : undefined; // Convert to seconds
    await this.storageAdapter.set(blockKey, JSON.stringify(blockData), ttl);

    this.logger?.warn?.(
      `User sign-in blocked: user=${user.sub}, score=${payload.riskScore}, duration=${blockDuration ? `${blockDuration}min` : 'permanent'}`,
    );

    // TODO: Implement provider-based hook for onSignInBlocked
  }

  /**
   * Clear user block (manual unblock)
   *
   * Removes the block from storage adapter, allowing user to sign in again.
   * Useful for admin actions or when risk situation has improved.
   *
   * @param userId - Internal user ID (integer)
   *
   * @example
   * ```typescript
   * await adaptiveMFADecisionService.clearUserBlock(user.id);
   * ```
   */
  async clearUserBlock(userId: number): Promise<void> {
    try {
      const blockKey = `adaptive_mfa_block:${userId}`;
      await this.storageAdapter.del(blockKey);
      this.logger?.log?.(`User block cleared: userId=${userId}`);
    } catch (error) {
      // Non-blocking: Log error but continue
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger?.warn?.(`Failed to clear user block: ${errorMessage}`, { error, userId });
    }
  }
}
