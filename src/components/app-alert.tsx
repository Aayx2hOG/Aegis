import { AlertCircle } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { ReactNode } from 'react'

export function AppAlert({ action, children }: { action: ReactNode; children: ReactNode }) {
  return (
    <Alert variant="warning" className="mb-4 bg-yellow-500/10 text-yellow-200/90 shadow-[0_10px_30px_rgba(0,0,0,0.25)]">
      <AlertCircle className="h-4 w-4" />
      <AlertTitle className="text-yellow-200">{children}</AlertTitle>
      <AlertDescription className="flex justify-start pt-2 sm:justify-end">{action}</AlertDescription>
    </Alert>
  )
}
