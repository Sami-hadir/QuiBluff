import React from 'react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'accent' | 'danger' | 'outline';
  size?: 'sm' | 'md' | 'lg' | 'xl';
  fullWidth?: boolean;
}

export const Button: React.FC<ButtonProps> = ({ 
  children, 
  className, 
  variant = 'primary', 
  size = 'md', 
  fullWidth = false,
  ...props 
}) => {
  const baseStyles = "font-bold rounded-xl border-4 border-black transition-all active:translate-y-1 active:shadow-none relative overflow-hidden flex items-center justify-center gap-2";
  
  const variants = {
    primary: "bg-qb-blue text-white shadow-neo hover:bg-blue-400",
    secondary: "bg-qb-purple text-white shadow-neo hover:bg-purple-400",
    accent: "bg-qb-yellow text-black shadow-neo hover:bg-yellow-300",
    danger: "bg-red-500 text-white shadow-neo hover:bg-red-400",
    outline: "bg-transparent text-white border-white shadow-none hover:bg-white/10",
  };

  const sizes = {
    sm: "px-4 py-2 text-sm shadow-neo-sm border-2",
    md: "px-6 py-3 text-base shadow-neo",
    lg: "px-8 py-4 text-lg shadow-neo",
    xl: "px-10 py-5 text-xl md:text-2xl shadow-neo-lg",
  };

  return (
    <button 
      className={cn(baseStyles, variants[variant], sizes[size], fullWidth && "w-full", className)} 
      {...props}
    >
      {children}
    </button>
  );
};

interface CardProps {
  children: React.ReactNode;
  className?: string;
  title?: string;
}

export const Card: React.FC<CardProps> = ({ children, className, title }) => {
  return (
    <div className={cn("bg-slate-800 border-4 border-black rounded-2xl shadow-neo p-6 relative", className)}>
      {title && (
        <div className="absolute -top-5 left-1/2 -translate-x-1/2 bg-qb-yellow border-4 border-black px-4 py-1 rounded-full shadow-neo-sm z-10">
          <h3 className="font-black text-black uppercase tracking-wider text-sm md:text-base whitespace-nowrap">{title}</h3>
        </div>
      )}
      {children}
    </div>
  );
};

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
}

export const Input: React.FC<InputProps> = ({ label, className, ...props }) => {
  return (
    <div className="w-full">
      {label && <label className="block text-sm font-bold mb-2 ms-1 text-gray-300">{label}</label>}
      <input 
        className={cn(
          "w-full bg-slate-700 border-4 border-black rounded-xl px-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:border-qb-yellow focus:ring-4 focus:ring-qb-yellow/20 transition-all font-medium",
          className
        )}
        {...props}
      />
    </div>
  );
};

export const Logo: React.FC<{ className?: string }> = ({ className }) => (
  <div className={cn("relative inline-block", className)}>
    <h1 className="text-5xl md:text-7xl font-black text-white italic tracking-tighter" style={{ textShadow: '4px 4px 0px #000' }}>
      Qui<span className="text-qb-blue">Bluff</span>
    </h1>
    <div className="absolute -top-2 -left-6 -rotate-12 bg-qb-purple text-xs font-bold px-2 py-1 rounded border-2 border-black shadow-neo-sm transform">
      בטא
    </div>
  </div>
);