/**
 * Centralized, validated access to environment variables.
 *
 * Throwing a clear error here (instead of letting `supabaseUrl!` silently
 * become `undefined` at runtime) turns a confusing "Invalid URL" crash deep
 * inside the Supabase client into an actionable message at startup.
 */
function required(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(
      `Missing required environment variable: ${name}. ` +
        'Copy .env.example to .env.local and fill in your Supabase project credentials.'
    );
  }
  return value;
}

export const env = {
  NEXT_PUBLIC_SUPABASE_URL: required('NEXT_PUBLIC_SUPABASE_URL', process.env.NEXT_PUBLIC_SUPABASE_URL),
  // Supabase now calls this the "publishable key"; it's the same public/anon
  // key you've always used, just renamed. Either an anon key or a new
  // publishable key value works here.
  NEXT_PUBLIC_SUPABASE_ANON_KEY: required(
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  ),
};
