---
title: OpenAPI DTO Schemas
description: Use nauth-toolkit's generated OpenAPI component schemas so Swagger UI can expand DTO request/response bodies correctly.
keywords: [openapi, swagger, dto, schema, components, nestjs, express]
image: /img/api-social-card.png
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# OpenAPI DTO Schemas

nauth-toolkit ships **framework-agnostic** OpenAPI component schemas generated at build time. Consumer apps can merge these schemas into their OpenAPI document so Swagger UI can **expand DTO objects** correctly (even when DTOs come from `node_modules`).

## One complete example (recommended)

### 1) Create a single schema map in your app

Create a file like `src/openapi-schemas.ts`:

```typescript
import { loadNAuthOpenApiSchemas as loadCoreSchemas } from '@nauth-toolkit/core/openapi';
import { loadNAuthOpenApiSchemas as loadEmailMfaSchemas } from '@nauth-toolkit/mfa-email/openapi';
import { loadNAuthOpenApiSchemas as loadSmsMfaSchemas } from '@nauth-toolkit/mfa-sms/openapi';
import { loadNAuthOpenApiSchemas as loadTotpMfaSchemas } from '@nauth-toolkit/mfa-totp/openapi';
import { loadNAuthOpenApiSchemas as loadPasskeyMfaSchemas } from '@nauth-toolkit/mfa-passkey/openapi';
import { loadNAuthOpenApiSchemas as loadAppleSocialSchemas } from '@nauth-toolkit/social-apple/openapi';
import { loadNAuthOpenApiSchemas as loadGoogleSocialSchemas } from '@nauth-toolkit/social-google/openapi';
import { loadNAuthOpenApiSchemas as loadFacebookSocialSchemas } from '@nauth-toolkit/social-facebook/openapi';

export const schemas = {
  ...loadCoreSchemas(),
  ...loadEmailMfaSchemas(),
  ...loadSmsMfaSchemas(),
  ...loadTotpMfaSchemas(),
  ...loadPasskeyMfaSchemas(),
  ...loadAppleSocialSchemas(),
  ...loadGoogleSocialSchemas(),
  ...loadFacebookSocialSchemas(),
};
```

### 2) Use the schema map in your OpenAPI setup

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

Merge schemas into the Nest Swagger document:

```typescript
import { NestFactory } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { schemas } from './openapi-schemas';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const config = new DocumentBuilder()
    .setTitle('My API')
    .setVersion('1.0.0')
    .build();

  const doc = SwaggerModule.createDocument(app, config);

  doc.components = doc.components ?? {};
  doc.components.schemas = {
    ...(doc.components.schemas ?? {}),
    ...schemas,
  };

  SwaggerModule.setup('docs', app, doc);
  await app.listen(3000);
}

bootstrap();
```

Controllers can remain clean (no extra Swagger decorators required):

```typescript
import { Controller, Post, Body } from '@nestjs/common';
import { SignupDTO, AuthResponseDTO } from '@nauth-toolkit/core';

@Controller('auth')
export class AuthController {
  @Post('signup')
  async signup(@Body() dto: SignupDTO): Promise<AuthResponseDTO> {
    // ...
    return {} as AuthResponseDTO;
  }
}
```

### Optional: Swagger decorators examples (POST/GET/DELETE)

If you want Swagger UI to show **explicit request/response schemas**, you can add decorators.

#### POST (body + response)

```typescript
import { Controller, Post, Body } from '@nestjs/common';
import { ApiBody, ApiOkResponse } from '@nestjs/swagger';
import { SignupDTO, AuthResponseDTO } from '@nauth-toolkit/core';

@Controller('auth')
export class AuthController {
  @Post('signup')
  @ApiBody({ schema: { $ref: '#/components/schemas/SignupDTO' } })
  @ApiOkResponse({ schema: { $ref: '#/components/schemas/AuthResponseDTO' } })
  async signup(@Body() dto: SignupDTO): Promise<AuthResponseDTO> {
    // ...
    return {} as AuthResponseDTO;
  }
}
```

#### GET (path params + query params)

For GET requests you **do not** use `@ApiBody()`.

```typescript
import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiOkResponse } from '@nestjs/swagger';
import { GetUserByIdDTO, UserResponseDto, GetUsersDTO, GetUsersResponseDTO } from '@nauth-toolkit/core';

@Controller('auth')
export class AuthController {
  @Get('admin/users/:sub')
  @ApiOkResponse({ schema: { $ref: '#/components/schemas/UserResponseDto' } })
  async getUserBySub(@Param() dto: GetUserByIdDTO): Promise<UserResponseDto | null> {
    return null;
  }

  @Get('admin/users')
  @ApiOkResponse({ schema: { $ref: '#/components/schemas/GetUsersResponseDTO' } })
  async getUsers(@Query() query: GetUsersDTO): Promise<GetUsersResponseDTO> {
    return { users: [], pagination: { page: 1, limit: 50, total: 0, totalPages: 0 } };
  }
}
```

**Note on params/query in Swagger UI:** NestJS Swagger can auto-expand `@Param()` and `@Query()` DTOs **only** if the DTO class has `@ApiProperty()` decorators on each field. Since `nauth-toolkit` DTOs are platform-agnostic (no framework-specific decorators), they won't auto-expand in Swagger UI. The params/query will still work at runtime via `class-validator`, but Swagger UI won't show individual input fields for each property. If you need full Swagger UI expansion, you'd have to manually add `@ApiParam()` or `@ApiQuery()` decorators for each field (tedious, not recommended). The response schemas will expand correctly.

#### DELETE (path params + response)

```typescript
import { Controller, Delete, Param } from '@nestjs/common';
import { ApiOkResponse } from '@nestjs/swagger';
import { DeleteUserDTO, DeleteUserResponseDTO, LogoutSessionDTO, LogoutSessionResponseDTO } from '@nauth-toolkit/core';

@Controller('auth')
export class AuthController {
  @Delete('admin/users/:sub')
  @ApiOkResponse({ schema: { $ref: '#/components/schemas/DeleteUserResponseDTO' } })
  async deleteUser(@Param() dto: DeleteUserDTO): Promise<DeleteUserResponseDTO> {
    return { success: true, message: 'User deleted' };
  }

  @Delete('sessions/:sessionId')
  @ApiOkResponse({ schema: { $ref: '#/components/schemas/LogoutSessionResponseDTO' } })
  async revokeSession(@Param() dto: LogoutSessionDTO): Promise<LogoutSessionResponseDTO> {
    return { success: true, message: 'Session revoked' };
  }
}
```

**Same limitation applies:** Path parameters won't auto-expand in Swagger UI without `@ApiProperty()` decorators on the DTO. They'll work at runtime, but Swagger UI won't show param details unless you manually add `@ApiParam()` decorators.

</TabItem>
<TabItem value="express" label="Express">

Merge the schemas into your OpenAPI document and reference them in your endpoint definitions.

```typescript
import express from 'express';
import swaggerUi from 'swagger-ui-express';
import { schemas } from './openapi-schemas';

const app = express();

const openapi = {
  openapi: '3.0.3',
  info: { title: 'My API', version: '1.0.0' },
  components: {
    schemas: {
      ...schemas,
    },
  },
  paths: {
    '/auth/signup': {
      post: {
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/SignupDTO' },
            },
          },
        },
        responses: {
          '200': {
            description: 'OK',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/AuthResponseDTO' },
              },
            },
          },
        },
      },
    },
  },
};

app.use('/docs', swaggerUi.serve, swaggerUi.setup(openapi));
```

</TabItem>
</Tabs>

## Notes

- The OpenAPI schemas are **shape-first** (properties, required/optional, nesting). They are generated from TypeScript types, not runtime validation metadata.

