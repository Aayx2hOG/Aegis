'use client'

import { Suspense } from 'react'
import Link from 'next/link'
import { ArrowLeft, Layers3, Loader2 } from 'lucide-react'
import { useWallet } from '@solana/wallet-adapter-react'
import { useSearchParams, useRouter } from 'next/navigation'
import { Tabs } from '@/components/ui/tabs'
import ChannelManager from '@/components/notifications/channel-manager'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { AlertSummaryDialog } from '@/components/alerts/alert-summary-dialog'
import { AlertRuleTestDialog } from '@/components/alerts/alert-rule-test-dialog'
import { AlertRuleForm } from '@/components/alerts/alert-rule-form'
import { AlertRulesList } from '@/components/alerts/alert-rules-list'
import { AlertEvaluationResults } from '@/components/alerts/alert-evaluation-results'
import { AlertRecentActivity } from '@/components/alerts/alert-recent-activity'
import { useAlertsState } from '@/components/alerts/use-alerts-state'

function AlertsContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const activeTab = searchParams.get('tab') === 'channels' ? 'channels' : 'signals'

  const handleTabChange = (value: string) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set('tab', value)
    router.replace(`/alerts?${params.toString()}`)
  }

  const wallet = useWallet()
  const {
    walletAddress,
    authenticateWalletAndReload,
    isAuthenticating,
    availableAlertProtocolSlugs,
    findMarketProtocol,
    priceBySlug,
    history,
    rules,
    events,
    setEvents,
    testResults,
    evaluationResults,
    dbStatus,
    historyLoading,
    alertsLoading,
    alertProtocolSlug,
    setAlertProtocolSlug,
    alertMetric,
    setAlertMetric,
    alertDirection,
    setAlertDirection,
    alertThreshold,
    setAlertThreshold,
    creatingAlert,
    evaluatingAlerts,
    updatingRuleId,
    deletingRuleId,
    regeneratingEventId,
    setRegeneratingEventId,
    pollingEventId,
    setPollingEventId,
    fullSummaryEventId,
    setFullSummaryEventId,
    fullSummaryOpen,
    setFullSummaryOpen,
    testRuleOpen,
    setTestRuleOpen,
    selectedTestRule,
    testRuleValue,
    setTestRuleValue,
    alertStorageMode,
    showAllAlertRules,
    setShowAllAlertRules,
    walletAuthRequired,
    selectedAlertCurrentValue,
    visibleAlertRules,
    alertWalletAddress,
    createAlertRule,
    openTestRuleDialog,
    createAndTestAlert,
    runSpecificAlertTest,
    runAlertEvaluation,
    toggleAlertRule,
    deleteAlertRule,
  } = useAlertsState(wallet)

  return (
    <>
      <div className="mx-auto max-w-6xl space-y-8 py-6 px-2 cyber-grid">
        <header className="space-y-4 text-left">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Link href="/watchlist">
                <span className="inline-flex items-center justify-center gap-1.5 font-orbitron font-bold border border-zinc-800 bg-zinc-950/40 hover:bg-zinc-900 text-zinc-300 rounded-xs text-xs px-3.5 py-2 cursor-pointer transition-all">
                  <ArrowLeft className="h-3.5 w-3.5 text-cyan-400" /> Back to Watchlist
                </span>
              </Link>
              <Badge
                variant="accent"
                className="px-2.5 py-1 text-[10px] uppercase tracking-[0.2em] font-orbitron font-bold shadow-[0_0_10px_rgba(6,182,212,0.15)] bg-cyan-950/20 text-cyan-400 border-cyan-500/20"
              >
                <Layers3 className="h-3.5 w-3.5 inline mr-1.5" /> Alerts System
              </Badge>
            </div>
          </div>
          <div className="space-y-2">
            <h1 className="text-4xl font-orbitron font-black tracking-wide text-white md:text-5xl drop-shadow-[0_0_15px_rgba(255,255,255,0.08)] uppercase">
              Alerts & Briefs
            </h1>
            <p className="max-w-3xl text-zinc-400 text-xs sm:text-sm leading-relaxed font-medium">
              Create and evaluate active alert rules, manually test parameters on watched protocols, and view your
              research brief timeline.
            </p>
          </div>
        </header>

        <Tabs
          activeTabValue={activeTab}
          onTabChange={handleTabChange}
          tabs={[
            {
              title: 'Alert Signals',
              value: 'signals',
              content: (
                <section className="grid gap-6 lg:grid-cols-2">
                  <div className="console-panel corner-decor border border-cyan-500/10 bg-zinc-950/40 p-5 rounded-xs space-y-6 shadow-2xl">
                    {walletAuthRequired && walletAddress && (
                      <div className="rounded-xs border border-amber-300/25 bg-amber-400/10 p-4 text-left">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                          <div>
                            <p className="text-xs font-orbitron font-bold uppercase tracking-wider text-amber-200">
                              Wallet signature required
                            </p>
                            <p className="mt-1 text-xs leading-relaxed text-amber-100/80">
                              Your wallet is connected, but database alerts require a signed ownership session before
                              saved rules and events can be loaded.
                            </p>
                          </div>
                          <Button
                            type="button"
                            onClick={() => void authenticateWalletAndReload()}
                            disabled={isAuthenticating}
                            className="bg-amber-300 text-zinc-950 hover:bg-amber-200 font-orbitron font-black uppercase tracking-wider rounded-xs text-xs"
                          >
                            {isAuthenticating ? 'Signing...' : 'Sign wallet'}
                          </Button>
                        </div>
                      </div>
                    )}

                    <AlertRuleForm
                      alertWalletAddress={alertWalletAddress}
                      availableProtocolSlugs={availableAlertProtocolSlugs}
                      creatingAlert={creatingAlert}
                      evaluatingAlerts={evaluatingAlerts}
                      protocolSlug={alertProtocolSlug}
                      metric={alertMetric}
                      direction={alertDirection}
                      threshold={alertThreshold}
                      selectedCurrentValue={selectedAlertCurrentValue}
                      onProtocolSlugChange={setAlertProtocolSlug}
                      onMetricChange={(nextMetric) => {
                        setAlertMetric(nextMetric)
                        if (nextMetric === 'TVL_USD') setAlertThreshold('10000000')
                        else if (nextMetric === 'PRICE_USD') setAlertThreshold('1.00')
                        else setAlertThreshold('10')
                      }}
                      onDirectionChange={setAlertDirection}
                      onThresholdChange={setAlertThreshold}
                      onCreateAlert={async () => {
                        await createAlertRule()
                      }}
                      onCreateAndTestAlert={createAndTestAlert}
                      onRunEvaluation={() => {
                        void runAlertEvaluation()
                      }}
                    />

                    <AlertRulesList
                      rules={rules}
                      visibleRules={visibleAlertRules}
                      loading={alertsLoading}
                      showAllRules={showAllAlertRules}
                      updatingRuleId={updatingRuleId}
                      deletingRuleId={deletingRuleId}
                      onShowAllRulesChange={setShowAllAlertRules}
                      onTestRule={openTestRuleDialog}
                      onToggleRule={toggleAlertRule}
                      onDeleteRule={deleteAlertRule}
                    />

                    <AlertEvaluationResults results={evaluationResults} />
                  </div>

                  <AlertRecentActivity
                    rules={rules}
                    events={events}
                    history={history}
                    storageMode={alertStorageMode}
                    loading={alertsLoading || historyLoading}
                    dbStatus={dbStatus}
                    historyLoading={historyLoading}
                    regeneratingEventId={regeneratingEventId}
                    pollingEventId={pollingEventId}
                    onRegeneratingEventIdChange={setRegeneratingEventId}
                    onPollingEventIdChange={setPollingEventId}
                    onEventsChange={(updater) => setEvents((current) => updater(current))}
                    onViewFullSummary={(eventId) => {
                      setFullSummaryEventId(eventId)
                      setFullSummaryOpen(true)
                    }}
                  />
                </section>
              ),
            },
            {
              title: 'Delivery Channels',
              value: 'channels',
              content: (
                <section className="console-panel corner-decor border border-cyan-500/10 bg-zinc-950/40 p-5 rounded-xs shadow-2xl md:p-6 text-left">
                  <ChannelManager />
                </section>
              ),
            },
          ]}
        />
      </div>

      <AlertSummaryDialog
        event={events.find((event) => event.id === fullSummaryEventId) ?? null}
        open={fullSummaryOpen}
        onOpenChange={setFullSummaryOpen}
      />

      <AlertRuleTestDialog
        open={testRuleOpen}
        onOpenChange={setTestRuleOpen}
        selectedRule={selectedTestRule}
        testRuleValue={testRuleValue}
        onTestRuleValueChange={setTestRuleValue}
        testResults={testResults}
        findMarketProtocol={findMarketProtocol}
        priceBySlug={priceBySlug}
        onEvaluate={runSpecificAlertTest}
      />
    </>
  )
}

export default function AlertsPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#070b13] flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-cyan-500" />
        </div>
      }
    >
      <AlertsContent />
    </Suspense>
  )
}
