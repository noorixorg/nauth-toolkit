import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';
import { BaseStorageLock } from '@nauth-toolkit/core';

/**
 * TypeORM PostgreSQL Storage Lock Entity
 *
 * Extends BaseStorageLock from core and adds PostgreSQL-specific TypeORM decorators.
 * All field definitions and business logic are in the base class.
 */
@Entity('nauth_storage_locks')
@Index(['key'], { unique: true })
@Index(['expiresAt'])
export class StorageLock extends BaseStorageLock {
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
}
