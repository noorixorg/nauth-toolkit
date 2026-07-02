import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { BaseApiKey } from '@nauth-toolkit/core';
import { User } from './user.entity';

/**
 * TypeORM MySQL API Key Entity
 *
 * Extends BaseApiKey from core and adds MySQL-specific TypeORM decorators.
 * All field definitions and business logic are in the base class.
 *
 * MySQL type mapping:
 * - uuid → char(36)
 * - simple-array → json (MySQL doesn't support native arrays)
 * - timestamptz → timestamp(6) (MySQL uses datetime/timestamp)
 * - boolean → tinyint(1)
 * - jsonb → json
 */
@Entity('nauth_api_keys')
@Index(['keyId'], { unique: true })
@Index(['lookupId'], { unique: true })
@Index(['userId'])
@Index(['isActive'])
@Index(['expiresAt'])
export class ApiKey extends BaseApiKey {
  @PrimaryGeneratedColumn()
  declare id: number;

  @Column({ type: 'char', length: 36 })
  declare keyId: string;

  @Column({ type: 'int' })
  declare userId: number;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user!: User;

  @Column({ type: 'varchar', length: 64 })
  declare lookupId: string;

  @Column({ type: 'varchar', length: 128 })
  declare keyHash: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  declare name?: string | null;

  @Column({ type: 'varchar', length: 8, nullable: true })
  declare lastFour?: string | null;

  @Column({ type: 'json', nullable: true })
  declare allowedIps?: string[] | null;

  @Column({ type: 'timestamp', precision: 6, nullable: true })
  declare expiresAt?: Date | null;

  @Column({ type: 'tinyint', width: 1, default: 1 })
  declare isActive: boolean;

  @Column({ type: 'timestamp', precision: 6, nullable: true })
  declare revokedAt?: Date | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  declare revokeReason?: string | null;

  @Column({ type: 'tinyint', width: 1, default: 0 })
  declare createdByAdmin: boolean;

  @Column({ type: 'timestamp', precision: 6, nullable: true })
  declare lastUsedAt?: Date | null;

  @Column({ type: 'varchar', length: 45, nullable: true })
  declare lastUsedIp?: string | null;

  @Column({ type: 'int', default: 0 })
  declare usageCount: number;

  @Column({ type: 'json', nullable: true })
  declare metadata?: Record<string, unknown> | null;

  @CreateDateColumn({ type: 'timestamp', precision: 6, default: () => 'CURRENT_TIMESTAMP(6)' })
  declare createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp', precision: 6, default: () => 'CURRENT_TIMESTAMP(6)', onUpdate: 'CURRENT_TIMESTAMP(6)' })
  declare updatedAt: Date;
}
