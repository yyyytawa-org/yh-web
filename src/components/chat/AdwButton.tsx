import React from 'react';

interface AdwButtonProps {
  children?: React.ReactNode;
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  ghost?: boolean;
  iconOnly?: boolean;
  className?: string;
  active?: boolean;
  roundedFull?: boolean;
  disabled?: boolean;
  type?: 'button' | 'submit' | 'reset';
  title?: string;
}

const AdwButton: React.FC<AdwButtonProps> = ({
  children,
  onClick,
  ghost = false,
  iconOnly = false,
  className = '',
  active = false,
  roundedFull = false,
  disabled = false,
  type = 'button',
  title
}) => {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`
        flex items-center justify-center transition-all duration-150
        ${iconOnly ? 'p-2' : 'px-3 py-1.5 text-sm font-medium'}
        ${roundedFull ? 'rounded-full' : 'rounded-lg'}
        ${active
          ? 'bg-[var(--adw-selected)]'
          : ghost
            ? 'hover:bg-[var(--adw-hover)]'
            : 'bg-[var(--adw-view)] hover:bg-[var(--adw-hover)] shadow-xs border border-[var(--adw-border)]/[0.2]'
        }
        ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
        ${className}
        text-[var(--adw-fg)]
      `}
    >
      {children}
    </button>
  );
};

export default AdwButton;
