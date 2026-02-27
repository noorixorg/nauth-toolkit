import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Unique } from 'typeorm';
import { BaseSocialProviderSecret } from '@nauth-toolkit/core';

/**
 * TypeORM PostgreSQL Social Provider Secret Entity
 *
 * Extends BaseSocialProviderSecret from core and adds PostgreSQL-specific TypeORM decorators.
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

  @Column({ type: 'timestamptz' })
  declare expiresAt: Date;

  @CreateDateColumn({ type: 'timestamptz' })
  declare createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  declare updatedAt: Date;
}
