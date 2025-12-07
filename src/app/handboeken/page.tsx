import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import HandboekenClient from './HandboekenClient';
import { Handboek } from '@/types';

export default async function HandboekenPage() {
  const cookieStore = await cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll() {
          // no-op on server render
        },
      },
    }
  );

  let handboeken: Handboek[] = [];
  let error: string | null = null;

  try {
    const { data, error: fetchError } = await supabase
      .from('handboeken')
      .select('*')
      .order('updated_at', { ascending: false });

    if (fetchError) {
      error = 'Kon handboeken niet laden';
    } else {
      handboeken = data || [];
    }
  } catch {
    error = 'Kon handboeken niet laden';
  }

  return <HandboekenClient handboeken={handboeken} error={error} />;
}
