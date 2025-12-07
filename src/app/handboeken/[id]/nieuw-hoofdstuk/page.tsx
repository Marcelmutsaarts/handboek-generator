import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createServerClient } from '@supabase/ssr';
import NieuwHoofdstukClient from './NieuwHoofdstukClient';
import { Handboek, Hoofdstuk } from '@/types';

export default async function NieuwHoofdstukPage({
  params,
}: {
  params: { id: string };
}) {
  const handboekId = params.id;
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

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    redirect('/login');
  }

  let handboek: Handboek | null = null;
  let hoofdstukken: Hoofdstuk[] = [];
  let error: string | null = null;

  try {
    const { data: handboekData, error: handboekError } = await supabase
      .from('handboeken')
      .select('*')
      .eq('id', handboekId)
      .single();

    if (handboekError || !handboekData) {
      error = 'Handboek niet gevonden';
    } else {
      handboek = handboekData;
      const { data: hoofdstukkenData, error: hoofdstukkenError } = await supabase
        .from('hoofdstukken')
        .select('*')
        .eq('handboek_id', handboekId)
        .order('volgorde', { ascending: true });

      if (hoofdstukkenError) {
        error = 'Kon hoofdstukken niet laden';
      } else if (hoofdstukkenData) {
        hoofdstukken = hoofdstukkenData;
      }
    }
  } catch {
    error = 'Er ging iets mis bij het laden';
  }

  return (
    <NieuwHoofdstukClient
      handboekId={handboekId}
      initialHandboek={handboek}
      initialHoofdstukken={hoofdstukken}
      initialError={error}
    />
  );
}
