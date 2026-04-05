'use client';

import { useSearchParams } from 'next/navigation';
import { redirect } from 'next/navigation';
import { useEffect } from 'react';

export default function ProtocolPage({ params }: { params: { slug: string } }) {
  // Redirect to research page with the slug as query param for now
  useEffect(() => {
    redirect(`/research?q=${params.slug}`);
  }, [params.slug]);

  return (
    <div className="min-h-screen bg-[#0a0a0b] flex items-center justify-center">
      <span className="loading loading-spinner loading-lg text-primary" />
    </div>
  );
}
