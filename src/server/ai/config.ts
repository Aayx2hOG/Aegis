function isEnabled(value: string | undefined, defaultValue = false): boolean {
  if (value == null) return defaultValue
  return ['1', 'true', 'yes', 'on'].includes(value.trim().toLowerCase())
}

export function isResearchAiEnabled(): boolean {
  return isEnabled(process.env.AEGIS_RESEARCH_AI_ENABLED)
}

export function areAlertAiSummariesEnabled(): boolean {
  return isEnabled(process.env.AEGIS_ALERT_AI_SUMMARIES_ENABLED)
}
