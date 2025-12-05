# Development Rules - MUST FOLLOW

NEVER RUN yarn start or nest start it creates port conflict for the user. Instead do nest build to check for errors
Don't do console.log() in backend projects use project logger module. Frontend is okay for console logs

## Package Manager

- ✅ **ALWAYS use Yarn** (never npm or pnpm)
- ✅ Commands: `yarn install`, `yarn workspace <name> <command>`

## Error Handling

- Check docs/ERROR_HANDLING_STRATEGY.md for details
- All errors must be platform agnostic and thrown with NAUthException() not Http based exceptions as the consumer app could be using websocket, graphql etc.

- NEVER use require() in the project. It's prohibited. nestjs can use dynamic modules, dependency injection or optional injection instead whatever is best applicable.

## Documentation Standards

### JSDoc - MANDATORY for ALL:

- ✅ **Every class** - description, @example
- ✅ **Every public method** - description, @param, @returns, @throws
- ✅ **Every interface** - description, property comments
- ✅ **Every enum/constant** - description

### Inline Comments - REQUIRED:

- ✅ Complex logic - explain WHY, not WHAT
- ✅ Security-critical sections - add warnings
- ✅ Section headers with `// ============`

## Code Quality

### Type Safety:

- ✅ **ZERO `any` types** - use `unknown` if needed
- ✅ **Explicit return types** on all functions
- ✅ **Full TypeScript strict mode**

### Testing:

- ✅ **Unit tests** for all services (\*.spec.ts)
- ✅ **80%+ coverage** minimum
- ✅ **Run tests** before completion: `yarn test`
- Any new methods or files added must implement testing

## Pre-Completion Checklist

Before marking task complete:

- All files have JSDoc comments
- All complex logic has inline comments
- No `any` types used
- Test files created (\*.spec.ts)
- Tests run and pass
- Lint errors fixed
- Aligns with original requirements
- NO console.log() statements in the project. Always use logger module.
- Do not use emojis or icons of any sorts in logs. Keep it plain text, professional
- A final nest build with clean output

## Verification Commands

```bash
# Check types
yarn workspace @nauth-toolkit/core build

# Run tests
yarn workspace @nauth-toolkit/core test

# Check lints
yarn workspace @nauth-toolkit/core lint
```

## Quick Reference

**JSDoc Template:**

````typescript
/**
 * Brief one-line description
 *
 * Detailed explanation if needed
 *
 * @param paramName - Parameter description
 * @returns Description of return value
 * @throws {ErrorType} When error occurs
 *
 * @example
 * ```typescript
 * const result = await myFunction('test');
 * ```
 */
````

**Inline Comments:**

```typescript
// ============================================================================
// Section Name
// ============================================================================

// Explain WHY this is needed (not what it does)
const result = complexOperation();

// ⚠️ WARNING: Security-critical operation
await validateToken(token);
```

## Apply These Rules ALWAYS
