'use client';

import React, { useState, useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import { FiChevronDown, FiCheck } from 'react-icons/fi';

interface SelectOption {
  value: string; // CHANGER: uniquement string
  label: string;
  disabled?: boolean;
}

interface SelectProps {
  options: SelectOption[];
  value?: string; // CHANGER: uniquement string
  onChange?: (value: string) => void; // CHANGER: uniquement string
  placeholder?: string;
  className?: string;
  icon?: React.ReactNode;
  disabled?: boolean;
  error?: string;
  label?: string;
}

const Select: React.FC<SelectProps> = ({
  options,
  value,
  onChange,
  placeholder = 'Sélectionner...',
  className,
  icon,
  disabled = false,
  error,
  label
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedLabel, setSelectedLabel] = useState<string>('');
  const selectRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (value !== undefined) {
      const selectedOption = options.find(opt => opt.value === value);
      setSelectedLabel(selectedOption?.label || '');
    } else {
      setSelectedLabel('');
    }
  }, [value, options]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (selectRef.current && !selectRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleSelect = (optionValue: string) => { // CHANGER: uniquement string
    if (onChange) {
      onChange(optionValue);
    }
    setIsOpen(false);
  };

  const selectedOption = options.find(opt => opt.value === value);

  return (
    <div className="w-full">
      {label && (
        <label className="block text-sm font-medium text-dark mb-2">
          {label}
        </label>
      )}
      <div className="relative" ref={selectRef}>
        <button
          type="button"
          className={cn(
            'w-full px-4 py-2.5 border rounded-lg text-left flex items-center justify-between transition-all',
            'focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent',
            disabled
              ? 'bg-gray-100 text-gray-400 cursor-not-allowed border-gray-200'
              : 'bg-white text-dark border-gray-300 hover:border-primary cursor-pointer',
            error ? 'border-error focus:ring-error' : '',
            className
          )}
          onClick={() => !disabled && setIsOpen(!isOpen)}
          disabled={disabled}
        >
          <span className={cn(
            'truncate',
            !selectedLabel && 'text-gray-400'
          )}>
            {selectedLabel || placeholder}
          </span>
          <FiChevronDown className={cn(
            "text-gray-400 transition-transform duration-200",
            isOpen && "rotate-180"
          )} />
        </button>

        {isOpen && !disabled && (
          <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
            <div className="py-1">
              {options.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={cn(
                    'w-full px-4 py-2.5 text-left flex items-center justify-between hover:bg-gray-50',
                    'transition-colors duration-150',
                    option.disabled
                      ? 'text-gray-400 cursor-not-allowed'
                      : 'text-dark cursor-pointer',
                    option.value === value && 'bg-primary/10 text-primary'
                  )}
                  onClick={() => !option.disabled && handleSelect(option.value)}
                  disabled={option.disabled}
                >
                  <span>{option.label}</span>
                  {option.value === value && (
                    <FiCheck className="text-primary" />
                  )}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
      {error && (
        <p className="mt-1 text-sm text-error">{error}</p>
      )}
    </div>
  );
};

export default Select;
