/**
 * dbQuery is the most security-sensitive endpoint in the bridge. We allow
 * arbitrary SELECT statements (parameterized) but reject anything that
 * could mutate. We're not relying on SQLite permissions because the host
 * app's DB connection IS the privileged connection — the protection has to
 * happen at the bridge layer.
 *
 * Rules:
 *   - Single statement only (no semicolons except at end-of-string).
 *   - Statement must start with SELECT or WITH (after stripping leading
 *     comments / whitespace).
 *   - Reject any banned token at word boundaries (INSERT, UPDATE, DELETE,
 *     DROP, ALTER, ATTACH, REPLACE, PRAGMA, VACUUM).
 *
 * This is conservative on purpose. False negatives (rejecting a SELECT
 * that mentions "DELETE" inside a string literal) are acceptable; false
 * positives (allowing a write) are not.
 */
const BANNED_KEYWORDS = [
  'INSERT',
  'UPDATE',
  'DELETE',
  'DROP',
  'ALTER',
  'CREATE',
  'TRUNCATE',
  'ATTACH',
  'REPLACE',
  'PRAGMA',
  'VACUUM',
  'REINDEX',
];

const ALLOWED_LEADING = /^(SELECT|WITH)\b/i;

export interface ValidationResult {
  ok: boolean;
  reason?: string;
}

export function validateReadOnlySql(sql: string): ValidationResult {
  const cleaned = stripCommentsAndWhitespace(sql);
  if (!cleaned) {
    return { ok: false, reason: 'Empty SQL.' };
  }

  // Reject multi-statement (a ; that isn't the last char)
  const trimmed = cleaned.replace(/;\s*$/, '');
  if (trimmed.includes(';')) {
    return { ok: false, reason: 'Multi-statement SQL is not allowed.' };
  }

  if (!ALLOWED_LEADING.test(trimmed)) {
    return { ok: false, reason: 'Only SELECT or WITH statements are allowed.' };
  }

  for (const kw of BANNED_KEYWORDS) {
    const re = new RegExp(`\\b${kw}\\b`, 'i');
    if (re.test(trimmed)) {
      return { ok: false, reason: `Banned keyword in SQL: ${kw}.` };
    }
  }

  return { ok: true };
}

function stripCommentsAndWhitespace(sql: string): string {
  return sql
    .replace(/--[^\n]*\n?/g, ' ')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .trim();
}
