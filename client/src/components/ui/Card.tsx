import type { ReactNode, HTMLAttributes } from 'react';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  variant?: 'default' | 'interactive';
  padding?: 'sm' | 'md' | 'lg' | 'none';
}

const paddingMap = {
  sm: 'p-4',
  md: 'p-5',
  lg: 'p-6',
  none: '',
};

export function Card({
  children,
  variant = 'default',
  padding = 'md',
  className = '',
  ...props
}: CardProps) {
  const interactive = variant === 'interactive'
    ? 'hover:border-accent hover:shadow-lg transition-all cursor-pointer'
    : '';

  return (
    <div
      className={`bg-card rounded-2xl border border-border ${paddingMap[padding]} ${interactive} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}
