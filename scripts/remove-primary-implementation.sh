#!/bin/bash
# Comprehensive cleanup script to remove ALL isPrimary/Primary implementation
# Run this from the monorepo root: bash scripts/remove-primary-implementation.sh

set -e

echo "========================================="
echo "Removing ALL isPrimary/Primary traces"
echo "========================================="

# Step 1: Delete the SetPrimaryDevice DTO file
echo "Step 1: Removing SetPrimaryDevice DTO..."
rm -f packages/core/src/dto/set-primary-device.dto.ts

# Step 2: Remove from exports
echo "Step 2: Removing from dto/index.ts exports..."
sed -i '' "/set-primary-device.dto/d" packages/core/src/dto/index.ts

# Step 3: Remove setPrimaryDevice method from mfa.service.ts (lines 1198-1227 approximately)
echo "Step 3: Will need manual removal of setPrimaryDevice method from mfa.service.ts"
echo "  - Search for 'async setPrimaryDevice' and delete entire method"
echo "  - Remove all isPrimary update logic in setPreferredMethod"
echo "  - Remove isPrimary updates in verifyMfaSetup"

# Step 4: Remove isPrimary from database entities
echo "Step 4: Database entities need manual update:"
echo "  - packages/database/typeorm-postgres/src/entities/mfa-device.entity.ts"
echo "  - packages/database/typeorm-mysql/src/entities/mfa-device.entity.ts"
echo "  - packages/core/src/entities/mfa-device.entity.ts"
echo "  - packages/core/src/interfaces/entities.interface.ts"
echo "  Remove: @Column({ type: 'boolean', default: false }) isPrimary: boolean;"

# Step 5: Create migration to drop isPrimary column
echo "Step 5: Create migration to drop isPrimary column"
echo "  Migration needed in both MySQL and Postgres"

# Step 6: Remove from MFA providers
echo "Step 6: MFA providers - remove isPrimary from DTOs and logic:"
echo "  - packages/mfa/totp/src/dto/mfa.dto.ts"
echo "  - packages/mfa/passkey/src/dto/mfa.dto.ts"
echo "  - packages/mfa/sms/src/dto/mfa.dto.ts"
echo "  - packages/mfa/email/src/email-mfa-provider.service.ts"

# Step 7: Remove from client SDK
echo "Step 7: Client SDK - remove isPrimary references"
echo "  - packages/client/src/types/mfa.types.ts (MFADevice interface)"
echo "  - packages/client/src/core/client.ts (setPrimaryMfaDevice method)"
echo "  - packages/client-angular/src/ngmodule/auth.service.ts"

# Step 8: Remove from sample apps
echo "Step 8: Sample apps - remove setPrimaryDevice calls"
echo "  - examples/sample-angular/src/app/dashboard/mfa/mfa.component.ts"
echo "  - examples/sample-angular/src/app/dashboard/profile/profile.component.ts"
echo "  - examples/sample-nestjs/src/auth/auth.controller.ts"
echo "  - examples/sample-express/src/routes/auth.routes.ts"
echo "  - examples/sample-fastify/src/routes/auth.routes.ts"

# Step 9: Remove from tests
echo "Step 9: Tests - remove isPrimary assertions"
echo "  - All .spec.ts files"

echo ""
echo "========================================="
echo "MANUAL STEPS REQUIRED:"
echo "========================================="
echo "This script identified files that need manual edits."
echo "The removal is too complex for automated sed/awk."
echo ""
echo "Please manually:"
echo "1. Delete setPrimaryDevice method from mfa.service.ts"
echo "2. Remove isPrimary from all database entities"
echo "3. Create migration to DROP COLUMN isPrimary"
echo "4. Remove isPrimary from all MFA device DTOs"
echo "5. Remove setPrimaryMfaDevice from client SDK"
echo "6. Remove all setPrimary calls from sample apps"
echo "7. Update all tests"
echo ""
echo "Use: rg 'isPrimary|setPrimary' to find remaining references"
echo "========================================="
