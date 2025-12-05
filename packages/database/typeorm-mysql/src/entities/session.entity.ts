import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
  VersionColumn,
} from 'typeorm';
import { BaseSession } from '@nauth-toolkit/core';
import { User } from './user.entity';

/**
 * TypeORM MySQL Session Entity
 *
 * Extends BaseSession from core and adds MySQL-specific TypeORM decorators.
 * All field definitions and business logic are in the base class.
 */
@Entity('nauth_sessions')
@Index(['userId'])
@Index(['accessTokenHash'])
@Index(['refreshTokenHash'])
@Index(['deviceId'])
@Index(['expiresAt'])
@Index(['isRevoked'])
// Hot-path composite indexes validated against query patterns
@Index(['refreshTokenHash', 'isRevoked'])
@Index(['userId', 'isRevoked'])
@Index(['userId', 'isRevoked', 'createdAt'])
@Index(['userId', 'isRevoked', 'expiresAt'])
@Index(['userId', 'deviceId'])
@Index(['userId', 'ipAddress'])
@Index(['userId', 'ipCountry'])
@Index(['tokenFamily', 'isRevoked'])
export class Session extends BaseSession {
  @PrimaryGeneratedColumn()
  declare id: number;

  @VersionColumn()
  declare version: number;

  @Column({ type: 'int' })
  declare userId: number;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user!: User;

  @Column({ type: 'varchar', length: 255 })
  declare accessTokenHash: string;

  @Column({ type: 'varchar', length: 255 })
  declare refreshTokenHash: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  declare tokenFamily?: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  declare deviceId?: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  declare deviceName?: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  declare deviceType?: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  declare deviceFingerprint?: string | null;

  @Column({ type: 'varchar', length: 45, nullable: true })
  declare ipAddress?: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  declare ipCountry?: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  declare ipCity?: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  declare ipIsp?: string | null;

  @Column({ type: 'text', nullable: true })
  declare userAgent?: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  declare platform?: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  declare browser?: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  declare authMethod?: string | null;

  @Column({ type: 'tinyint', width: 1, default: 0 })
  declare isRemembered: boolean;

  @Column({ type: 'tinyint', width: 1, default: 0 })
  declare isTrustedDevice: boolean;

  @Column({ type: 'timestamp', precision: 6 })
  declare expiresAt: Date;

  @Column({ type: 'timestamp', precision: 6, nullable: true })
  declare lastActivityAt?: Date | null;

  @Column({ type: 'tinyint', width: 1, default: 0 })
  declare isRevoked: boolean;

  @Column({ type: 'timestamp', precision: 6, nullable: true })
  declare revokedAt?: Date | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  declare revokeReason?: string | null;

  @Column({ type: 'json', nullable: true })
  declare metadata?: Record<string, unknown> | null;

  @CreateDateColumn({ type: 'timestamp', precision: 6, default: () => 'CURRENT_TIMESTAMP(6)' })
  declare createdAt: Date;
}
