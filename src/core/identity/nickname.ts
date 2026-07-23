const FORBIDDEN_PATTERNS = [
  /^admin$/i, /^administrator$/i, /^mod$/i, /^moderator$/i,
  /^root$/i, /^system$/i, /^support$/i, /^staff$/i, /^owner$/i,
  /^founder$/i, /^ceo$/i, /^bot$/i, /^server$/i, /^service$/i,
  /^help$/i, /^info$/i, /^official$/i, /^manager$/i,
  /^superuser$/i, /^supervisor$/i, /^host$/i, /^master$/i,
  /^operator$/i, /^security$/i, /^guard$/i,
  /.*(admin|moderator|superuser).*/i,
];

export function validateNickname(name: string): string | null {
  const trimmed = name.trim();

  if (trimmed.length < 2) { return 'Nickname must be at least 2 characters'; }
  if (trimmed.length > 24) { return 'Nickname must be at most 24 characters'; }
  if (!/^[\w\-_.]+$/.test(trimmed)) { return 'Only letters, numbers, -, _, . allowed'; }
  if (/^\d+$/.test(trimmed)) { return 'Nickname cannot be only numbers'; }

  for (const pattern of FORBIDDEN_PATTERNS) {
    if (pattern.test(trimmed)) {
      return 'This nickname is reserved';
    }
  }

  return null;
}

export function sanitizeNickname(name: string): string {
  return name.trim().replace(/\s+/g, '_').slice(0, 24);
}
