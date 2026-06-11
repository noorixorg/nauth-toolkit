import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';
import { BaseStorageLock } from '@nauth-toolkit/core';

/**
 * TypeORM MySQL Storage Lock Entity
 *
 * Extends BaseStorageLock from core and adds MySQL-specific TypeORM decorators.
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

  @Column({ type: 'timestamp', precision: 6, name: 'expiresAt', nullable: true })
  declare expiresAt: Date | null;

  @CreateDateColumn({ type: 'timestamp', precision: 6, name: 'createdAt', default: () => 'CURRENT_TIMESTAMP(6)' })
  declare createdAt: Date;
}
