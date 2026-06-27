import { Suspense } from 'react'
import { Loader2 } from 'lucide-react'
import { OpportunityFinder } from '@/components/opportunities/opportunity-finder'

export default function OpportunityFinderPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[#070b13]">
          <Loader2 className="h-8 w-8 animate-spin text-cyan-500" />
        </div>
      }
    >
      <OpportunityFinder />
    </Suspense>
  )
}
