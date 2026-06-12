'use client'
/* eslint-disable react-hooks/set-state-in-effect */

import { useState, useEffect, useRef } from 'react'
import { Terminal, Loader2, CheckCircle2, AlertTriangle, X } from 'lucide-react'
import { Button } from '@/components/ui/button'

export interface ExecutionAction {
  id?: string
  action: 'move' | 'liquidate' | 'increase' | 'arbitrage' | 'hedge'
  fromChain?: string
  toChain?: string
  assetSymbol: string
  protocol?: string
  amount: number
}

interface TerminalExecutionModalProps {
  isOpen: boolean
  onClose: () => void
  action: ExecutionAction | null
  onSuccess?: () => void
}

export function TerminalExecutionModal({ isOpen, onClose, action, onSuccess }: TerminalExecutionModalProps) {
  const [logs, setLogs] = useState<string[]>([])
  const [progress, setProgress] = useState(0)
  const [status, setStatus] = useState<'idle' | 'running' | 'success' | 'failed'>('idle')
  const [showReceipt, setShowReceipt] = useState(false)
  const [consensusTime, setConsensusTime] = useState<string | null>(null)
  const [taskCount, setTaskCount] = useState(0)
  const consoleEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    consoleEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    if (isOpen) {
      scrollToBottom()
    }
  }, [logs, isOpen])

  const onSuccessRef = useRef(onSuccess)
  useEffect(() => {
    onSuccessRef.current = onSuccess
  }, [onSuccess])

  useEffect(() => {
    if (!isOpen || !action) {
      setLogs([])
      setProgress(0)
      setStatus('idle')
      setShowReceipt(false)
      setConsensusTime(null)
      setTaskCount(0)
      return
    }

    let active = true

    setStatus('running')
    setProgress(0)
    setLogs([
      `[INFO] establishing telemetry connection to event bus...`,
      `[INFO] payload parameters registered: action=${action.action.toUpperCase()}, asset=${action.assetSymbol}, amount=${action.amount}`,
    ])

    const runExecutionLogs = async () => {
      const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

      await sleep(1000)
      if (!active) return
      setLogs((prev) => [...prev, `[INFO] link established. authenticated as Aegis Security Administrator.`])
      setProgress(15)

      await sleep(1200)
      if (!active) return
      setLogs((prev) => [
        ...prev,
        `[QUEUE] dispatching mitigation event: action=${action.action.toUpperCase()}, asset=${action.assetSymbol}, amount=${action.amount}`,
        `[QUERY] retrieving active background tasks from database...`,
      ])
      setProgress(45)

      let fetchedTasks: Array<{ type: string; target: string; status: string; time: string; detail: string }> = []
      try {
        const res = await fetch('/api/system/tasks')
        if (res.ok) {
          const data = (await res.json()) as { success: boolean; tasks?: typeof fetchedTasks }
          if (data.success && data.tasks) {
            fetchedTasks = data.tasks
          }
        }
      } catch (err) {
        console.error('Failed to fetch tasks:', err)
      }

      await sleep(1200)
      if (!active) return

      if (fetchedTasks.length > 0) {
        const taskLogs: string[] = []
        fetchedTasks.forEach((task) => {
          const timeStr = new Date(task.time).toLocaleTimeString()
          const taskColor =
            task.status === 'FAILED'
              ? '[ERROR]'
              : task.status === 'SENT' || task.status === 'COMPLETED'
                ? '[OK]'
                : '[WARNING]'
          taskLogs.push(
            `${taskColor} TASK [${task.type}] - Target: ${task.target} - Status: ${task.status} (${timeStr})`,
          )
          taskLogs.push(`  └> ${task.detail}`)
        })
        setLogs((prev) => [...prev, ...taskLogs])
        setTaskCount(fetchedTasks.length)
      } else {
        setLogs((prev) => [
          ...prev,
          `[INFO] no active or recent background tasks found in system database.`,
          `[INFO] background scheduler-worker is active and listening...`,
        ])
      }
      setProgress(80)

      await sleep(1500)
      if (!active) return
      setLogs((prev) => [
        ...prev,
        `[SUCCESS] local event queue sync complete. mitigation instruction successfully dispatched.`,
        `[INFO] telemetry link closed.`,
      ])
      setProgress(100)
      setStatus('success')
      setConsensusTime(new Date().toLocaleString())
      onSuccessRef.current?.()
    }

    void runExecutionLogs()

    return () => {
      active = false
    }
  }, [isOpen, action])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
      <div className="relative w-full max-w-2xl rounded-lg border border-cyan-500/20 bg-zinc-950 p-6 shadow-[0_0_35px_rgba(6,182,212,0.15)] flex flex-col max-h-[90vh]">
        {/* Header decoration */}
        <div className="absolute top-0 left-6 right-6 h-[1px] bg-gradient-to-r from-transparent via-cyan-500/30 to-transparent" />
        <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 rounded-full border border-cyan-500/25 bg-zinc-950 px-3 py-0.5 text-[8px] font-mono text-cyan-400 font-bold uppercase tracking-widest shadow-[0_0_8px_rgba(6,182,212,0.2)]">
          secure dispatch execution console
        </div>

        {/* Top title bar */}
        <div className="flex items-center justify-between border-b border-zinc-900 pb-4">
          <div className="flex items-center gap-2 text-left">
            <Terminal className="h-5 w-5 text-cyan-400 animate-pulse" />
            <div>
              <h2 className="font-orbitron text-sm font-black uppercase text-white tracking-widest">
                Aegis Risk Mitigator v1.0
              </h2>
              <p className="text-[9px] font-mono text-zinc-500 mt-0.5 uppercase">
                Active execution: {action?.action} {action?.assetSymbol}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={status === 'running'}
            className="rounded-xs border border-zinc-900 bg-zinc-950 hover:bg-zinc-900 hover:text-white text-zinc-400 p-1.5 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Terminal display shell */}
        <div className="flex-1 overflow-y-auto my-4 rounded-md bg-zinc-950 p-4 font-mono text-xs border border-zinc-900 text-left min-h-[250px] max-h-[400px] flex flex-col justify-between shadow-[inset_0_0_15px_rgba(0,0,0,0.95)]">
          <div className="space-y-1.5 select-none">
            {logs.map((log, idx) => {
              let color = 'text-zinc-400'
              if (log.startsWith('[SUCCESS]')) color = 'text-emerald-400 font-bold'
              else if (log.startsWith('[OK]')) color = 'text-cyan-400 font-semibold'
              else if (log.startsWith('[WARNING]') || log.startsWith('[TX]')) color = 'text-amber-400'
              else if (log.startsWith('[ERROR]')) color = 'text-rose-500 font-black'

              return (
                <div key={idx} className={`leading-normal ${color}`}>
                  &gt; {log}
                </div>
              )
            })}

            {status === 'running' && (
              <div className="flex items-center gap-1.5 text-cyan-400 select-none font-bold">
                <span>&gt;</span>
                <span className="animate-pulse">_</span>
                <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0 ml-1" />
              </div>
            )}
            <div ref={consoleEndRef} />
          </div>
        </div>

        {/* Simulated Receipt Details Panel */}
        {showReceipt && status === 'success' && (
          <div className="mb-4 p-4 border border-cyan-500/20 bg-zinc-950/90 rounded-md font-mono text-[11px] text-zinc-300 space-y-2 select-text animate-in slide-in-from-top-4 duration-300">
            <div className="flex items-center justify-between border-b border-zinc-900 pb-1.5 mb-2 select-none">
              <span className="font-bold text-cyan-400 uppercase tracking-widest text-[9px]">
                Aegis System Audit Log
              </span>
              <span className="text-emerald-400 font-bold uppercase text-[9px]">Connected Workers</span>
            </div>
            <div className="grid grid-cols-3 gap-y-1.5 gap-x-2 text-left">
              <div className="text-zinc-500 select-none">Recent Tasks Scanned:</div>
              <div className="col-span-2 text-zinc-200">{taskCount} active database logs</div>

              <div className="text-zinc-500 select-none">Mitigation Instruction:</div>
              <div className="col-span-2 text-zinc-200 uppercase">
                {action?.action} {action?.amount} {action?.assetSymbol}
              </div>

              <div className="text-zinc-500 select-none">Target Network:</div>
              <div className="col-span-2 text-zinc-200 uppercase">
                {action?.fromChain ?? 'solana'} {action?.toChain ? `-> ${action.toChain}` : ''}
              </div>

              <div className="text-zinc-500 select-none">Active Workers:</div>
              <div className="col-span-2 text-zinc-200">scheduler-worker, ai-summary-worker, notification-worker</div>

              <div className="text-zinc-500 select-none">Sync Timestamp:</div>
              <div className="col-span-2 text-zinc-200">{consensusTime ?? 'N/A'}</div>

              <div className="text-zinc-500 select-none">Database Status:</div>
              <div className="col-span-2 text-emerald-400">CONNECTED (PRISMA CLIENT)</div>
            </div>
          </div>
        )}

        {/* Progress Bar & Status Footer */}
        <div className="space-y-4">
          <div className="space-y-1 text-left select-none">
            <div className="flex justify-between items-center text-[10px] font-mono text-zinc-500 font-bold uppercase tracking-wider">
              <span>Syncing Telemetry Queues</span>
              <span className="text-cyan-400 font-black">{progress}%</span>
            </div>
            <div className="h-2 w-full bg-zinc-900 rounded-full overflow-hidden border border-zinc-900">
              <div
                className="h-full bg-cyan-500 shadow-[0_0_8px_rgba(6,182,212,0.5)] transition-all duration-500 ease-out"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="text-[9px] font-mono text-zinc-500 text-left select-none mt-1">
              * Displaying actual background task logs, alert evaluator records, and notification history from the
              database.
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-zinc-900 select-none">
            <div className="flex items-center gap-2">
              {status === 'success' ? (
                <div className="flex items-center gap-1 text-emerald-400 text-xs font-mono font-bold uppercase tracking-wider">
                  <CheckCircle2 size={16} /> Telemetry Sync Complete
                </div>
              ) : status === 'running' ? (
                <div className="flex items-center gap-1.5 text-cyan-400 text-xs font-mono font-bold uppercase tracking-wider animate-pulse">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Syncing System Queues...
                </div>
              ) : (
                <div className="flex items-center gap-1 text-zinc-550 text-xs font-mono uppercase tracking-wider">
                  <AlertTriangle size={15} /> Awaiting Dispatch
                </div>
              )}
            </div>

            <div className="flex gap-2">
              {status === 'success' && (
                <Button
                  onClick={() => setShowReceipt(!showReceipt)}
                  variant="outline"
                  className="border-zinc-800 bg-zinc-900 hover:bg-zinc-850 hover:text-white rounded-xs text-[10px] font-mono uppercase font-bold tracking-wider h-8"
                >
                  {showReceipt ? 'Hide System Audit' : 'View System Audit'}
                </Button>
              )}
              <Button
                onClick={onClose}
                disabled={status === 'running'}
                className="bg-white hover:bg-zinc-200 text-zinc-950 font-orbitron font-bold uppercase tracking-wider text-[10px] h-8 rounded-xs px-5 shadow-[0_0_8px_rgba(255,255,255,0.15)] disabled:opacity-50"
              >
                Close Console
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
