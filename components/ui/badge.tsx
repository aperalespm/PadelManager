import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center justify-center rounded-full border px-2.5 py-0.5 text-xs font-semibold w-fit whitespace-nowrap shrink-0 [&>svg]:size-3 gap-1 [&>svg]:pointer-events-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive transition-[color,box-shadow] overflow-hidden',
  {
    variants: {
      variant: {
        // ── Neutros ──
        default:
          'border-transparent bg-secondary text-secondary-foreground [a&]:hover:bg-secondary/80',
        outline:
          'text-foreground border-border [a&]:hover:bg-muted',
        // ── Semánticos sólidos (como se ven en el DS) ──
        accent:
          'border-transparent bg-accent text-accent-foreground [a&]:hover:bg-[var(--accent-hover)]',
        success:
          'border-transparent bg-success text-success-foreground [a&]:hover:bg-[var(--success-hover)]',
        warning:
          'border-transparent bg-warning text-warning-foreground [a&]:hover:opacity-90',
        error:
          'border-transparent bg-error text-error-foreground [a&]:hover:opacity-90',
        info:
          'border-transparent bg-info text-info-foreground [a&]:hover:opacity-90',
        destructive:
          'border-transparent bg-destructive text-white [a&]:hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
)

function Badge({
  className,
  variant,
  asChild = false,
  ...props
}: React.ComponentProps<'span'> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : 'span'

  return (
    <Comp
      data-slot="badge"
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  )
}

export { Badge, badgeVariants }
