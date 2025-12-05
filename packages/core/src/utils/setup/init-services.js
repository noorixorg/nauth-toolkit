"use strict";
/**
 * Service Initialization Helper
 *
 * Initializes all NAuth services in correct dependency order.
 * Matches NestJS AuthModule service initialization.
 */
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.initServices = initServices;
// Public API imports
var index_1 = require("../../index");
// Internal API imports (for framework adapter use only)
var internal_1 = require("../../internal");
/**
 * Initialize all services in correct dependency order
 *
 * Service initialization order matches NestJS AuthModule:
 * 1. PasswordService, JwtService (no dependencies)
 * 2. ClientInfoService (no dependencies)
 * 3. AuthAuditService (if enabled)
 * 4. RateLimitStorageService, AccountLockoutStorageService
 * 5. SessionService
 * 6. ChallengeService
 * 7. EmailVerificationService
 * 8. PhoneVerificationService (if SMS configured)
 * 9. TrustedDeviceService (if rememberDevices enabled)
 * 10. AuthFlowContextBuilder, AuthFlowStateMachine
 * 11. AuthChallengeHelperService
 * 12. MFAService (if enabled)
 * 13. AuthService
 * 14. SocialAuthService
 * 15. GeoLocationService (if MaxMind configured)
 * 16. Risk services (if adaptive MFA configured)
 *
 * @param config - NAuth configuration
 * @param repositories - Repository container
 * @param storageAdapter - Initialized storage adapter
 * @param logger - Logger instance
 * @param emailProvider - Email provider instance
 * @param smsProvider - SMS provider instance (optional)
 * @returns Service container with all initialized services
 */
function initServices(config, repositories, storageAdapter, logger, emailProvider, smsProvider) {
    // ============================================================================
    // 1. Core Services (No Dependencies)
    // ============================================================================
    var _a, _b, _c, _d;
    var passwordService = new internal_1.PasswordService(config.password);
    var jwtService = new internal_1.JwtService(config.jwt);
    var clientInfoService = new index_1.ClientInfoService();
    // ============================================================================
    // 2. Audit Service (Conditional)
    // ============================================================================
    var auditService = ((_a = config.auditLogs) === null || _a === void 0 ? void 0 : _a.enabled) !== false
        ? new internal_1.AuthAuditService(repositories.authAuditRepository, repositories.userRepository, logger, clientInfoService)
        : undefined;
    // ============================================================================
    // 3. Storage Services
    // ============================================================================
    var rateLimitStorageService = new index_1.RateLimitStorageService(storageAdapter);
    var accountLockoutStorageService = new index_1.AccountLockoutStorageService(storageAdapter);
    // ============================================================================
    // 4. Session Service
    // ============================================================================
    var sessionService = new internal_1.SessionService(repositories.sessionRepository, storageAdapter, clientInfoService, config, logger, auditService);
    // ============================================================================
    // 5. Challenge Service
    // ============================================================================
    var challengeService = new internal_1.ChallengeService(repositories.challengeSessionRepository, clientInfoService, logger, auditService);
    // ============================================================================
    // 6. Email Provider and Verification Service
    // ============================================================================
    if (!emailProvider) {
        throw new index_1.NAuthException(index_1.AuthErrorCode.VALIDATION_FAILED, 'emailProvider is required. Install and configure an email package:\n' +
            '  yarn add @nauth-toolkit/email-console (for dev)\n' +
            '  yarn add @nauth-toolkit/email-nodemailer (for production)');
    }
    // Validate email provider has required method
    if (typeof emailProvider.sendVerificationEmail !== 'function') {
        throw new index_1.NAuthException(index_1.AuthErrorCode.VALIDATION_FAILED, 'emailProvider must implement sendVerificationEmail method');
    }
    // Inject logger into email provider if it supports it
    if (emailProvider && typeof emailProvider.setLogger === 'function') {
        emailProvider.setLogger(logger);
    }
    // Inject global variables from email config if provider supports it
    if (emailProvider && typeof emailProvider.setGlobalVariables === 'function' && config.email) {
        var globalVars = {};
        // Extract top-level branding fields
        if (config.email.appName)
            globalVars.appName = config.email.appName;
        if (config.email.companyName)
            globalVars.companyName = config.email.companyName;
        if (config.email.logoUrl)
            globalVars.logoUrl = config.email.logoUrl;
        if (config.email.supportEmail)
            globalVars.supportEmail = config.email.supportEmail;
        if (config.email.dashboardUrl)
            globalVars.dashboardUrl = config.email.dashboardUrl;
        if (config.email.brandColor)
            globalVars.brandColor = config.email.brandColor;
        if (config.email.footerDisclaimer)
            globalVars.footerDisclaimer = config.email.footerDisclaimer;
        // Merge with templates.globalVariables (templates.globalVariables takes precedence)
        var mergedVars = __assign(__assign({}, globalVars), (((_b = config.email.templates) === null || _b === void 0 ? void 0 : _b.globalVariables) || {}));
        emailProvider.setGlobalVariables(mergedVars);
    }
    var emailVerificationService = new index_1.EmailVerificationService(repositories.verificationTokenRepository, repositories.userRepository, emailProvider, storageAdapter, config, clientInfoService, logger, auditService);
    // ============================================================================
    // 7. SMS Provider and Phone Verification Service (Conditional)
    // ============================================================================
    var phoneVerificationService;
    if (smsProvider) {
        // Inject logger into SMS provider if it supports it
        if (smsProvider && typeof smsProvider.setLogger === 'function') {
            smsProvider.setLogger(logger);
        }
        phoneVerificationService = new index_1.PhoneVerificationService(repositories.verificationTokenRepository, repositories.userRepository, smsProvider, storageAdapter, config, clientInfoService, logger, auditService);
    }
    // ============================================================================
    // 8. Trusted Device Service (Conditional)
    // ============================================================================
    var trustedDeviceService = repositories.trustedDeviceRepository
        ? new internal_1.TrustedDeviceService(config, logger, repositories.trustedDeviceRepository)
        : undefined;
    // ============================================================================
    // 9. Auth Flow Services
    // ============================================================================
    var authFlowContextBuilder = new internal_1.AuthFlowContextBuilder(trustedDeviceService, undefined, // adaptiveMFADecisionService - will be set later
    clientInfoService, logger);
    var authFlowStateMachine = new internal_1.AuthFlowStateMachineService(authFlowContextBuilder, logger);
    var authChallengeHelperService = new internal_1.AuthChallengeHelperService(challengeService, jwtService, sessionService, repositories.mfaDeviceRepository, logger, authFlowStateMachine, authFlowContextBuilder, clientInfoService, emailVerificationService, phoneVerificationService);
    // ============================================================================
    // 10. MFA Service (Conditional)
    // ============================================================================
    var mfaService = new index_1.MFAService(repositories.mfaDeviceRepository, repositories.userRepository, challengeService, config, logger, auditService, clientInfoService);
    // ============================================================================
    // 11. Auth Service
    // ============================================================================
    var authService = new index_1.AuthService(repositories.userRepository, repositories.loginAttemptRepository, passwordService, jwtService, sessionService, challengeService, authChallengeHelperService, emailVerificationService, clientInfoService, accountLockoutStorageService, config, logger, auditService, phoneVerificationService, mfaService, repositories.mfaDeviceRepository, trustedDeviceService);
    // ============================================================================
    // 12. Social Auth Services
    // ============================================================================
    var socialProviderRegistry = new internal_1.SocialProviderRegistry();
    var socialAuthService = new index_1.SocialAuthService(socialProviderRegistry, repositories.userRepository, repositories.socialAccountRepository, authService, logger, auditService);
    // ============================================================================
    // 13. GeoLocation Service (Conditional)
    // ============================================================================
    var geoLocationService;
    if ((_c = config.geoLocation) === null || _c === void 0 ? void 0 : _c.maxMind) {
        try {
            // Try to load MaxMind module (optional peer dependency)
            var maxMindModule = require('@maxmind/geoip2-node');
            geoLocationService = new internal_1.GeoLocationService(config, storageAdapter, maxMindModule, logger);
        }
        catch (_e) {
            // MaxMind module not installed - service remains undefined
            (_d = logger === null || logger === void 0 ? void 0 : logger.warn) === null || _d === void 0 ? void 0 : _d.call(logger, 'MaxMind GeoIP2 module not installed. Geolocation features will be disabled.');
        }
    }
    // ============================================================================
    // 14. Risk Detection and Adaptive MFA Services (Conditional)
    // ============================================================================
    var riskDetectionService;
    var riskScoringService;
    var adaptiveMFADecisionService;
    // Always create risk services (needed for adaptive MFA)
    riskDetectionService = new internal_1.RiskDetectionService(repositories.sessionRepository, repositories.authAuditRepository, config, logger, trustedDeviceService);
    riskScoringService = new internal_1.RiskScoringService(config, logger);
    adaptiveMFADecisionService = new internal_1.AdaptiveMFADecisionService(riskDetectionService, riskScoringService, storageAdapter, clientInfoService, config, logger, auditService);
    // Now inject adaptiveMFADecisionService into authFlowContextBuilder
    authFlowContextBuilder.adaptiveMFADecisionService = adaptiveMFADecisionService;
    // ============================================================================
    // Return Service Container
    // ============================================================================
    return {
        passwordService: passwordService,
        jwtService: jwtService,
        clientInfoService: clientInfoService,
        rateLimitStorageService: rateLimitStorageService,
        accountLockoutStorageService: accountLockoutStorageService,
        sessionService: sessionService,
        challengeService: challengeService,
        emailVerificationService: emailVerificationService,
        authFlowContextBuilder: authFlowContextBuilder,
        authFlowStateMachine: authFlowStateMachine,
        authChallengeHelperService: authChallengeHelperService,
        authService: authService,
        socialProviderRegistry: socialProviderRegistry,
        socialAuthService: socialAuthService,
        auditService: auditService,
        phoneVerificationService: phoneVerificationService,
        trustedDeviceService: trustedDeviceService,
        mfaService: mfaService,
        geoLocationService: geoLocationService,
        riskDetectionService: riskDetectionService,
        riskScoringService: riskScoringService,
        adaptiveMFADecisionService: adaptiveMFADecisionService,
    };
}
