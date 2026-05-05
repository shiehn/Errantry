import { describe, expect, it } from 'vitest';
import { validateReadOnlySql } from './db-query.js';

describe('validateReadOnlySql', () => {
  it('accepts simple SELECT', () => {
    expect(validateReadOnlySql('SELECT * FROM tracks')).toEqual({ ok: true });
  });

  it('accepts WITH (CTE) statements', () => {
    expect(validateReadOnlySql('WITH x AS (SELECT 1) SELECT * FROM x')).toEqual({ ok: true });
  });

  it('strips trailing semicolon', () => {
    expect(validateReadOnlySql('SELECT 1;')).toEqual({ ok: true });
  });

  it('rejects empty input', () => {
    expect(validateReadOnlySql('   ')).toMatchObject({ ok: false });
  });

  it('rejects multi-statement', () => {
    expect(validateReadOnlySql('SELECT 1; SELECT 2;')).toMatchObject({ ok: false });
  });

  it('rejects DELETE', () => {
    expect(validateReadOnlySql('DELETE FROM tracks')).toMatchObject({ ok: false });
  });

  it('rejects UPDATE', () => {
    expect(validateReadOnlySql('UPDATE tracks SET name = ?')).toMatchObject({ ok: false });
  });

  it('rejects PRAGMA', () => {
    expect(validateReadOnlySql('PRAGMA foreign_keys')).toMatchObject({ ok: false });
  });

  it('rejects DROP even after a SELECT prefix', () => {
    expect(validateReadOnlySql('SELECT * FROM x; DROP TABLE y;')).toMatchObject({ ok: false });
  });

  it('rejects banned keyword embedded in compound query', () => {
    expect(validateReadOnlySql('SELECT * FROM x UNION SELECT 1; DELETE FROM y')).toMatchObject({
      ok: false,
    });
  });

  it('strips line comments before validating', () => {
    expect(validateReadOnlySql('-- danger\nSELECT 1')).toEqual({ ok: true });
  });
});
