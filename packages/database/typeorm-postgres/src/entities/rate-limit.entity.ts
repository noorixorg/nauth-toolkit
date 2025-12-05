import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';
import { BaseRateLimit } from '@nauth-toolkit/core';

/**
 * TypeORM PostgreSQL Rate Limit Entity
 *
 * Extends BaseRateLimit from core and adds PostgreSQL-specific TypeORM decorators.
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

  @Column({ type: 'timestamptz', name: 'expiresAt', nullable: true })
  declare expiresAt: Date | null;

  @CreateDateColumn({ type: 'timestamptz', name: 'createdAt' })
  declare createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updatedAt' })
  declare updatedAt: Date;
}
