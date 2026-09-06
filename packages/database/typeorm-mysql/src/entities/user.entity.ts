import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  Index,
  BeforeInsert,
  AfterLoad,
} from 'typeorm';
import { BaseUser } from '@nauth-toolkit/core';
import * as crypto from 'crypto';

/**
 * TypeORM MySQL User Entity
 *
 * Extends BaseUser from core and adds MySQL-specific TypeORM decorators.
 * All field definitions and business logic are in the base class.
 *
 * @remarks
 * MySQL-specific mappings:
 * - uuid → char(36) (MySQL doesn't support native UUID type)
 * - jsonb → json (MySQL uses json, not jsonb)
 * - simple-array → json (MySQL doesn't support native arrays)
 * - boolean → tinyint(1) (MySQL boolean is actually tinyint)
 * - timestamp → datetime (MySQL uses datetime)
 *
 * @example
 * ```typescript
 * import { User } from '@nauth-toolkit/database-typeorm-mysql';
 * import { getNAuthEntities } from '@nauth-toolkit/database-typeorm-mysql';
 *
 * TypeOrmModule.forRoot({
 *   type: 'mysql',
 *   entities: getNAuthEntities(),
 * })
 * ```
 */
@Entity('nauth_users')
@Index(['sub'], { unique: true })
@Index(['email'], { unique: true })
@Index(['username'], { unique: true })
@Index(['phone'])
@Index(['isActive'])
@Index(['hasSocialAuth'])
export class User extends BaseUser {
  @PrimaryGeneratedColumn()
  declare id: number;

  @Column({ type: 'char', length: 36 })
  declare sub: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  declare username: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  declare firstName: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  declare lastName: string | null;

  @Column({ type: 'varchar', length: 255 })
  declare email: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  declare phone: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  declare passwordHash: string | null;

  @Column({ type: 'timestamp', precision: 6, nullable: true })
  declare passwordChangedAt: Date | null;

  @Column({ type: 'json', nullable: true })
  declare passwordHistory: string[] | null;

  @Column({ type: 'boolean', default: false })
  declare mustChangePassword: boolean;

  @Column({ type: 'boolean', default: false })
  declare isEmailVerified: boolean;

  @Column({ type: 'boolean', default: false })
  declare isPhoneVerified: boolean;

  @Column({ type: 'boolean', default: true })
  declare isActive: boolean;

  @Column({ type: 'boolean', default: false })
  declare isLocked: boolean;

  @Column({ type: 'varchar', length: 100, nullable: true })
  declare lockReason: string | null;

  @Column({ type: 'timestamp', precision: 6, nullable: true })
  declare lockedAt: Date | null;

  @Column({ type: 'timestamp', precision: 6, nullable: true })
  declare lockedUntil: Date | null;

  @Column({ type: 'int', default: 0 })
  declare failedLoginAttempts: number;

  @Column({ type: 'timestamp', precision: 6, nullable: true })
  declare lastFailedLoginAt: Date | null;

  @Column({ type: 'timestamp', precision: 6, nullable: true })
  declare lastLoginAt: Date | null;

  @Column({ type: 'varchar', length: 45, nullable: true })
  declare lastLoginIp: string | null;

  @Column({ type: 'boolean', default: false })
  declare mfaEnabled: boolean;

  @Column({ type: 'json', nullable: true })
  declare mfaMethods: string[] | null;

  @Column({ type: 'timestamp', precision: 6, nullable: true })
  declare mfaEnforcedAt?: Date | null;

  @Column({ type: 'text', nullable: true })
  declare totpSecret?: string | null;

  @Column({ type: 'json', nullable: true })
  declare backupCodes: string[] | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  declare preferredMfaMethod: string | null;

  @Column({ type: 'boolean', default: false })
  declare mfaExempt?: boolean;

  @Column({ type: 'varchar', length: 500, nullable: true })
  declare mfaExemptReason?: string | null;

  @Column({ type: 'timestamp', precision: 6, nullable: true })
  declare mfaExemptGrantedAt?: Date | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  declare mfaExemptGrantedBy?: string | null;

  @Column({ type: 'boolean', default: false })
  declare hasSocialAuth: boolean;

  @Column({ type: 'json', nullable: true })
  declare socialProviders: string[] | null;

  @Column({ type: 'json', nullable: true })
  declare metadata: Record<string, unknown> | null;

  @CreateDateColumn({ type: 'timestamp', precision: 6, default: () => 'CURRENT_TIMESTAMP(6)' })
  declare createdAt: Date;

  @UpdateDateColumn({
    type: 'timestamp',
    precision: 6,
    default: () => 'CURRENT_TIMESTAMP(6)',
    onUpdate: 'CURRENT_TIMESTAMP(6)',
  })
  declare updatedAt: Date;

  @DeleteDateColumn({ type: 'timestamp', precision: 6, nullable: true })
  declare deletedAt: Date | null;

  /**
   * Whether this user has a password set
   * Computed field - derived from passwordHash at runtime via @AfterLoad hook
   */
  declare hasPasswordHash?: boolean;

  /**
   * Generate UUID for sub field before insert (MySQL doesn't support @Generated('uuid'))
   */
  @BeforeInsert()
  generateSub(): void {
    if (!this.sub) {
      this.sub = crypto.randomUUID();
    }
  }

  /**
   * Compute hasPasswordHash from passwordHash
   *
   * This hook runs after the entity is loaded from the database.
   * It computes the boolean flag. Note: passwordHash is NOT deleted here
   * to allow AuthService.getUserForAuthContext() to check it before deletion.
   * The service method handles passwordHash deletion after computing hasPasswordHash.
   */
  @AfterLoad()
  computeHasPasswordHash(): void {
    // Compute hasPasswordHash from passwordHash
    // NOTE: Do NOT delete passwordHash here - it's needed by AuthService.getUserForAuthContext()
    // The service method will delete it after computing hasPasswordHash
    this.hasPasswordHash = Boolean(this.passwordHash);
  }
}
