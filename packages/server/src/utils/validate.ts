// Unified input validation helpers — shared by HTTP routes and WS gateway

export function assertStr(val: unknown, name: string, maxLen = 2000): string {
  if (typeof val !== 'string' || val.length === 0) throw new Error(`${name} 不能为空`);
  if (val.length > maxLen) throw new Error(`${name} 超过最大长度 ${maxLen}`);
  return val;
}

export function assertOptStr(val: unknown, name: string, maxLen = 2000): string | undefined {
  if (val === undefined || val === null || val === '') return undefined;
  if (typeof val !== 'string') throw new Error(`${name} 必须是字符串`);
  if (val.length > maxLen) throw new Error(`${name} 超过最大长度 ${maxLen}`);
  return val;
}

export function assertNum(val: unknown, name: string, min = 0, max = 1_000_000): number {
  const n = typeof val === 'number' ? val : Number(val);
  if (isNaN(n)) throw new Error(`${name} 必须是数字`);
  if (n < min || n > max) throw new Error(`${name} 必须在 ${min}-${max} 之间`);
  return n;
}

export function assertOptNum(val: unknown, name: string, min = 0, max = 10000): number | undefined {
  if (val === undefined || val === null) return undefined;
  return assertNum(val, name, min, max);
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function assertEmail(val: unknown): string {
  const s = assertStr(val, '邮箱', 254);
  if (!EMAIL_RE.test(s)) throw new Error('邮箱格式不正确');
  return s;
}

export function assertPassword(val: unknown): string {
  const s = assertStr(val, '密码', 128);
  if (s.length < 8) throw new Error('密码长度不能少于 8 个字符');
  if (!/[a-zA-Z]/.test(s)) throw new Error('密码必须包含至少一个字母');
  if (!/\d/.test(s)) throw new Error('密码必须包含至少一个数字');
  return s;
}

/** Clamp offset to safe range */
export function safeOffset(val: unknown): number {
  const n = parseInt(String(val ?? '0')) || 0;
  return Math.max(0, Math.min(n, 100000));
}

/** Escape LIKE wildcards in search strings */
export function escapeLike(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
}
