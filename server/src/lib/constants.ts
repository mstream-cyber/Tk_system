export const MS = {
  FIFTEEN_MINUTES: 15 * 60 * 1000,
  ONE_HOUR: 60 * 60 * 1000,
  EIGHT_HOURS: 8 * 60 * 60 * 1000,
} as const;

export const FILE = {
  MAX_UPLOAD_SIZE: 5 * 1024 * 1024,
  ALLOWED_RECEIPT_TYPES: ['image/jpeg', 'image/png', 'application/pdf'] as readonly string[],
  ALLOWED_BANNER_TYPES: ['image/jpeg', 'image/png'] as readonly string[],
} as const;

export const TICKET_COLORS = [
  '#6366f1',
  '#f59e0b',
  '#10b981',
  '#ef4444',
  '#8b5cf6',
  '#ec4899',
  '#14b8a6',
  '#f97316',
] as const;
