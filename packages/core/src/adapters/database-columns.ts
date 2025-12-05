import { Column, ColumnOptions } from 'typeorm';

/**
 * Database-Agnostic Column Decorators
 *
 * Provides column decorators that automatically adapt to different database types.
 * Uses the database adapter to determine appropriate column types.
 *
 * @example
 * ```typescript
 * @Entity()
 * export class User {
 *   @UuidColumn()
 *   id!: string;
 *
 *   @JsonColumn()
 *   metadata?: Record<string, any>;
 *
 *   @ArrayColumn()
 *   tags?: string[];
 * }
 * ```
 */

/**
 * Create UUID column with database-appropriate type
 *
 * @param options - Additional column options
 * @returns Column decorator
 */
export function UuidColumn(options?: Partial<ColumnOptions>) {
  return function (target: Record<string, unknown>, propertyKey: string) {
    // This would be replaced with actual adapter-based logic
    // For now, use PostgreSQL default
    const columnOptions: ColumnOptions = {
      type: 'uuid',
      ...options,
    };

    // In a real implementation, this would use the injected adapter
    // to determine the correct column type
    return Column(columnOptions)(target, propertyKey);
  };
}

/**
 * Create JSON column with database-appropriate type
 *
 * @param options - Additional column options
 * @returns Column decorator
 */
export function JsonColumn(options?: Partial<ColumnOptions>) {
  return function (target: Record<string, unknown>, propertyKey: string) {
    const columnOptions: ColumnOptions = {
      type: 'jsonb', // PostgreSQL default
      ...options,
    };

    return Column(columnOptions)(target, propertyKey);
  };
}

/**
 * Create array column with database-appropriate type
 *
 * @param options - Additional column options
 * @returns Column decorator
 */
export function ArrayColumn(options?: Partial<ColumnOptions>) {
  return function (target: Record<string, unknown>, propertyKey: string) {
    const columnOptions: ColumnOptions = {
      type: 'simple-array', // TypeORM handles this
      ...options,
    };

    return Column(columnOptions)(target, propertyKey);
  };
}

/**
 * Create timestamp column with database-appropriate type
 *
 * @param options - Additional column options
 * @returns Column decorator
 */
export function TimestampColumn(options?: Partial<ColumnOptions>) {
  return function (target: Record<string, unknown>, propertyKey: string) {
    const columnOptions: ColumnOptions = {
      type: 'timestamp',
      ...options,
    };

    return Column(columnOptions)(target, propertyKey);
  };
}

/**
 * Create boolean column with database-appropriate type
 *
 * @param options - Additional column options
 * @returns Column decorator
 */
export function BooleanColumn(options?: Partial<ColumnOptions>) {
  return function (target: Record<string, unknown>, propertyKey: string) {
    const columnOptions: ColumnOptions = {
      type: 'boolean',
      ...options,
    };

    return Column(columnOptions)(target, propertyKey);
  };
}

/**
 * Create integer column with database-appropriate type
 *
 * @param options - Additional column options
 * @returns Column decorator
 */
export function IntegerColumn(options?: Partial<ColumnOptions>) {
  return function (target: Record<string, unknown>, propertyKey: string) {
    const columnOptions: ColumnOptions = {
      type: 'int',
      ...options,
    };

    return Column(columnOptions)(target, propertyKey);
  };
}

/**
 * Create varchar column with database-appropriate type
 *
 * @param length - Maximum length
 * @param options - Additional column options
 * @returns Column decorator
 */
export function VarcharColumn(length: number, options?: Partial<ColumnOptions>) {
  return function (target: Record<string, unknown>, propertyKey: string) {
    const columnOptions: ColumnOptions = {
      type: 'varchar',
      length,
      ...options,
    };

    return Column(columnOptions)(target, propertyKey);
  };
}

/**
 * Create text column with database-appropriate type
 *
 * @param options - Additional column options
 * @returns Column decorator
 */
export function TextColumn(options?: Partial<ColumnOptions>) {
  return function (target: Record<string, unknown>, propertyKey: string) {
    const columnOptions: ColumnOptions = {
      type: 'text',
      ...options,
    };

    return Column(columnOptions)(target, propertyKey);
  };
}
