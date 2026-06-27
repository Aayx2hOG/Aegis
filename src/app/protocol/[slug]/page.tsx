import { redirect } from 'next/navigation'

export default async function ProtocolPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  redirect(`/research?q=${encodeURIComponent(slug)}`)
}
