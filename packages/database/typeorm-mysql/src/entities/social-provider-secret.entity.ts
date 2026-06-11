import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Unique } from 'typeorm';
import { BaseSocialProviderSecret } from '@nauth-toolkit/core';

/**
 * TypeORM MySQL Social Provider Secret Entity
 *
 * Extends BaseSocialProviderSecret from core and adds MySQL-specific TypeORM decorators.
 * Stores generated OAuth client secrets (JWTs) for social providers that require dynamic secret generation.
 */
@Entity('nauth_social_provider_secrets')
@Unique(['provider']) // One record per provider
export class SocialProviderSecret extends BaseSocialProviderSecret {
  @PrimaryGeneratedColumn()
  declare id: number;

  @Column({ type: 'varchar', length: 50 })
  declare provider: string;

  @Column({ type: 'text' })
  declare clientSecretJwt: string;

  @Column({ type: 'timestamp', precision: 6 })
  declare expiresAt: Date;

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
