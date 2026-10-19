import React from 'react';
import { cn } from '@/lib/utils';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  hover?: boolean;
}

const Card: React.FC<CardProps> = ({ 
  children, 
  className, 
  hover = false, 
  ...props 
}) => {
  return (
    <div
      className={cn(
        'bg-white rounded-lg shadow-custom p-6',
        hover && 'hover:shadow-custom-lg transition-shadow duration-200',
        className
      )}
      {...props}   // ← Ceci permet d'utiliser style, onClick, etc.
    >
      {children}
    </div>
  );
};

interface CardHeaderProps extends React.HTMLAttributes<HTMLDivElement> {}

export const CardHeader: React.FC<CardHeaderProps> = ({ 
  children, 
  className, 
  ...props 
}) => {
  return (
    <div className={cn('mb-4', className)} {...props}>
      {children}
    </div>
  );
};

interface CardTitleProps extends React.HTMLAttributes<HTMLHeadingElement> {}

export const CardTitle: React.FC<CardTitleProps> = ({ 
  children, 
  className, 
  ...props 
}) => {
  return (
    <h3 className={cn('text-xl font-bold text-dark', className)} {...props}>
      {children}
    </h3>
  );
};

interface CardContentProps extends React.HTMLAttributes<HTMLDivElement> {}

export const CardContent: React.FC<CardContentProps> = ({ 
  children, 
  className, 
  ...props 
}) => {
  return (
    <div className={cn(className)} {...props}>
      {children}
    </div>
  );
};

export default Card;
