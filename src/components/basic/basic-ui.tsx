'use client'

import { useBasicProgram } from './basic-data-access'
import { Button } from '@/components/ui/button'

export function BasicCreate() {
  const { initialize } = useBasicProgram()

  return (
    <Button onClick={() => initialize.mutateAsync()} disabled={initialize.isPending}>
      Initialize program{initialize.isPending && '...'}
    </Button>
  )
}

export function BasicProgram() {
  const { getProgramAccount } = useBasicProgram()

  if (getProgramAccount.isLoading) {
    return <span className="loading loading-spinner loading-lg"></span>
  }
  if (!getProgramAccount.data?.value) {
    return (
      <div className="alert alert-info flex justify-center">
        <span>Program account not found. Make sure you have deployed the program and are on the correct cluster.</span>
      </div>
    )
  }
  return (
    <div className={'space-y-6'}>
      <pre>{JSON.stringify(getProgramAccount.data.value, null, 2)}</pre>
    </div>
  )
}
