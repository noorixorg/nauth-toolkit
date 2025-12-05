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
import { BaseMFADevice, MFADeviceMethod } from '@nauth-toolkit/core';
import { User } from './user.entity';

/**
 * TypeORM MySQL MFA Device Entity
 *
 * Extends BaseMFADevice from core and adds MySQL-specific TypeORM decorators.
 * All field definitions and business logic are in the base class.
 */
@Entity('nauth_mfa_devices')
@Index(['userId'])
@Index(['type'])
@Index(['isActive'])
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

  @Column({ type: 'json', nullable: true })
  declare transports?: string[] | null;

  @Column({ type: 'tinyint', width: 1, default: 1 })
  declare isActive: boolean;

  @Column({ type: 'tinyint', width: 1, default: 0 })
  declare isPrimary: boolean;

  @Column({ type: 'timestamp', precision: 6, nullable: true })
  declare lastUsedAt?: Date | null;

  @Column({ type: 'int', default: 0 })
  declare usageCount: number;

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
}
