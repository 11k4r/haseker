import { Suspense } from 'react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { LoginForm } from './login-form';

export default async function LoginPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();

  // Already signed in? Skip the login screen entirely.
  if (data?.claims) {
    redirect('/');
  }

  return (
    <main dir="rtl" className="flex min-h-[100dvh] items-center justify-center bg-[#0a0f1c] p-4 text-white font-sans">
      <div className="w-full max-w-sm bg-white/5 backdrop-blur-xl border border-white/10 p-8 rounded-[2rem] shadow-2xl">
        <h1 className="text-3xl font-black mb-2 text-center text-white">התחברות</h1>
        <p className="text-gray-400 text-sm text-center font-bold mb-8">
          התחבר כדי לראות נתונים מדויקים ולהשפיע על המדגם
        </p>

        {/* useSearchParams requires a Suspense boundary in the App Router */}
        <Suspense fallback={null}>
          <LoginForm />
        </Suspense>

        <Link
          href="/"
          className="block w-full text-center mt-2 text-gray-400 hover:text-white text-sm font-bold transition-colors"
        >
          חזור למסך הראשי
        </Link>
      </div>
    </main>
  );
}
