import { supabase } from '@/integrations/supabase/client';
import { extractDocumentSequenceNumber } from './documentNumber';

/**
 * Checks for and resolves any duplicate quotation or invoice numbers for the authenticated user.
 * Ensures that historical duplicates (e.g. two QT-0001s or two INV-0001s) are cleanly renumbered
 * in chronological order (QT-0001, QT-0002, etc.) and synchronizes the business sequence counters.
 */
export async function deduplicateUserDocuments(userId: string): Promise<boolean> {
  if (!userId) return false;
  let hasMadeChanges = false;

  try {
    // 1. Check and deduplicate Quotations
    const { data: quotations, error: qError } = await supabase
      .from('quotations')
      .select('id, quotation_number, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: true });

    if (!qError && quotations && quotations.length > 0) {
      const seenNumbers = new Set<string>();
      let maxSeq = 0;

      for (const q of quotations) {
        const seq = extractDocumentSequenceNumber(q.quotation_number);
        if (seq > maxSeq) maxSeq = seq;

        if (seenNumbers.has(q.quotation_number)) {
          // Found a duplicate! Assign next sequential number
          maxSeq += 1;
          const newNumber = `QT-${String(maxSeq).padStart(4, '0')}`;
          await supabase
            .from('quotations')
            .update({ quotation_number: newNumber })
            .eq('id', q.id);
          seenNumbers.add(newNumber);
          hasMadeChanges = true;
        } else {
          seenNumbers.add(q.quotation_number);
        }
      }

      // Update business counter if needed
      if (hasMadeChanges) {
        await supabase
          .from('businesses')
          .upsert({
            user_id: userId,
            current_quotation_number: maxSeq,
            updated_at: new Date().toISOString()
          }, { onConflict: 'user_id' });
      }
    }

    // 2. Check and deduplicate Invoices
    const { data: invoices, error: invError } = await supabase
      .from('invoices')
      .select('id, invoice_number, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: true });

    if (!invError && invoices && invoices.length > 0) {
      const seenNumbers = new Set<string>();
      let maxSeq = 0;

      for (const inv of invoices) {
        const seq = extractDocumentSequenceNumber(inv.invoice_number);
        if (seq > maxSeq) maxSeq = seq;

        if (seenNumbers.has(inv.invoice_number)) {
          // Duplicate found! Assign next sequential number
          maxSeq += 1;
          const newNumber = `INV-${String(maxSeq).padStart(4, '0')}`;
          await supabase
            .from('invoices')
            .update({ invoice_number: newNumber })
            .eq('id', inv.id);
          seenNumbers.add(newNumber);
          hasMadeChanges = true;
        } else {
          seenNumbers.add(inv.invoice_number);
        }
      }

      // Update business counter if needed
      if (hasMadeChanges) {
        await supabase
          .from('businesses')
          .upsert({
            user_id: userId,
            current_invoice_number: maxSeq,
            updated_at: new Date().toISOString()
          }, { onConflict: 'user_id' });
      }
    }
  } catch (err) {
    console.error('Error during document deduplication:', err);
  }

  return hasMadeChanges;
}
