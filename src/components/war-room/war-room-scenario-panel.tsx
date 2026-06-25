'use client'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { DeFiTooltip } from '@/components/ui/defi-helper'
import { BridgeThreatSimulator } from '@/components/war-room/war-room-visuals'
import { ALL_CHAIN_TYPES, MULTICHAIN_SCENARIO_INFO, MULTICHAIN_SCENARIOS } from '@/lib/config/war-room-multichain'
import type { ChainPortfolioPosition, ChainScenarioConfig } from '@/lib/types'

type WarRoomScenarioPanelProps = {
  simpleMode: boolean
  onSimpleModeChange: (value: boolean) => void
  useCustomScenario: boolean
  onUseCustomScenarioChange: (value: boolean) => void
  selectedScenarioIndex: number
  onSelectedScenarioIndexChange: (index: number) => void
  customScenario: ChainScenarioConfig
  selectedCustomSeverity: 'Mild' | 'Moderate' | 'Severe' | null
  onSelectedCustomSeverityChange: (value: 'Mild' | 'Moderate' | 'Severe' | null) => void
  onCustomScenarioChange: (values: Partial<ChainScenarioConfig>, source?: 'preset' | 'manual') => void
  loading: boolean
  positions: ChainPortfolioPosition[]
  error: string | null
  onRunSimulation: () => Promise<void>
}

export function WarRoomScenarioPanel({
  simpleMode,
  onSimpleModeChange,
  useCustomScenario,
  onUseCustomScenarioChange,
  selectedScenarioIndex,
  onSelectedScenarioIndexChange,
  customScenario,
  selectedCustomSeverity,
  onSelectedCustomSeverityChange,
  onCustomScenarioChange,
  loading,
  positions,
  error,
  onRunSimulation,
}: WarRoomScenarioPanelProps) {
  const activeScenario = useCustomScenario ? customScenario : MULTICHAIN_SCENARIOS[selectedScenarioIndex]

  return (
    <div className="lg:col-span-2 rounded-xl bg-zinc-950/50 border border-cyan-500/10 p-5 backdrop-blur-md space-y-5 corner-decor shadow-2xl">
      <div className="flex justify-between items-center border-b border-cyan-500/10 pb-3 gap-3">
        <h2 className="font-orbitron font-black text-sm uppercase tracking-wider text-white">Stress scenario</h2>
        <button
          type="button"
          onClick={() => onSimpleModeChange(!simpleMode)}
          className={`rounded-xs px-3 py-1 text-[8px] font-mono font-bold uppercase tracking-wider border transition-all duration-200 ${
            simpleMode
              ? 'bg-cyan-500/10 border-cyan-500/40 text-cyan-400 shadow-[0_0_10px_rgba(6,182,212,0.15)]'
              : 'bg-zinc-950 border-zinc-850 text-zinc-500 hover:text-zinc-350'
          }`}
        >
          {simpleMode ? 'Beginner Help On' : 'Beginner Help Off'}
        </button>
      </div>

      <div className="flex border-b border-cyan-500/10 pb-1.5 gap-2">
        <button
          type="button"
          onClick={() => onUseCustomScenarioChange(false)}
          className={`flex-1 text-center py-1.5 text-[10px] font-orbitron font-bold uppercase tracking-wider border transition-all ${
            !useCustomScenario
              ? 'bg-cyan-950/20 border-cyan-500/30 text-cyan-400 font-black'
              : 'bg-zinc-950/30 border-transparent text-zinc-500 hover:text-zinc-350'
          }`}
        >
          Presets
        </button>
        <button
          type="button"
          onClick={() => onUseCustomScenarioChange(true)}
          className={`flex-1 text-center py-1.5 text-[10px] font-orbitron font-bold uppercase tracking-wider border transition-all ${
            useCustomScenario
              ? 'bg-cyan-950/20 border-cyan-500/30 text-cyan-400 font-black'
              : 'bg-zinc-950/30 border-transparent text-zinc-500 hover:text-zinc-350'
          }`}
        >
          Custom Scenario
        </button>
      </div>

      {!useCustomScenario ? (
        <div className="space-y-2">
          {MULTICHAIN_SCENARIOS.map((scenario, index) => {
            const info = MULTICHAIN_SCENARIO_INFO[index]
            return (
              <button
                key={info.title}
                type="button"
                onClick={() => onSelectedScenarioIndexChange(index)}
                className={`w-full rounded-xs px-3.5 py-3 text-left transition border ${
                  index === selectedScenarioIndex
                    ? 'bg-cyan-950/15 border-cyan-500/35 text-white shadow-[0_0_12px_rgba(6,182,212,0.06)]'
                    : 'bg-zinc-950/40 border-zinc-900 text-zinc-450 hover:bg-zinc-950 hover:text-zinc-200'
                }`}
              >
                <p className="text-xs font-orbitron font-bold tracking-wider uppercase">
                  {simpleMode ? info.beginnerLabel : info.title}
                </p>
                <p className="text-[10px] text-zinc-400 mt-1 leading-normal">
                  {simpleMode ? info.beginnerSummary : info.description}
                </p>
                {!simpleMode && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    <span className="rounded-xs bg-zinc-950/80 px-1.5 py-0.5 text-[8px] text-cyan-500 border border-zinc-900 font-mono font-semibold">
                      Shock: -{scenario.marketShockPct}%
                    </span>
                    <span className="rounded-xs bg-zinc-950/80 px-1.5 py-0.5 text-[8px] text-cyan-500 border border-zinc-900 font-mono font-semibold">
                      Liquidity: -{scenario.liquidityDropPct}%
                    </span>
                    {scenario.bridgeOutageDurationMinutes && scenario.bridgeOutageDurationMinutes > 0 ? (
                      <span className="rounded-xs bg-rose-500/10 text-rose-300 border border-rose-500/15 px-1.5 py-0.5 text-[8px] font-mono font-bold">
                        Bridge Outage: {scenario.bridgeOutageDurationMinutes}m
                      </span>
                    ) : null}
                  </div>
                )}
              </button>
            )
          })}
        </div>
      ) : (
        <div className="space-y-4 rounded-xs border border-cyan-500/10 bg-zinc-950/45 p-4 text-xs font-mono text-left">
          <div className="rounded-md border border-cyan-500/10 bg-cyan-950/5 p-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">Quick severity</p>
            <p className="mt-1 text-[10px] leading-relaxed text-zinc-500">
              Start with a realistic level, then fine-tune any slider below.
            </p>
            <div className="mt-3 grid grid-cols-3 gap-2">
              {[
                {
                  label: 'Mild',
                  config: {
                    marketShockPct: 10,
                    liquidityDropPct: 15,
                    protocolExploitSeverity: 5,
                    oracleDelayMinutes: 2,
                    bridgeOutageDurationMinutes: 0,
                  },
                },
                {
                  label: 'Moderate',
                  config: {
                    marketShockPct: 25,
                    liquidityDropPct: 35,
                    protocolExploitSeverity: 20,
                    oracleDelayMinutes: 10,
                    bridgeOutageDurationMinutes: 30,
                  },
                },
                {
                  label: 'Severe',
                  config: {
                    marketShockPct: 45,
                    liquidityDropPct: 60,
                    protocolExploitSeverity: 45,
                    oracleDelayMinutes: 25,
                    bridgeOutageDurationMinutes: 120,
                  },
                },
              ].map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => {
                    onSelectedCustomSeverityChange(preset.label as 'Mild' | 'Moderate' | 'Severe')
                    onCustomScenarioChange(preset.config, 'preset')
                  }}
                  aria-pressed={selectedCustomSeverity === preset.label}
                  className={`rounded-xs border px-2 py-1.5 text-[10px] font-bold uppercase tracking-wider transition ${
                    selectedCustomSeverity === preset.label
                      ? 'border-cyan-500/50 bg-cyan-500/15 text-cyan-200 shadow-[0_0_10px_rgba(6,182,212,0.12)]'
                      : 'border-zinc-850 bg-zinc-950 text-zinc-400 hover:border-cyan-500/30 hover:text-cyan-300'
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          <ScenarioSlider
            label={simpleMode ? <DeFiTooltip term="Market Shock">MARKET SHOCK</DeFiTooltip> : 'MARKET SHOCK'}
            value={customScenario.marketShockPct}
            suffix="%"
            displayValue={`-${customScenario.marketShockPct}%`}
            max={100}
            onChange={(value) => onCustomScenarioChange({ marketShockPct: value })}
            help="How much broad market prices fall."
          />
          <ScenarioSlider
            label={simpleMode ? <DeFiTooltip term="Liquidity Score">LIQUIDITY DROP</DeFiTooltip> : 'LIQUIDITY DROP'}
            value={customScenario.liquidityDropPct}
            suffix="%"
            displayValue={`-${customScenario.liquidityDropPct}%`}
            max={100}
            onChange={(value) => onCustomScenarioChange({ liquidityDropPct: value })}
            help="How much harder it becomes to exit positions without slippage."
          />
          <ScenarioSlider
            label="PROTOCOL EXPLOIT SEVERITY"
            value={customScenario.protocolExploitSeverity}
            suffix="% Risk"
            max={100}
            onChange={(value) => onCustomScenarioChange({ protocolExploitSeverity: value })}
            help="Extra protocol/smart-contract stress applied to DeFi positions."
          />
          <ScenarioSlider
            label={simpleMode ? <DeFiTooltip term="Oracle Delay">ORACLE DELAY</DeFiTooltip> : 'ORACLE DELAY'}
            value={customScenario.oracleDelayMinutes}
            suffix=" mins"
            max={120}
            onChange={(value) => onCustomScenarioChange({ oracleDelayMinutes: value })}
            help="How stale price feeds become during the stress event."
          />

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3 text-[10px] font-bold">
              <span className="text-zinc-400">
                {simpleMode ? (
                  <DeFiTooltip term="Bridge Outage">BRIDGE OUTAGE DURATION</DeFiTooltip>
                ) : (
                  'BRIDGE OUTAGE DURATION'
                )}
              </span>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={0}
                  max={1440}
                  step={5}
                  value={customScenario.bridgeOutageDurationMinutes}
                  onChange={(event) =>
                    onCustomScenarioChange({
                      bridgeOutageDurationMinutes: Math.min(1440, Math.max(0, Number(event.target.value))),
                    })
                  }
                  className="h-7 w-20 border-zinc-850 bg-zinc-950 px-2 text-right text-[10px] text-cyan-300"
                />
                <span className="text-cyan-400">mins</span>
              </div>
            </div>
            <input
              type="range"
              min={0}
              max={1440}
              step={5}
              value={customScenario.bridgeOutageDurationMinutes}
              onChange={(event) => onCustomScenarioChange({ bridgeOutageDurationMinutes: Number(event.target.value) })}
              className="w-full h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-cyan-500"
            />
            <div className="flex flex-wrap gap-2">
              {[0, 5, 15, 30, 60, 180].map((minutes) => (
                <button
                  key={minutes}
                  type="button"
                  onClick={() => onCustomScenarioChange({ bridgeOutageDurationMinutes: minutes })}
                  className={`rounded-xs border px-2 py-1 text-[9px] font-semibold transition ${
                    customScenario.bridgeOutageDurationMinutes === minutes
                      ? 'border-cyan-500/40 bg-cyan-500/10 text-cyan-300'
                      : 'border-zinc-850 bg-zinc-950 text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  {minutes === 0 ? 'None' : `${minutes}m`}
                </button>
              ))}
            </div>
            <p className="text-[10px] leading-relaxed text-zinc-500">
              How long cross-chain exits are blocked. Small values like 5 or 15 minutes are now supported.
            </p>
          </div>

          <div className="space-y-2 border-t border-zinc-900 pt-3">
            <div className="mb-1 flex items-center justify-between gap-3">
              <span className="block text-[9px] font-bold uppercase tracking-wider text-zinc-550">Chains Affected</span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => onCustomScenarioChange({ chainsAffected: ALL_CHAIN_TYPES })}
                  className="text-[9px] font-semibold uppercase tracking-wider text-cyan-400 hover:text-cyan-300"
                >
                  All
                </button>
                <button
                  type="button"
                  onClick={() => onCustomScenarioChange({ chainsAffected: [] })}
                  className="text-[9px] font-semibold uppercase tracking-wider text-zinc-500 hover:text-zinc-300"
                >
                  None
                </button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 text-[10px]">
              {ALL_CHAIN_TYPES.map((chain) => {
                const isChecked = customScenario.chainsAffected?.includes(chain) ?? false
                return (
                  <label
                    key={chain}
                    className="flex items-center gap-2 cursor-pointer text-zinc-350 hover:text-white transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => {
                        const currentChains = customScenario.chainsAffected ?? []
                        const nextChains = currentChains.includes(chain)
                          ? currentChains.filter((item) => item !== chain)
                          : [...currentChains, chain]
                        onCustomScenarioChange({ chainsAffected: nextChains })
                      }}
                      className="rounded-xs border-zinc-850 bg-zinc-950 text-cyan-500 focus:ring-0 cursor-pointer h-3.5 w-3.5 animate-none"
                    />
                    <span className="uppercase">{chain}</span>
                  </label>
                )
              })}
            </div>
          </div>

          <div className="border-t border-zinc-900 pt-3 flex justify-end">
            <Button
              type="button"
              onClick={() => {
                onSelectedCustomSeverityChange(null)
                onCustomScenarioChange(
                  {
                    marketShockPct: 0,
                    liquidityDropPct: 0,
                    protocolExploitSeverity: 0,
                    oracleDelayMinutes: 0,
                    bridgeOutageDurationMinutes: 0,
                    chainsAffected: [...ALL_CHAIN_TYPES],
                  },
                  'preset',
                )
              }}
              className="border border-cyan-500/20 bg-cyan-500/5 hover:bg-cyan-500/15 text-cyan-400 text-[9px] uppercase tracking-wider font-orbitron font-bold h-7 rounded-xs px-3"
            >
              Reset to Stable
            </Button>
          </div>
        </div>
      )}

      <BridgeThreatSimulator scenario={activeScenario} />

      <Button
        onClick={onRunSimulation}
        disabled={loading || positions.length === 0}
        className="w-full h-11 bg-cyan-500 hover:bg-cyan-400 text-zinc-950 font-orbitron font-black uppercase tracking-widest text-xs shadow-[0_0_12px_rgba(6,182,212,0.25)] transition-all cursor-pointer rounded-xs"
      >
        {loading ? 'Running simulation...' : 'Run Simulation'}
      </Button>
      {error && <p className="text-rose-400 text-xs font-mono">&gt; Simulation error: {error}</p>}
    </div>
  )
}

function ScenarioSlider({
  label,
  value,
  suffix,
  displayValue,
  max,
  onChange,
  help,
}: {
  label: React.ReactNode
  value: number
  suffix: string
  displayValue?: string
  max: number
  onChange: (value: number) => void
  help: string
}) {
  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center text-[10px] font-bold">
        <span className="text-zinc-400">{label}</span>
        <span className="text-cyan-400">{displayValue ?? `${value}${suffix}`}</span>
      </div>
      <input
        type="range"
        min={0}
        max={max}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="w-full h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-cyan-500"
      />
      <p className="text-[10px] leading-relaxed text-zinc-500">{help}</p>
    </div>
  )
}
