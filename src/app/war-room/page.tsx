import { redirect } from 'next/navigation'

export default async function LegacyWarRoomPage({
  searchParams,
}: {
  searchParams: Promise<{ protocol?: string | string[] }>
}) {
  const protocolParam = (await searchParams).protocol
  const protocol = Array.isArray(protocolParam) ? protocolParam[0] : protocolParam
  const destination = protocol ? `/research/compare?protocols=${encodeURIComponent(protocol)}` : '/research/compare'

  redirect(destination)
}
