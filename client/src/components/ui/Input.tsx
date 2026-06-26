import { type InputHTMLAttributes, forwardRef } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  touched?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, touched, className = '', id, ...props }, ref) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, '-');
    const showError = touched && error;
    const borderColor = showError
      ? 'border-danger focus:border-danger'
      : 'border-border focus:border-accent';

    return (
      <div className="w-full">
        {label && (
          <label htmlFor={inputId} className="block text-sm font-semibold text-content-secondary mb-1">
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          className={`w-full px-3 py-2.5 rounded-lg border bg-input text-content placeholder-content-placeholder outline-none text-sm transition-colors ${borderColor} ${className}`}
          {...props}
        />
        {showError && (
          <p className="text-danger text-xs mt-1">{error}</p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';
