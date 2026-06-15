import React from 'react'
import { cn } from '@/lib/utils'

export function BentoGrid({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div className={cn('grid grid-cols-1 gap-4 md:auto-rows-[18rem] md:grid-cols-3 lg:gap-5', className)}>
      {children}
    </div>
  )
}

export function BentoGridItem({
  className,
  title,
  description,
  header,
  icon,
  children,
}: {
  className?: string
  title?: string | React.ReactNode
  description?: string | React.ReactNode
  header?: React.ReactNode
  icon?: React.ReactNode
  children?: React.ReactNode
}) {
  return (
    <div
      className={cn(
        'group/bento relative row-span-1 flex flex-col justify-between overflow-hidden rounded-lg border border-white/10 bg-zinc-950/45 p-5 shadow-lg shadow-black/20 transition duration-300 hover:border-cyan-300/25 hover:bg-zinc-950/65',
        className,
      )}
    >
      {header && <div className="z-10">{header}</div>}
      <div className="flex flex-col gap-2 z-10">
        {icon && (
          <div className="w-fit rounded-md border border-white/10 bg-white/[0.04] p-2 text-zinc-300 transition-colors duration-300 group-hover/bento:border-cyan-300/25 group-hover/bento:text-cyan-200">
            {icon}
          </div>
        )}
        {title && (
          <div className="text-sm font-semibold text-white transition-colors duration-300 group-hover/bento:text-white">
            {title}
          </div>
        )}
        {description && <div className="text-xs leading-relaxed text-zinc-400">{description}</div>}
      </div>
      {children && <div className="z-10">{children}</div>}
    </div>
  )
}
