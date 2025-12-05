"use strict";
/**
 * Token Delivery Policy Resolution
 *
 * Framework-agnostic utility to determine per-request token delivery:
 * - 'cookies' for web browser origins
 * - 'json' for native/mobile or non-web clients
 *
 * Uses only generic request shape (headers.origin) to avoid express/fastify types.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveDeliveryForRequest = resolveDeliveryForRequest;
/**
 * Resolve effective delivery for a request in hybrid mode.
 *
 * Safe default: return 'cookies' when origin is unknown or not matched.
 * This avoids leaking tokens to browsers by default.
 */
function resolveDeliveryForRequest(req, policy) {
    var _a;
    var r = req;
    var origin = ((_a = r === null || r === void 0 ? void 0 : r.headers) === null || _a === void 0 ? void 0 : _a.origin) || '';
    // Prefer explicit origin classification
    if ((policy === null || policy === void 0 ? void 0 : policy.nativeOrigins) && policy.nativeOrigins.includes(origin)) {
        return 'json';
    }
    if ((policy === null || policy === void 0 ? void 0 : policy.webOrigins) && policy.webOrigins.includes(origin)) {
        return 'cookies';
    }
    // Default safe posture: treat as web (cookies only)
    return 'cookies';
}
