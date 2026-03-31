import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import type { Quotation, QuotationItem } from '@/types/database';

export function useQuotations() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const quotationsQuery = useQuery({
  queryKey: ['quotations', user?.id],
  queryFn: async () => {
    if (!user?.id) return [];
    const { data, error } = await supabase
      .from('quotations')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data as Quotation[];
  },
  enabled: !!user?.id,
});

const quotationsWithItemsQuery = useQuery({
  queryKey: ['quotations-with-items', user?.id],
  queryFn: async () => {
    if (!user?.id) return [];
    const { data, error } = await supabase
      .from('quotations')
      .select('*, quotation_items(*)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data ?? []).map(q => ({
      ...q,
      items: q.quotation_items ?? [],
    }));
  },
  enabled: !!user?.id,
});

const useQuotation = (quotationId: string | undefined) => {
  return useQuery({
    queryKey: ['quotation', quotationId],
    queryFn: async () => {
      if (!quotationId) return null;
      const { data: quotation, error: quotationError } = await supabase
        .from('quotations')
        .select('*')
        .eq('id', quotationId)
        .maybeSingle();
      if (quotationError) throw quotationError;
      if (!quotation) return null;

      const { data: items, error: itemsError } = await supabase
        .from('quotation_items')
        .select('*')
        .eq('quotation_id', quotationId)
        .order('sort_order', { ascending: true });
      if (itemsError) throw itemsError;

      return { ...quotation, items: items ?? [] };
    },
    enabled: !!quotationId && !!user?.id,
  });
};

  const createQuotation = useMutation({
    mutationFn: async ({ quotation, items }: { quotation: Omit<Quotation, 'id' | 'user_id' | 'created_at' | 'updated_at'>; items: Omit<QuotationItem, 'id' | 'quotation_id' | 'created_at'>[] }) => {
      if (!user?.id) throw new Error('User not authenticated');

      // Create quotation
      const { data: quotationData, error: quotationError } = await supabase
        .from('quotations')
        .insert([{ ...quotation, user_id: user.id }])
        .select()
        .single();

      if (quotationError) throw quotationError;

      // Create quotation items
      if (items.length > 0) {
        const quotationItems = items.map(item => ({
          ...item,
          quotation_id: quotationData.id,
        }));

        const { error: itemsError } = await supabase
          .from('quotation_items')
          .insert(quotationItems);

        if (itemsError) throw itemsError;
      }

      // Update current quotation number in business
      const { data: businessData } = await supabase
        .from('businesses')
        .select('current_quotation_number')
        .eq('user_id', user.id)
        .single();
      
      await supabase
        .from('businesses')
        .update({ current_quotation_number: (businessData?.current_quotation_number || 0) + 1 })
        .eq('user_id', user.id);

      return quotationData;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quotations'] });
      queryClient.invalidateQueries({ queryKey: ['business'] });
    },
  });

  const updateQuotation = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Quotation> & { id: string }) => {
      const { data, error } = await supabase
        .from('quotations')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quotations'] });
    },
  });

  const deleteQuotation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('quotations')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quotations'] });
    },
  });

  const convertToInvoice = useMutation({
    mutationFn: async (quotationId: string) => {
      if (!user?.id) throw new Error('User not authenticated');

      // Get quotation with items
      const { data: quotation, error: quotationError } = await supabase
        .from('quotations')
        .select('*')
        .eq('id', quotationId)
        .single();

      if (quotationError) throw quotationError;

      const { data: quotationItems, error: itemsError } = await supabase
        .from('quotation_items')
        .select('*')
        .eq('quotation_id', quotationId);

      if (itemsError) throw itemsError;

      // Get business for invoice number
      const { data: business } = await supabase
        .from('businesses')
        .select('invoice_prefix, current_invoice_number')
        .eq('user_id', user.id)
        .single();

      const invoiceNumber = `${business?.invoice_prefix || 'INV'}-${String((business?.current_invoice_number || 0) + 1).padStart(4, '0')}`;

      // Create invoice from quotation
      const { data: invoice, error: invoiceError } = await supabase
        .from('invoices')
        .insert([{
          user_id: user.id,
          client_id: quotation.client_id,
          invoice_number: invoiceNumber,
          invoice_date: new Date().toISOString().split('T')[0],
          due_date: null,
          status: 'draft',
          subtotal: quotation.subtotal,
          tax_amount: quotation.tax_amount,
          discount_amount: quotation.discount_amount || 0,
          total_amount: quotation.total_amount,
          amount_paid: 0,
          notes: quotation.notes,
          terms: quotation.terms,
          client_name: quotation.client_name,
          client_email: quotation.client_email,
          client_phone: quotation.client_phone,
          client_address: quotation.client_address,
          client_gstin: quotation.client_gstin,
        }])
        .select()
        .single();

      if (invoiceError) throw invoiceError;

      // Create invoice items from quotation items
      if (quotationItems && quotationItems.length > 0) {
        const invoiceItems = quotationItems.map(item => ({
          invoice_id: invoice.id,
          inventory_item_id: item.inventory_item_id,
          name: item.name,
          description: item.description,
          hsn_code: item.hsn_code,
          quantity: item.quantity,
          unit: item.unit,
          unit_price: item.unit_price,
          tax_rate: item.tax_rate,
          tax_amount: item.tax_amount,
          subtotal: item.subtotal,
          total: item.total,
          sort_order: item.sort_order,
        }));

        const { error: invoiceItemsError } = await supabase
          .from('invoice_items')
          .insert(invoiceItems);

        if (invoiceItemsError) throw invoiceItemsError;
      }

      // Update quotation status
      await supabase
        .from('quotations')
        .update({ status: 'converted', converted_invoice_id: invoice.id })
        .eq('id', quotationId);

      // Update current invoice number
      await supabase
        .from('businesses')
        .update({ current_invoice_number: (business?.current_invoice_number || 0) + 1 })
        .eq('user_id', user.id);

      return invoice;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quotations'] });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['business'] });
    },
  });

  // Calculate stats
  const stats = {
    total: quotationsQuery.data?.length || 0,
    pending: quotationsQuery.data?.filter(q => q.status === 'sent').length || 0,
    approved: quotationsQuery.data?.filter(q => q.status === 'approved').length || 0,
    totalValue: quotationsQuery.data?.reduce((sum, q) => sum + q.total_amount, 0) || 0,
  };

  return {
    quotations: quotationsQuery.data || [],
  quotationsWithItems: quotationsWithItemsQuery.data || [],  // ← ADD
  isLoading: quotationsQuery.isLoading,
  error: quotationsQuery.error,
  stats,
  useQuotation,        // ← ADD
  createQuotation,
  updateQuotation,
  deleteQuotation,
  convertToInvoice,
  };
}
