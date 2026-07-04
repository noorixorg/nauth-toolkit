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
 * TypeORM PostgreSQL API Key Entity
 *
 * Extends BaseApiKey from core and adds PostgreSQL-specific TypeORM decorators.
 * All field definitions and business logic are in the base class.
 */
@Entity('nauth_api_keys')
@Index(['keyId'], { unique: true })
@Index(['keyHash'], { unique: true })
@Index(['userId'])
@Index(['isActive'])
@Index(['expiresAt'])
export class ApiKey extends BaseApiKey {
  @PrimaryGeneratedColumn()
  declare id: number;

  @Column({ type: 'uuid' })
  declare keyId: string;

  @Column({ type: 'int' })
  declare userId: number;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user!: User;

  @Column({ type: 'varchar', length: 128 })
  declare keyHash: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  declare name?: string | null;

  @Column({ type: 'varchar', length: 8, nullable: true })
  declare lastFour?: string | null;

  @Column({ type: 'simple-array', nullable: true })
  declare allowedIps?: string[] | null;

  @Column({ type: 'timestamptz', nullable: true })
  declare expiresAt?: Date | null;

  @Column({ type: 'boolean', default: true })
  declare isActive: boolean;

  @Column({ type: 'timestamptz', nullable: true })
  declare revokedAt?: Date | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  declare revokeReason?: string | null;

  @Column({ type: 'boolean', default: false })
  declare createdByAdmin: boolean;

  @Column({ type: 'timestamptz', nullable: true })
  declare lastUsedAt?: Date | null;

  @Column({ type: 'varchar', length: 45, nullable: true })
  declare lastUsedIp?: string | null;

  @Column({ type: 'int', default: 0 })
  declare usageCount: number;

  @Column({ type: 'jsonb', nullable: true })
  declare metadata?: Record<string, unknown> | null;

  @CreateDateColumn({ type: 'timestamptz' })
  declare createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  declare updatedAt: Date;
}
