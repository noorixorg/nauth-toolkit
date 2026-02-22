---
title: Interfaces
description: TypeScript interfaces for configuration, providers, and platform adapters
keywords: [interfaces, types, config, providers, adapter, api]
image: /img/api-social-card.png
---
# Interfaces

**Package:** `@nauth-toolkit/core`
**Type:** TypeScript Interfaces

## Configuration

- [Configuration](/docs/concepts/configuration) - Complete `NAuthConfig` reference (single source of truth)
- [SMSTemplateEngine](./sms-template-engine) - Template engine contract for SMS templates

## Providers

- [EmailProvider](./email-provider) - Contract for sending emails
- [SMSProvider](./sms-provider) - Contract for sending SMS messages (templates supported)
- [StorageAdapter](./storage-adapter) - Shared state adapter (rate limits, locks, token reuse)

## Entities (interfaces)

- [IUser](./user) - User record contract
- [ISession](./session) - Session record contract

## Platform adapter contracts

- [NAuthAdapter](./nauth-adapter) - Framework adapter contract
- [NAuthRequest](./nauth-request) - Framework-agnostic request shape
- [NAuthResponse](./nauth-response) - Framework-agnostic response contract

## Related

- [Configuration](/docs/concepts/configuration)
- [How It Works — Framework Support](/docs/concepts/how-it-works#framework-support)

