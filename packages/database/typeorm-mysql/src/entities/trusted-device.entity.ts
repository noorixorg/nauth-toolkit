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
import { BaseTrustedDevice } from '@nauth-toolkit/core';
import { User } from './user.entity';

/**
 * TypeORM MySQL Trusted Device Entity
 *
 * Extends BaseTrustedDevice from core and adds MySQL-specific TypeORM decorators.
 * All field definitions and business logic are in the base class.
 */
@Entity('nauth_trusted_devices')
@Index(['userId'])
@Index(['deviceTokenHash'])
@Index(['deviceId'])
@Index(['trustedUntil'])
@Index(['userId', 'deviceTokenHash'], { unique: true })
export class TrustedDevice extends BaseTrustedDevice {
  @PrimaryGeneratedColumn()
  declare id: number;

  @Column({ type: 'int' })
  declare userId: number;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user!: User;

  @Column({ type: 'varchar', length: 255 })
  declare deviceTokenHash: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  declare deviceId?: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  declare deviceName?: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  declare deviceType?: string | null;

  @Column({ type: 'varchar', length: 45, nullable: true })
  declare ipAddress?: string | null;

  @Column({ type: 'text', nullable: true })
  declare userAgent?: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  declare platform?: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  declare browser?: string | null;

  @Column({ type: 'timestamp', precision: 6 })
  declare trustedUntil: Date;

  @Column({ type: 'timestamp', precision: 6, nullable: true })
  declare lastUsedAt?: Date | null;

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
