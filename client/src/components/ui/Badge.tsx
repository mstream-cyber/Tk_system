import type { ReactNode } from 'react';

type BadgeVariant = 'default' | 'success' | 'danger' | 'warning' | 'info' | 'accent';

interface BadgeProps {
  children: ReactNode;
  variant?: BadgeVariant;
  size?: 'sm' | 'md';
  className?: string;
}

const variantMap: Record<BadgeVariant, string> = {
  default: 'bg-card-hover text-content-secondary',
  success: 'bg-success-subtle text-success-light',
  danger: 'bg-danger-subtle text-danger-light',
  warning: 'bg-warning-subtle text-warning-light',
  info: 'bg-info-subtle text-info-light',
  accent: 'bg-accent-subtle text-accent-light',
};

const sizeMap = {
  sm: 'px-1.5 py-0.5 text-[10px]',
  md: 'px-2 py-0.5 text-xs',
};

export function Badge({ children, variant = 'default', size = 'md', className = '' }: BadgeProps) {
  return (
    <span className={`inline-block rounded font-medium ${variantMap[variant]} ${sizeMap[size]} ${className}`}>
      {children}
    </span>
  );
}
