import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseAuthAudit, AuthAuditEventType, type AuthAuditEventStatus } from '@nauth-toolkit/core';
import { User } from './user.entity';

/**
 * TypeORM PostgreSQL Authentication Audit Entity
 *
 * Extends BaseAuthAudit from core and adds PostgreSQL-specific TypeORM decorators.
 * All field definitions and business logic are in the base class.
 *
 * **Indexes:**
 * Optimized for common query patterns:
 * - User history queries (userId + createdAt)
 * - Event type queries (eventType + createdAt)
 * - Status filtering (eventStatus + createdAt)
 * - Date range queries (createdAt)
 * - Risk-based queries (riskFactor + createdAt)
 * - Adaptive MFA analysis (adaptiveMfaTriggered + createdAt)
 * - Authentication method analysis (authMethod + createdAt)
 * - User-specific event type queries (userId + eventType + createdAt)
 */
@Entity('nauth_auth_audit')
@Index(['userId', 'createdAt'])
@Index(['eventType', 'createdAt'])
@Index(['eventStatus', 'createdAt'])
@Index(['createdAt'])
@Index(['riskFactor', 'createdAt'])
@Index(['adaptiveMfaTriggered', 'createdAt'])
@Index(['authMethod', 'createdAt'])
@Index(['userId', 'eventType', 'createdAt'])
// Risk-detection fallback query (userId + ipAddress)
@Index(['userId', 'ipAddress'])
export class AuthAudit extends BaseAuthAudit {
  @PrimaryGeneratedColumn()
  declare id: number;

  @Column({ type: 'int' })
  declare userId: number;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user!: User;

  @Column({ type: 'varchar', length: 50 })
  declare eventType: AuthAuditEventType;

  @Column({ type: 'varchar', length: 20 })
  declare eventStatus: AuthAuditEventStatus;

  @Column({ type: 'integer', nullable: true })
  declare riskFactor?: number | null;

  @Column({ type: 'text', array: true, nullable: true })
  declare riskFactors?: string[] | null;

  @Column({ type: 'boolean', nullable: true })
  declare adaptiveMfaTriggered?: boolean | null;

  @Column({ type: 'varchar', length: 45, nullable: true })
  declare ipAddress?: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  declare ipCountry?: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  declare ipCity?: string | null;

  @Column({ type: 'decimal', precision: 10, scale: 6, nullable: true })
  declare ipLatitude?: number | null;

  @Column({ type: 'decimal', precision: 10, scale: 6, nullable: true })
  declare ipLongitude?: number | null;

  @Column({ type: 'text', nullable: true })
  declare userAgent?: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  declare platform?: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  declare browser?: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  declare deviceId?: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  declare deviceName?: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  declare deviceType?: string | null;

  @Column({ type: 'int', nullable: true })
  declare sessionId?: number | null;

  @Column({ type: 'int', nullable: true })
  declare challengeSessionId?: number | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  declare authMethod?: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  declare performedBy?: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  declare reason?: string | null;

  @Column({ type: 'text', nullable: true })
  declare description?: string | null;

  @Column({ type: 'jsonb', nullable: true })
  declare metadata?: Record<string, unknown> | null;

  @CreateDateColumn({ type: 'timestamptz' })
  declare createdAt: Date;
}
