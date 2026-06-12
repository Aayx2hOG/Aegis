// Shared configuration and tunable constants for War Room heuristics
export const POSITION_SCALE = [0.018, 0.012, 0.008]
export const POSITION_MIN_USD = 25_000
export const POSITION_MAX_USD = 220_000

export const VOL_BASE = 22
export const VOL_INDEX_MULT = 5
export const VOL_MIN = 6
export const VOL_MAX = 94

export const LIQUIDITY_BASE = 38
export const LIQUIDITY_LOG_MULT = 7
export const LIQUIDITY_INDEX_PENALTY = 3
export const LIQUIDITY_MIN = 18
export const LIQUIDITY_MAX = 98

export const COLLATERAL_BASE = 0.28
export const COLLATERAL_TVL_CAP = 500_000_000
export const COLLATERAL_TVL_MAX_ADJUST = 0.25
export const COLLATERAL_INDEX_PENALTY = 0.03
export const COLLATERAL_MIN = 0.12
export const COLLATERAL_MAX = 0.82

// Risk engine multipliers
export const MARKET_SHOCK_MULT = 0.6
export const LIQUIDITY_DIVISOR = 1.4
export const LIQUIDITY_SCENARIO_MULT = 0.5
export const CONCENTRATION_SCENARIO_MULT = 0.5
export const LIQUIDATION_MARKET_MULT = 1.1
export const ORACLE_DELAY_MIN_MULT = 0.25
export const SMART_CONTRACT_BASE_MULT = 0.5

export const AGG_WEIGHTS = {
  market: 0.28,
  liquidity: 0.2,
  concentration: 0.17,
  liquidation: 0.2,
  smart: 0.15,
}

export const EXPLOIT_LOSS_FACTOR = 0.08
export const LIQUIDATION_PROB_MULT = 0.75

// Simulation slippage / liquidity multiplier
export const LIQUIDITY_SLIPPAGE_MULT = 0.35

// Action impact multipliers and cost estimates
export const ACTIONS = {
  hedgeRiskReduction: 0.25,
  hedgeCostMultiplier: 0.004,
  rebalanceRiskReduction: 0.3,
  rebalanceCostMultiplier: 0.0025,
  raiseCollateralRiskReduction: 0.35,
  raiseCollateralCostMultiplier: 0.0018,
  emergencyRiskReduction: 0.15,
}

export const DEFAULT_CONFIDENCES = {
  hedge: 0.83,
  rebalance: 0.79,
  collateral: 0.87,
  emergency: 0.74,
}

export const UI_DISCLAIMER = `War Room outputs are illustrative heuristics — not financial advice. Results are based on simple, tunable formulas and should be validated against your own analysis.`

const warRoomConfig = {
  POSITION_SCALE,
  POSITION_MIN_USD,
  POSITION_MAX_USD,
}

export default warRoomConfig

