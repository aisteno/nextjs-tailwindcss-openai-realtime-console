import React from 'react';
import { type Icon } from 'react-feather';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  label?: string;
  icon?: Icon;
  iconPosition?: 'start' | 'end';
  iconColor?: 'red' | 'green' | 'grey';
  iconFill?: boolean;
  buttonStyle?: 'regular' | 'action' | 'alert' | 'flush';
}

export function Button({
  label = 'Okay',
  icon = void 0,
  iconPosition = 'start',
  iconColor = void 0,
  iconFill = false,
  buttonStyle = 'regular',
  className = '',
  ...rest
}: ButtonProps) {
  const StartIcon = iconPosition === 'start' ? icon : null;
  const EndIcon = iconPosition === 'end' ? icon : null;

  const baseClasses = 'flex items-center gap-2 font-mono text-xs rounded-full px-6 py-2 min-h-[42px] outline-none transition-all duration-100 ease-in-out disabled:text-neutral-500 disabled:cursor-not-allowed enabled:cursor-pointer enabled:active:translate-y-[1px]';

  const styleClasses = {
    regular: 'bg-[#ececf1] text-[#101010] enabled:hover:bg-[#d8d8d8]',
    action: 'bg-[#101010] text-[#ececf1] enabled:hover:bg-[#404040]',
    alert: 'bg-red-600 text-[#ececf1] enabled:hover:bg-red-600',
    flush: 'bg-transparent'
  }[buttonStyle];

  const iconColorClasses = iconColor && {
    red: 'text-[#cc0000]',
    green: 'text-[#009900]',
    grey: 'text-[#909090]'
  }[iconColor];

  return (
    <button
      data-component="Button"
      className={`${baseClasses} ${styleClasses} ${className}`}
      {...rest}
    >
      {StartIcon && (
        <span className={`flex -ml-2 ${iconColorClasses} ${iconFill ? 'fill-current' : ''}`}>
          <StartIcon className="w-4 h-4" />
        </span>
      )}
      <span>{label}</span>
      {EndIcon && (
        <span className={`flex -mr-2 ${iconColorClasses} ${iconFill ? 'fill-current' : ''}`}>
          <EndIcon className="w-4 h-4" />
        </span>
      )}
    </button>
  );
}
