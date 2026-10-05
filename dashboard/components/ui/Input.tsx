import React from 'react';
import { cn } from '@/lib/utils';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helper?: string;          // ← AJOUTÉ : texte d'aide / description
  icon?: React.ReactNode;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, helper, icon, className, ...props }, ref) => {
    return (
      <div className="w-full space-y-1">
        {/* Label */}
        {label && (
          <label className="block text-sm font-medium text-dark mb-2">
            {label}
          </label>
        )}

        {/* Input + icône */}
        <div className="relative">
          {icon && (
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
              {icon}
            </div>
          )}

          <input
            ref={ref}
            className={cn(
              'w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all duration-200',
              icon ? 'pl-10' : 'px-4',
              error ? 'border-red-500 focus:ring-red-500' : 'border-gray-300',
              className
            )}
            {...props}
          />
        </div>

        {/* Helper (affiché si pas d'erreur) */}
        {helper && !error && (
          <p className="mt-1.5 text-xs text-gray-500 leading-relaxed">
            {helper}
          </p>
        )}

        {/* Message d'erreur */}
        {error && (
          <p className="mt-1.5 text-sm text-red-600 font-medium">
            {error}
          </p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';

export default Input;





