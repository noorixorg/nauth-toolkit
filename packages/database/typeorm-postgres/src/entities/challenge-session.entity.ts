import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn, Index } from 'typeorm';
import { BaseChallengeSession } from '@nauth-toolkit/core';
import { User } from './user.entity';

/**
 * TypeORM PostgreSQL Challenge Session Entity
 *
 * Extends BaseChallengeSession from core and adds PostgreSQL-specific TypeORM decorators.
 * All field definitions and business logic are in the base class.
 */
@Entity('nauth_challenge_sessions')
@Index(['userId'])
@Index(['expiresAt'])
@Index(['challengeName'])
@Index(['userId', 'isCompleted'])
export class ChallengeSession extends BaseChallengeSession {
  @PrimaryGeneratedColumn()
  declare id: number;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user!: User;

  @Column()
  declare userId: number;

  @Column({ length: 50 })
  declare challengeName: string;

  @Column({ unique: true, length: 255 })
  declare sessionToken: string;

  @Column({ type: 'timestamptz' })
  declare expiresAt: Date;

  @Column({ default: false })
  declare isCompleted: boolean;

  @Column({ type: 'timestamptz', nullable: true })
  declare completedAt?: Date;

  @Column({ default: 0 })
  declare attempts: number;

  @Column({ default: 3 })
  declare maxAttempts: number;

  @Column({ type: 'jsonb', nullable: true })
  declare challengeParameters: Record<string, unknown> | null;

  // Alias for challengeParameters (backwards compatibility)
  @Column({ type: 'jsonb', nullable: true })
  declare metadata?: Record<string, unknown>;

  @Column({ length: 45, nullable: true })
  declare ipAddress: string | null;

  @Column({ type: 'text', nullable: true })
  declare userAgent: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  declare createdAt: Date;
}
