"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthFlowState = void 0;
/**
 * Authentication flow states
 *
 * Represents the current state of the authentication flow.
 * States are evaluated in priority order (1-9).
 *
 * @example
 * ```typescript
 * const state = AuthFlowState.PENDING_EMAIL_VERIFICATION;
 * ```
 */
var AuthFlowState;
(function (AuthFlowState) {
    /**
     * User must change password before continuing
     * Priority: 1 (highest)
     */
    AuthFlowState["PENDING_PASSWORD_CHANGE"] = "PENDING_PASSWORD_CHANGE";
    /**
     * User must verify email address
     * Priority: 2
     */
    AuthFlowState["PENDING_EMAIL_VERIFICATION"] = "PENDING_EMAIL_VERIFICATION";
    /**
     * User must provide phone number
     * Priority: 3
     */
    AuthFlowState["PENDING_PHONE_COLLECTION"] = "PENDING_PHONE_COLLECTION";
    /**
     * User must verify phone number
     * Priority: 4
     */
    AuthFlowState["PENDING_PHONE_VERIFICATION"] = "PENDING_PHONE_VERIFICATION";
    /**
     * User must set up MFA
     * Priority: 5
     */
    AuthFlowState["PENDING_MFA_SETUP"] = "PENDING_MFA_SETUP";
    /**
     * User must verify MFA
     * Priority: 6
     */
    AuthFlowState["PENDING_MFA_VERIFICATION"] = "PENDING_MFA_VERIFICATION";
    /**
     * Grace period is active (MFA setup optional)
     * Priority: 7
     */
    AuthFlowState["GRACE_PERIOD_ACTIVE"] = "GRACE_PERIOD_ACTIVE";
    /**
     * User is blocked from signing in
     * Priority: 8
     */
    AuthFlowState["BLOCKED"] = "BLOCKED";
    /**
     * Authentication complete - user is fully authenticated
     * Priority: 9 (lowest - default state)
     */
    AuthFlowState["AUTHENTICATED"] = "AUTHENTICATED";
})(AuthFlowState || (exports.AuthFlowState = AuthFlowState = {}));
