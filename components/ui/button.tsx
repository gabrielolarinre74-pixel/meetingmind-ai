import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 rounded-xl text-sm font-semibold transition-all focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-500/25 disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98]',
  {
    variants: {
      variant: {
        default: 'bg-brand-500 text-white shadow-[0_8px_24px_-8px_rgba(124,77,255,.8)] hover:bg-brand-600',
        dark: 'bg-ink-900 text-white hover:bg-ink-800',
        outline: 'border border-ink-300/60 bg-white text-ink-900 hover:border-brand-400 hover:text-brand-700',
        ghost: 'text-ink-500 hover:bg-brand-50 hover:text-brand-700',
        danger: 'text-rose-600 hover:bg-rose-50',
      },
      size: { default: 'h-10 px-4', sm: 'h-8 rounded-lg px-3 text-xs', lg: 'h-12 px-6 text-base', icon: 'h-9 w-9' },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  },
);

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(({ className, variant, size, asChild = false, ...props }, ref) => {
  const Comp = asChild ? Slot : 'button';
  return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
});
Button.displayName = 'Button';

export { Button, buttonVariants };
