import crypto from 'crypto';

export function generateScanToken(): string {
  return 'gt_' + crypto.randomBytes(32).toString('hex');
}
