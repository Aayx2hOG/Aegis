'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'

type Tab = {
  title: string
  value: string
  content?: React.ReactNode
}

export function Tabs({
  tabs: propTabs,
  containerClassName,
  activeTabClassName,
  tabClassName,
  contentClassName,
}: {
  tabs: Tab[]
  containerClassName?: string
  activeTabClassName?: string
  tabClassName?: string
  contentClassName?: string
}) {
  const [active, setActive] = useState<Tab>(propTabs[0])
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null)

  const handlePress = (tab: Tab) => {
    setActive(tab)
  }

  return (
    <div className="flex flex-col gap-6 w-full">
      <div
        className={cn(
          'flex flex-wrap items-center justify-start [perspective:1000px] relative overflow-auto sm:overflow-visible no-scrollbar p-1.5 rounded-2xl bg-zinc-900/60 border border-white/5 backdrop-blur-xl w-fit max-w-full',
          containerClassName
        )}
      >
        {propTabs.map((tab, idx) => {
          const isActive = tab.value === active.value
          return (
            <button
              key={tab.value}
              onMouseEnter={() => setHoveredIdx(idx)}
              onMouseLeave={() => setHoveredIdx(null)}
              onClick={() => handlePress(tab)}
              className={cn(
                'relative px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-widest transition-colors duration-200 cursor-pointer',
                isActive ? 'text-zinc-950' : 'text-zinc-400 hover:text-zinc-100',
                tabClassName
              )}
              style={{
                transformStyle: 'preserve-3d',
              }}
            >
              {isActive && (
                <motion.div
                  layoutId="clickedbutton"
                  transition={{ type: 'spring', bounce: 0.25, duration: 0.4 }}
                  className={cn(
                    'absolute inset-0 bg-white rounded-xl',
                    activeTabClassName
                  )}
                />
              )}
              <span className="relative z-10 block">{tab.title}</span>
            </button>
          )
        })}
      </div>
      <div className={cn('w-full', contentClassName)}>{active.content}</div>
    </div>
  )
}
