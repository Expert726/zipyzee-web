import { redirect } from 'next/navigation';

// AirShare is now ZeeShare: old links (and scanned QR codes) still land in the right place, code included.
export default async function AirShareMoved({ params, searchParams }: { params: Promise<{ lang: string }>; searchParams: Promise<{ join?: string }> }) {
  const { lang } = await params;
  const { join } = await searchParams;
  redirect(`/${lang}/zeeshare${join && /^\d{6}$/.test(join) ? `?join=${join}` : ''}`);
}
