import type { Request, Response, NextFunction } from 'express';

const ROLE_HIERARCHY: Record<string, number> = {
  user: 0,
  operator: 1,
  admin: 2,
};

// Минимальная роль для доступа
export function requireRole(minRole: 'user' | 'operator' | 'admin') {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const userLevel = ROLE_HIERARCHY[req.user.role] ?? -1;
    const requiredLevel = ROLE_HIERARCHY[minRole];

    if (userLevel < requiredLevel) {
      res.status(403).json({ error: 'Insufficient permissions' });
      return;
    }

    next();
  };
}

// Только admin
export function requireAdmin() {
  return requireRole('admin');
}
