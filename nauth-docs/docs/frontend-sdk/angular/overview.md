---
title: Angular Overview
description: Angular integration overview for nauth-toolkit client SDK
keywords: [angular, integration, service, interceptor, guard]
image: /img/api-social-card.png
sidebar_class_name: hidden
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Angular Integration

**Package:** `@nauth-toolkit/client-angular`
**Supports:** Angular 17+ (both NgModule and Standalone)

The Angular adapter wraps `@nauth-toolkit/client` with Angular-specific features: dependency injection, RxJS observables, HTTP interceptor, and route guards.

## Choose Your Setup

| Approach | Entry Point | Best For |
| -------- | ----------- | -------- |
| **[Standalone Setup](./standalone-setup)** | `@nauth-toolkit/client-angular/standalone` | New apps, Angular 17+, functional APIs |
| **[NgModule Setup](./ngmodule-setup)** | `@nauth-toolkit/client-angular` | Existing NgModule apps, class-based patterns |

Both approaches provide the same `AuthService`, interceptor, and guards — the difference is how you register them.

## Features

- **AuthService** — Injectable wrapper with RxJS Observables (`currentUser$`, `isAuthenticated$`, `challenge$`)
- **HTTP Interceptor** — Automatic token refresh, CSRF handling, device trust headers
- **Route Guards** — Protect routes with `authGuard()` (functional) or `AuthGuard` (class-based)
- **OAuth Callback Guard** — Handle social login redirects automatically

## Related Documentation

- [Standalone Setup](./standalone-setup) - Recommended for new apps
- [NgModule Setup](./ngmodule-setup) - Traditional module approach
- [AuthService API](./auth-service) - Full service reference
- [Guards](./guards) - Route guard configuration
- [HTTP Interceptor](./interceptor) - Interceptor behavior
