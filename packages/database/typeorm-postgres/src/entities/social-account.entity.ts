import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
  Unique,
} from 'typeorm';
import { BaseSocialAccount } from '@nauth-toolkit/core';
import { User } from './user.entity';

/**
 * TypeORM PostgreSQL Social Account Entity
 *
 * Extends BaseSocialAccount from core and adds PostgreSQL-specific TypeORM decorators.
 * All field definitions and business logic are in the base class.
 */
@Entity('nauth_social_accounts')
@Unique(['provider', 'providerId']) // One provider account = one user
@Index(['userId']) // Fast lookup of user's social accounts
@Index(['providerEmail']) // For linking by email
export class SocialAccount extends BaseSocialAccount {
  @PrimaryGeneratedColumn()
  declare id: number;

  @Column({ type: 'int' })
  declare userId: number;

  @Column({ type: 'varchar', length: 50 })
  declare provider: string;

  @Column({ type: 'varchar', length: 255 })
  declare providerId: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  declare providerEmail?: string | null;

  @Column({ type: 'timestamptz' })
  declare linkedAt: Date;

  @Column({ type: 'timestamptz', nullable: true })
  declare lastUsedAt?: Date | null;

  @Column({ type: 'jsonb', nullable: true })
  declare metadata?: Record<string, unknown> | null;

  @CreateDateColumn({ type: 'timestamptz' })
  declare createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  declare updatedAt: Date;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user!: User;
}
