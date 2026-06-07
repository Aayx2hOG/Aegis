import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/lib/utils'

const badgeVariants = cva(
    'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
    {
        variants: {
            variant: {
                default: 'border-transparent bg-primary text-primary-foreground shadow-xs',
                secondary: 'border-transparent bg-secondary text-secondary-foreground',
                outline: 'border-border bg-transparent text-foreground',
                accent: 'border-zinc-700 bg-zinc-800/40 text-zinc-200',
            },
        },
        defaultVariants: {
            variant: 'default',
        },
    },
)

function Badge({ className, variant, ...props }: React.ComponentProps<'div'> & VariantProps<typeof badgeVariants>) {
    return <div data-slot="badge" className={cn(badgeVariants({ variant }), className)} {...props} />
}

export { Badge, badgeVariants }