import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createServerClient } from '@supabase/ssr';
import HandboekDetailClient from './HandboekDetailClient';
import { Handboek, Hoofdstuk, Afbeelding } from '@/types';

export default async function HandboekDetailPage({
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
  let afbeeldingenPerHoofdstuk: Record<string, Afbeelding[]> = {};
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
        if (hoofdstukkenData.length > 0) {
          const hoofdstukIds = hoofdstukkenData.map((h) => h.id);
          const { data: afbeeldingenData } = await supabase
            .from('afbeeldingen')
            .select('*')
            .in('hoofdstuk_id', hoofdstukIds)
            .order('volgorde', { ascending: true });

          if (afbeeldingenData) {
            const grouped: Record<string, Afbeelding[]> = {};
            afbeeldingenData.forEach((afb) => {
              if (!grouped[afb.hoofdstuk_id]) {
                grouped[afb.hoofdstuk_id] = [];
              }
              grouped[afb.hoofdstuk_id].push(afb);
            });
            afbeeldingenPerHoofdstuk = grouped;
          }
        }
      }
    }
  } catch {
    error = 'Er ging iets mis bij het laden';
  }

  return (
    <HandboekDetailClient
      handboekId={handboekId}
      initialHandboek={handboek}
      initialHoofdstukken={hoofdstukken}
      initialAfbeeldingen={afbeeldingenPerHoofdstuk}
      initialError={error}
    />
  );
}
