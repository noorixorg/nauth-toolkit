import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';
import { BaseRateLimit } from '@nauth-toolkit/core';

/**
 * TypeORM MySQL Rate Limit Entity
 *
 * Extends BaseRateLimit from core and adds MySQL-specific TypeORM decorators.
 * All field definitions and business logic are in the base class.
 */
@Entity('nauth_rate_limits')
@Index(['key'], { unique: true })
@Index(['expiresAt'])
export class RateLimit extends BaseRateLimit {
  @PrimaryGeneratedColumn()
  declare id: number;

  @Column({ type: 'varchar', length: 255 })
  declare key: string;

  @Column({ type: 'text' })
  declare value: string;

  @Column({ type: 'timestamp', precision: 6, name: 'expiresAt', nullable: true })
  declare expiresAt: Date | null;

  @CreateDateColumn({ type: 'timestamp', precision: 6, name: 'createdAt', default: () => 'CURRENT_TIMESTAMP(6)' })
  declare createdAt: Date;

  @UpdateDateColumn({
    type: 'timestamp',
    precision: 6,
    name: 'updatedAt',
    default: () => 'CURRENT_TIMESTAMP(6)',
    onUpdate: 'CURRENT_TIMESTAMP(6)',
  })
  declare updatedAt: Date;
}
