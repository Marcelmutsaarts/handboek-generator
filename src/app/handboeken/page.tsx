import { createClient } from '@/lib/supabase/server';
import HandboekenClient from './HandboekenClient';
import { Handboek } from '@/types';

export default async function HandboekenPage() {
  const supabase = await createClient();

  // DEBUG: Check auth
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  console.log('🔍 DEBUG - User ID:', user?.id);
  console.log('🔍 DEBUG - User Email:', user?.email);
  console.log('🔍 DEBUG - Auth Error:', authError);

  let handboeken: Handboek[] = [];
  let error: string | null = null;

  try {
    const { data, error: fetchError } = await supabase
      .from('handboeken')
      .select('*')
      .order('updated_at', { ascending: false });

    // DEBUG: Check wat we terugkrijgen
    console.log('🔍 DEBUG - Aantal handboeken:', data?.length);
    console.log('🔍 DEBUG - Handboeken user_ids:', data?.map(h => h.user_id));

    if (fetchError) {
      error = 'Kon handboeken niet laden';
    } else {
      handboeken = data || [];
    }
  } catch {
    error = 'Kon handboeken niet laden';
  }

  // DEBUG: Toon debug info in UI
  const debugInfo = {
    userId: user?.id || 'GEEN USER',
    userEmail: user?.email || 'GEEN EMAIL',
    aantalHandboeken: handboeken.length,
    userIds: handboeken.map(h => h.user_id).join(', ') || 'geen handboeken',
  };

  return (
    <>
      {/* DEBUG INFO - TIJDELIJK */}
      <div style={{
        position: 'fixed',
        bottom: '10px',
        right: '10px',
        background: 'black',
        color: 'lime',
        padding: '10px',
        fontFamily: 'monospace',
        fontSize: '12px',
        zIndex: 9999,
        maxWidth: '400px',
        borderRadius: '5px'
      }}>
        <div><strong>🔍 DEBUG INFO</strong></div>
        <div>User ID: {debugInfo.userId}</div>
        <div>Email: {debugInfo.userEmail}</div>
        <div>Aantal: {debugInfo.aantalHandboeken}</div>
        <div>User IDs: {debugInfo.userIds}</div>
      </div>

      <HandboekenClient handboeken={handboeken} error={error} />
    </>
  );
}
