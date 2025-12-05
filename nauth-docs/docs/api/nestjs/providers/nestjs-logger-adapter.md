---
title: NestJsLoggerAdapter
description: NestJS logger adapter for NAuth logging
keywords: [nestjs, logger, adapter, api]
image: /img/api-social-card.png
sidebar_position: 1
---

# NestJsLoggerAdapter

**Package:** `@nauth-toolkit/nestjs`
**Type:** Logger Adapter

Adapts NestJS Logger to NAuth's LoggerService interface.

## Import

```typescript
import { NestJsLoggerAdapter } from '@nauth-toolkit/nestjs';
```

## Usage

```typescript
import { Logger } from '@nestjs/common';
import { NestJsLoggerAdapter } from '@nauth-toolkit/nestjs';

const nestLogger = new Logger('NAuth');
const logger = new NestJsLoggerAdapter(nestLogger);
```

## Constructor

```typescript
new NestJsLoggerAdapter(logger: Logger)
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `logger` | `Logger` | NestJS Logger instance |

## Methods

| Method | Description |
|--------|-------------|
| `log(message, context?)` | Info level log |
| `error(message, trace?, context?)` | Error level log |
| `warn(message, context?)` | Warning level log |
| `debug(message, context?)` | Debug level log |
| `verbose(message, context?)` | Verbose level log |

## Auto-Configuration

When using `AuthModule.forRoot()`, the logger is automatically configured. Manual setup is only needed for custom logging.

## Related

- [AuthModule](/docs/api/nestjs/overview)

