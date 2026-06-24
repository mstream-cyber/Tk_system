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
