import { redirect } from 'next/navigation';

export default function ProtocolPage({ params }: { params: { slug: string } }) {
  redirect(`/research?q=${params.slug}`)
}
