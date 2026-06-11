import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index, ManyToOne, JoinColumn } from 'typeorm';
import { BaseLoginAttempt } from '@nauth-toolkit/core';
import { User } from './user.entity';

/**
 * TypeORM MySQL Login Attempt Entity
 *
 * Extends BaseLoginAttempt from core and adds MySQL-specific TypeORM decorators.
 * All field definitions and business logic are in the base class.
 *
 * @remarks
 * Login attempts preserve audit trail even after user deletion (onDelete: 'SET NULL').
 * This allows tracking of security events and failed login attempts for deleted accounts.
 */
@Entity('nauth_login_attempts')
@Index(['email', 'createdAt'])
@Index(['ipAddress', 'createdAt'])
export class LoginAttempt extends BaseLoginAttempt {
  @PrimaryGeneratedColumn()
  declare id: number;

  @Column({ type: 'varchar', length: 255, nullable: true })
  declare email?: string | null;

  @Column({ type: 'int', nullable: true })
  declare userId?: number | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'userId' })
  user?: User | null;

  @Column({ type: 'varchar', length: 45, nullable: true })
  declare ipAddress?: string | null;

  @Column({ type: 'text', nullable: true })
  declare userAgent?: string | null;

  @Column({ type: 'tinyint', width: 1 })
  declare success: boolean;

  @Column({ type: 'varchar', length: 100, nullable: true })
  declare failureReason?: string | null;

  @Column({ type: 'tinyint', width: 1, default: 0 })
  declare mfaRequired: boolean;

  @Column({ type: 'json', nullable: true })
  declare metadata?: Record<string, unknown> | null;

  @CreateDateColumn({ type: 'timestamp', precision: 6, default: () => 'CURRENT_TIMESTAMP(6)' })
  declare createdAt: Date;
}
