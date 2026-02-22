---
title: NestJsLoggerAdapter
description: NestJS logger adapter for NAuth logging with automatic PII redaction
keywords: [nestjs, logger, adapter, api]
image: /img/api-social-card.png
---
# NestJsLoggerAdapter

**Package:** `@nauth-toolkit/nestjs`
**Type:** Logger Adapter

Wraps NestJS's built-in `Logger` to implement NAuth's `LoggerProvider` interface. Includes automatic PII redaction for emails, IPs, and tokens.

## Import

```typescript
import { NestJsLoggerAdapter } from '@nauth-toolkit/nestjs';
```

## Usage

```typescript
import { NestJsLoggerAdapter } from '@nauth-toolkit/nestjs';

const logger = new NestJsLoggerAdapter({ context: 'NAuth' });
```

## Constructor

```typescript
new NestJsLoggerAdapter(options?: {
  context?: string;
  enablePiiRedaction?: boolean;
  piiRedactionOptions?: Record<string, unknown>;
})
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `options` | `object` | Optional configuration |
| `options.context` | `string` | Logger context label. Default: `'nauth-toolkit'` |
| `options.enablePiiRedaction` | `boolean` | Redact PII from log output. Default: `true` |
| `options.piiRedactionOptions` | `Record<string, unknown>` | Custom PII redaction options |

## Methods

| Method | Description |
|--------|-------------|
| `log(message, context?)` | Info level log |
| `error(message, trace?, context?)` | Error level log |
| `warn(message, context?)` | Warning level log |
| `debug(message, context?)` | Debug level log |

## Auto-Configuration

When using `AuthModule.forRoot()`, the logger is automatically configured. Manual setup is only needed for custom logging.

## Related

- [AuthModule](/docs/api/nestjs/overview)

