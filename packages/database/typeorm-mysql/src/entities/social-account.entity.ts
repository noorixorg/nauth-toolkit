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
 * TypeORM MySQL Social Account Entity
 *
 * Extends BaseSocialAccount from core and adds MySQL-specific TypeORM decorators.
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

  @Column({ type: 'timestamp', precision: 6 })
  declare linkedAt: Date;

  @Column({ type: 'timestamp', precision: 6, nullable: true })
  declare lastUsedAt?: Date | null;

  @Column({ type: 'json', nullable: true })
  declare metadata?: Record<string, unknown> | null;

  @CreateDateColumn({ type: 'timestamp', precision: 6, default: () => 'CURRENT_TIMESTAMP(6)' })
  declare createdAt: Date;

  @UpdateDateColumn({
    type: 'timestamp',
    precision: 6,
    default: () => 'CURRENT_TIMESTAMP(6)',
    onUpdate: 'CURRENT_TIMESTAMP(6)',
  })
  declare updatedAt: Date;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user!: User;
}
