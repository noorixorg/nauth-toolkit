import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseVerificationToken } from '@nauth-toolkit/core';
import { User } from './user.entity';

/**
 * TypeORM PostgreSQL Verification Token Entity
 *
 * Extends BaseVerificationToken from core and adds PostgreSQL-specific TypeORM decorators.
 * All field definitions and business logic are in the base class.
 */
@Entity('nauth_verification_tokens')
@Index(['userId', 'type'])
@Index(['token'])
export class VerificationToken extends BaseVerificationToken {
  @PrimaryGeneratedColumn()
  declare id: number;

  @Column({ type: 'int' })
  declare userId: number;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user!: User;

  @Column({ type: 'int', nullable: true })
  declare challengeSessionId?: number | null;

  @Column({ type: 'varchar', length: 20 })
  declare type: 'email' | 'phone' | 'password_reset';

  @Column({ type: 'varchar', length: 255 })
  declare token: string;

  @Column({ type: 'varchar', length: 10, nullable: true })
  declare code?: string | null;

  @Column({ type: 'timestamptz' })
  declare expiresAt: Date;

  @Column({ type: 'int', default: 0 })
  declare attempts: number;

  @Column({ type: 'timestamptz', nullable: true })
  declare usedAt?: Date | null;

  @Column({ type: 'varchar', length: 45, nullable: true })
  declare ipAddress?: string | null;

  @Column({ type: 'text', nullable: true })
  declare userAgent?: string | null;

  @Column({ type: 'jsonb', nullable: true })
  declare metadata?: Record<string, unknown> | null;

  @CreateDateColumn({ type: 'timestamptz' })
  declare createdAt: Date;
}
