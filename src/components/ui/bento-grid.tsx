import React from 'react'
import { cn } from '@/lib/utils'

export function BentoGrid({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div className={cn('grid md:auto-rows-[20rem] grid-cols-1 md:grid-cols-3 gap-6 max-w-7xl mx-auto', className)}>
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
        'row-span-1 rounded-3xl border border-white/5 bg-zinc-950/40 p-6 flex flex-col justify-between space-y-4 shadow-xl hover:shadow-2xl transition duration-300 group/bento hover:border-white/15 hover:bg-zinc-950/60 relative overflow-hidden',
        className,
      )}
    >
      {header && <div className="z-10">{header}</div>}
      <div className="flex flex-col gap-2 z-10">
        {icon && (
          <div className="text-zinc-400 transition-transform group-hover/bento:scale-110 duration-300 w-fit">
            {icon}
          </div>
        )}
        {title && (
          <div className="font-bold text-white group-hover/bento:text-white transition-colors duration-300">
            {title}
          </div>
        )}
        {description && <div className="text-zinc-400 text-xs leading-relaxed font-normal">{description}</div>}
      </div>
      {children && <div className="z-10">{children}</div>}
    </div>
  )
}
