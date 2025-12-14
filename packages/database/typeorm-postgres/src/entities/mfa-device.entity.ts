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
import { BaseMFADevice, MFADeviceMethod } from '@nauth-toolkit/core';
import { User } from './user.entity';

/**
 * TypeORM PostgreSQL MFA Device Entity
 *
 * Extends BaseMFADevice from core and adds PostgreSQL-specific TypeORM decorators.
 * All field definitions and business logic are in the base class.
 *
 * **Database Integrity:**
 * - Unique constraint on (userId, type) prevents duplicate MFA devices per method
 * - This prevents race conditions where multiple devices of same type could be created
 */
@Entity('nauth_mfa_devices')
@Index(['userId'])
@Index(['type'])
@Index(['isActive'])
@Unique('uq_mfa_device_user_type', ['userId', 'type'])
export class MFADevice extends BaseMFADevice {
  @PrimaryGeneratedColumn()
  declare id: number;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user!: User;

  @Column({ type: 'int' })
  declare userId: number;

  @Column({ type: 'varchar', length: 20 })
  declare type: MFADeviceMethod;

  @Column({ type: 'varchar', length: 255 })
  declare name: string;

  @Column({ type: 'text', nullable: true })
  declare secret?: string | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  declare phoneNumber?: string | null;

  @Column({ type: 'text', nullable: true })
  declare credentialId?: string | null;

  @Column({ type: 'text', nullable: true })
  declare publicKey?: string | null;

  @Column({ type: 'int', nullable: true })
  declare counter?: number | null;

  @Column({ type: 'simple-array', nullable: true })
  declare transports?: string[] | null;

  @Column({ type: 'boolean', default: true })
  declare isActive: boolean;

  @Column({ type: 'boolean', default: false })
  declare isPrimary: boolean;

  @Column({ type: 'timestamptz', nullable: true })
  declare lastUsedAt?: Date | null;

  @Column({ type: 'int', default: 0 })
  declare usageCount: number;

  @Column({ type: 'jsonb', nullable: true })
  declare metadata?: Record<string, unknown> | null;

  @CreateDateColumn({ type: 'timestamptz' })
  declare createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  declare updatedAt: Date;
}
