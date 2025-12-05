"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthFlowStateMachineService = void 0;
var auth_flow_state_machine_types_1 = require("./auth-flow-state-machine.types");
var auth_flow_state_definitions_1 = require("./auth-flow-state-definitions");
/**
 * Authentication Flow State Machine Service
 *
 * Core engine for evaluating authentication flow states using declarative rules.
 * Replaces imperative if/else logic with a rule-based state machine.
 *
 * **How it works:**
 * 1. Build context with pre-computed values
 * 2. Evaluate states in priority order (1-9)
 * 3. Select first state whose condition rule evaluates to true
 * 4. Execute onEnter hook if defined
 * 5. Return state with metadata
 *
 * **Benefits:**
 * - Declarative and maintainable
 * - Easy to test (pure functions)
 * - Extensible (add new states/rules easily)
 * - Clear priority ordering
 *
 * @example
 * ```typescript
 * const state = await stateMachine.evaluateState(context);
 * const definition = stateMachine.getStateDefinition(state);
 * ```
 */
var AuthFlowStateMachineService = /** @class */ (function () {
    function AuthFlowStateMachineService(contextBuilder, logger) {
        this.contextBuilder = contextBuilder;
        this.logger = logger;
    }
    /**
     * Evaluate authentication flow state
     *
     * Evaluates states in priority order and returns the first matching state.
     * Executes onEnter hook if defined for the selected state.
     *
     * @param context - Authentication flow context
     * @returns Evaluated state
     *
     * @example
     * ```typescript
     * const context = await contextBuilder.build({ user, config, authMethod: 'password' });
     * const state = await stateMachine.evaluateState(context);
     * // Returns: AuthFlowState.PENDING_EMAIL_VERIFICATION
     * ```
     */
    AuthFlowStateMachineService.prototype.evaluateState = function (context) {
        return __awaiter(this, void 0, void 0, function () {
            var stateDefinitions, _i, stateDefinitions_1, definition, ruleResult, error_1, errorMessage;
            var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m;
            return __generator(this, function (_o) {
                switch (_o.label) {
                    case 0:
                        stateDefinitions = (0, auth_flow_state_definitions_1.getStateDefinitionsByPriority)();
                        (_b = (_a = this.logger) === null || _a === void 0 ? void 0 : _a.debug) === null || _b === void 0 ? void 0 : _b.call(_a, "[StateMachine] Evaluating states for user ".concat(context.user.sub, " (priority 1-9, first match wins)"));
                        _i = 0, stateDefinitions_1 = stateDefinitions;
                        _o.label = 1;
                    case 1:
                        if (!(_i < stateDefinitions_1.length)) return [3 /*break*/, 7];
                        definition = stateDefinitions_1[_i];
                        ruleResult = definition.condition(context);
                        (_d = (_c = this.logger) === null || _c === void 0 ? void 0 : _c.debug) === null || _d === void 0 ? void 0 : _d.call(_c, "[StateMachine] Priority ".concat(definition.priority, ": ").concat(definition.state, " \u2192 ").concat(ruleResult ? 'MATCH' : 'skip'));
                        if (!ruleResult) return [3 /*break*/, 6];
                        if (!definition.onEnter) return [3 /*break*/, 5];
                        (_f = (_e = this.logger) === null || _e === void 0 ? void 0 : _e.debug) === null || _f === void 0 ? void 0 : _f.call(_e, "[StateMachine] Executing onEnter hook for ".concat(definition.state));
                        _o.label = 2;
                    case 2:
                        _o.trys.push([2, 4, , 5]);
                        return [4 /*yield*/, definition.onEnter(context)];
                    case 3:
                        _o.sent();
                        return [3 /*break*/, 5];
                    case 4:
                        error_1 = _o.sent();
                        errorMessage = error_1 instanceof Error ? error_1.message : 'Unknown error';
                        (_h = (_g = this.logger) === null || _g === void 0 ? void 0 : _g.warn) === null || _h === void 0 ? void 0 : _h.call(_g, "onEnter hook failed for state ".concat(definition.state, ": ").concat(errorMessage), {
                            error: error_1,
                            state: definition.state,
                            userId: context.user.id,
                        });
                        return [3 /*break*/, 5];
                    case 5:
                        (_k = (_j = this.logger) === null || _j === void 0 ? void 0 : _j.debug) === null || _k === void 0 ? void 0 : _k.call(_j, "[StateMachine] \u2713 Selected state: ".concat(definition.state, " for user ").concat(context.user.sub));
                        return [2 /*return*/, definition.state];
                    case 6:
                        _i++;
                        return [3 /*break*/, 1];
                    case 7:
                        // Fallback: Should never reach here (AUTHENTICATED always matches)
                        // But return AUTHENTICATED as safe default
                        (_m = (_l = this.logger) === null || _l === void 0 ? void 0 : _l.warn) === null || _m === void 0 ? void 0 : _m.call(_l, "No state matched for user ".concat(context.user.sub, " - falling back to AUTHENTICATED"), {
                            userId: context.user.id,
                        });
                        return [2 /*return*/, auth_flow_state_machine_types_1.AuthFlowState.AUTHENTICATED];
                }
            });
        });
    };
    /**
     * Get state definition by state
     *
     * @param state - State to get definition for
     * @returns State definition or undefined if not found
     *
     * @example
     * ```typescript
     * const def = stateMachine.getStateDefinition(AuthFlowState.PENDING_EMAIL_VERIFICATION);
     * ```
     */
    AuthFlowStateMachineService.prototype.getStateDefinition = function (state) {
        return (0, auth_flow_state_definitions_1.getStateDefinition)(state);
    };
    /**
     * Build metadata for state response
     *
     * Calls buildMetadata function if defined for the state.
     *
     * @param state - State to build metadata for
     * @param context - Authentication flow context
     * @returns Metadata object or undefined
     *
     * @example
     * ```typescript
     * const metadata = await stateMachine.buildMetadata(state, context);
     * // Returns: { gracePeriodEndsAt: Date, riskScore: 45, riskLevel: 'medium' }
     * ```
     */
    AuthFlowStateMachineService.prototype.buildMetadata = function (state, context) {
        var _a, _b;
        var definition = this.getStateDefinition(state);
        if (!definition || !definition.buildMetadata) {
            return undefined;
        }
        try {
            return definition.buildMetadata(context);
        }
        catch (error) {
            var errorMessage = error instanceof Error ? error.message : 'Unknown error';
            (_b = (_a = this.logger) === null || _a === void 0 ? void 0 : _a.warn) === null || _b === void 0 ? void 0 : _b.call(_a, "buildMetadata failed for state ".concat(state, ": ").concat(errorMessage), {
                error: error,
                state: state,
                userId: context.user.id,
            });
            return undefined;
        }
    };
    /**
     * Transition after challenge completion
     *
     * Re-evaluates state after a challenge is completed.
     * This is used in the challenge completion flow to determine the next state.
     *
     * @param params - Transition parameters
     * @param params.completedChallenge - Challenge that was just completed
     * @param params.context - Current authentication flow context
     * @param params.updateFn - Function to update user data (e.g., mark email as verified)
     * @returns New state after transition
     *
     * @example
     * ```typescript
     * const newState = await stateMachine.transitionAfterChallenge({
     *   completedChallenge: AuthChallenge.VERIFY_EMAIL,
     *   context,
     *   updateFn: async (user) => {
     *     user.isEmailVerified = true;
     *     await userRepository.save(user);
     *   }
     * });
     * ```
     */
    AuthFlowStateMachineService.prototype.transitionAfterChallenge = function (params) {
        return __awaiter(this, void 0, void 0, function () {
            var completedChallenge, context, updateFn, error_2, errorMessage, newContext;
            var _a, _b;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        completedChallenge = params.completedChallenge, context = params.context, updateFn = params.updateFn;
                        if (!updateFn) return [3 /*break*/, 4];
                        _c.label = 1;
                    case 1:
                        _c.trys.push([1, 3, , 4]);
                        return [4 /*yield*/, updateFn(context.user)];
                    case 2:
                        _c.sent();
                        return [3 /*break*/, 4];
                    case 3:
                        error_2 = _c.sent();
                        errorMessage = error_2 instanceof Error ? error_2.message : 'Unknown error';
                        (_b = (_a = this.logger) === null || _a === void 0 ? void 0 : _a.error) === null || _b === void 0 ? void 0 : _b.call(_a, "Failed to update user after challenge completion: ".concat(errorMessage), {
                            error: error_2,
                            challenge: completedChallenge,
                            userId: context.user.id,
                        });
                        return [3 /*break*/, 4];
                    case 4: return [4 /*yield*/, this.contextBuilder.build({
                            user: context.user,
                            config: context.config,
                            authMethod: context.authMethod,
                            authProvider: context.authProvider,
                            deviceToken: context.deviceToken,
                            skipMFAVerification: context.skipMFAVerification,
                        })];
                    case 5:
                        newContext = _c.sent();
                        // Re-evaluate state
                        return [2 /*return*/, this.evaluateState(newContext)];
                }
            });
        });
    };
    return AuthFlowStateMachineService;
}());
exports.AuthFlowStateMachineService = AuthFlowStateMachineService;
