import { createClient } from '@/lib/supabase/server';
import HandboekenClient from './HandboekenClient';
import { Handboek } from '@/types';

export default async function HandboekenPage() {
  const supabase = await createClient();

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
