import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { error } from '../utils/response';

export interface AuthRequest extends Request {
  admin?: { role: string };
}

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET environment variable is not set');
  }
  return secret;
}

export function authMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  const token = req.cookies?.admin_token || req.cookies?.scanner_token || (() => {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) return null;
    return header.split(' ')[1];
  })();

  if (!token) {
    res.status(401).json(error('Missing or invalid token'));
    return;
  }

  try {
    const decoded = jwt.verify(token, getJwtSecret()) as { role: string };
    req.admin = decoded;
    next();
  } catch (err) {
    console.error('Token verification failed:', err);
    res.clearCookie('admin_token');
    res.status(401).json(error('Token expired or invalid'));
  }
}

export function requireRole(...roles: string[]) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    authMiddleware(req, res, () => {
      if (!req.admin || !roles.includes(req.admin.role)) {
        res.status(403).json(error('Insufficient permissions'));
        return;
      }
      next();
    });
  };
}

export function generateToken(role: string = 'admin'): string {
  const expiresIn = role === 'scanner' ? '15m' : '8h';
  return jwt.sign({ role }, getJwtSecret(), { expiresIn });
}
