import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn, Index } from 'typeorm';
import { BaseChallengeSession } from '@nauth-toolkit/core';
import { User } from './user.entity';

/**
 * TypeORM MySQL Challenge Session Entity
 *
 * Extends BaseChallengeSession from core and adds MySQL-specific TypeORM decorators.
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

  @Column({ type: 'int' })
  declare userId: number;

  @Column({ type: 'varchar', length: 50 })
  declare challengeName: string;

  @Column({ type: 'varchar', length: 255, unique: true })
  declare sessionToken: string;

  @Column({ type: 'timestamp', precision: 6 })
  declare expiresAt: Date;

  @Column({ type: 'tinyint', width: 1, default: 0 })
  declare isCompleted: boolean;

  @Column({ type: 'timestamp', precision: 6, nullable: true })
  declare completedAt?: Date;

  @Column({ type: 'int', default: 0 })
  declare attempts: number;

  @Column({ type: 'int', default: 3 })
  declare maxAttempts: number;

  @Column({ type: 'json', nullable: true })
  declare challengeParameters?: Record<string, unknown>;

  // Alias for challengeParameters (backwards compatibility)
  @Column({ type: 'json', nullable: true })
  declare metadata?: Record<string, unknown>;

  @Column({ type: 'varchar', length: 45, nullable: true })
  declare ipAddress?: string;

  @Column({ type: 'text', nullable: true })
  declare userAgent?: string;

  @CreateDateColumn({ type: 'timestamp', precision: 6, default: () => 'CURRENT_TIMESTAMP(6)' })
  declare createdAt: Date;
}
