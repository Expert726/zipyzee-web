import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="py-24 text-center flex flex-col items-center gap-4">
      <h1 className="text-[28px] font-semibold">404</h1>
      <Link href="/" className="text-primary font-medium hover:underline">ZipyZee</Link>
    </div>
  );
}
