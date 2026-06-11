/**
 * Database Columns Unit Tests
 *
 * Tests database column decorator functions.
 */

import {
  UuidColumn,
  JsonColumn,
  ArrayColumn,
  TimestampColumn,
  BooleanColumn,
  IntegerColumn,
  VarcharColumn,
  TextColumn,
} from './database-columns';

describe('Database Column Decorators', () => {
  describe('UuidColumn', () => {
    it('should return a decorator function', () => {
      const decorator = UuidColumn();
      expect(typeof decorator).toBe('function');
    });

    it('should accept column options', () => {
      const decorator = UuidColumn({ primary: true });
      expect(typeof decorator).toBe('function');
    });
  });

  describe('JsonColumn', () => {
    it('should return a decorator function', () => {
      const decorator = JsonColumn();
      expect(typeof decorator).toBe('function');
    });

    it('should accept column options', () => {
      const decorator = JsonColumn({ nullable: true });
      expect(typeof decorator).toBe('function');
    });
  });

  describe('ArrayColumn', () => {
    it('should return a decorator function', () => {
      const decorator = ArrayColumn();
      expect(typeof decorator).toBe('function');
    });

    it('should accept column options', () => {
      const decorator = ArrayColumn({ nullable: true });
      expect(typeof decorator).toBe('function');
    });
  });

  describe('TimestampColumn', () => {
    it('should return a decorator function', () => {
      const decorator = TimestampColumn();
      expect(typeof decorator).toBe('function');
    });

    it('should accept column options', () => {
      const decorator = TimestampColumn({ default: () => 'CURRENT_TIMESTAMP' });
      expect(typeof decorator).toBe('function');
    });
  });

  describe('BooleanColumn', () => {
    it('should return a decorator function', () => {
      const decorator = BooleanColumn();
      expect(typeof decorator).toBe('function');
    });

    it('should accept column options', () => {
      const decorator = BooleanColumn({ default: true });
      expect(typeof decorator).toBe('function');
    });
  });

  describe('IntegerColumn', () => {
    it('should return a decorator function', () => {
      const decorator = IntegerColumn();
      expect(typeof decorator).toBe('function');
    });

    it('should accept column options', () => {
      const decorator = IntegerColumn({ default: 0 });
      expect(typeof decorator).toBe('function');
    });
  });

  describe('VarcharColumn', () => {
    it('should return a decorator function with length', () => {
      const decorator = VarcharColumn(255);
      expect(typeof decorator).toBe('function');
    });

    it('should accept column options', () => {
      const decorator = VarcharColumn(100, { nullable: false });
      expect(typeof decorator).toBe('function');
    });
  });

  describe('TextColumn', () => {
    it('should return a decorator function', () => {
      const decorator = TextColumn();
      expect(typeof decorator).toBe('function');
    });

    it('should accept column options', () => {
      const decorator = TextColumn({ nullable: true });
      expect(typeof decorator).toBe('function');
    });
  });
});
