import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Invoice, InvoiceItem } from '@/types/database';
import { useToast } from '@/hooks/use-toast';
import { useRealtimeSubscription } from './useRealtimeSubscription';
import { useBusiness } from './useBusiness';
import { extractDocumentSequenceNumber } from '@/lib/documentNumber';
import { deduplicateUserDocuments } from '@/lib/deduplicateDocuments';

export function useInvoices() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { incrementInvoiceNumber } = useBusiness();

  // Enable real-time updates
  useRealtimeSubscription({ tables: ['invoices'], enabled: !!user });

  const invoicesQuery = useQuery({
    queryKey: ['invoices', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('invoices')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;

      // Auto-detect and resolve any legacy duplicate numbers
      if (data && data.length > 1) {
        const numbers = data.map(i => i.invoice_number);
        if (new Set(numbers).size !== numbers.length) {
          deduplicateUserDocuments(user.id).then(changed => {
            if (changed) {
              queryClient.invalidateQueries({ queryKey: ['invoices'] });
              queryClient.invalidateQueries({ queryKey: ['quotations'] });
              queryClient.invalidateQueries({ queryKey: ['businesses'] });
            }
          });
        }
      }

      return data as Invoice[];
    },
    enabled: !!user,
    staleTime: 1000 * 60,
  });

  // Get single invoice with items
  const useInvoice = (invoiceId: string | undefined) => {
    return useQuery({
      queryKey: ['invoice', invoiceId],
      queryFn: async () => {
        if (!invoiceId) return null;
        
        // Get invoice
        const { data: invoice, error: invoiceError } = await supabase
          .from('invoices')
          .select('*')
          .eq('id', invoiceId)
          .maybeSingle();
        
        if (invoiceError) throw invoiceError;
        if (!invoice) return null;

        // Get invoice items
        const { data: items, error: itemsError } = await supabase
          .from('invoice_items')
          .select('*')
          .eq('invoice_id', invoiceId)
          .order('sort_order', { ascending: true });
        
        if (itemsError) throw itemsError;

        return { ...invoice, items: items ?? [] };
      },
      enabled: !!invoiceId && !!user,
    });
  };

  const createInvoice = useMutation({
    mutationFn: async ({ 
      invoice, 
      items 
    }: { 
      invoice: Omit<Invoice, 'id' | 'user_id' | 'created_at' | 'updated_at'>; 
      items: Omit<InvoiceItem, 'id' | 'invoice_id' | 'created_at'>[];
    }) => {
      if (!user) throw new Error('Not authenticated');
      
      // Create invoice
      const { data: invoiceData, error: invoiceError } = await supabase
        .from('invoices')
        .insert({ ...invoice, user_id: user.id })
        .select()
        .single();
      
      if (invoiceError) throw invoiceError;
      
      // Create invoice items and adjust stock
      if (items.length > 0) {
        const itemsWithInvoiceId = items.map((item, index) => ({
          ...item,
          invoice_id: invoiceData.id,
          sort_order: index,
        }));
        
        const { error: itemsError } = await supabase
          .from('invoice_items')
          .insert(itemsWithInvoiceId);
        
        if (itemsError) throw itemsError;

        // Deduct inventory stock
        for (const item of items) {
          if (item.inventory_item_id && Number(item.quantity) > 0) {
            try {
              const { data: invItem } = await supabase
                .from('inventory_items')
                .select('stock_quantity, is_service')
                .eq('id', item.inventory_item_id)
                .single();

              if (invItem && !invItem.is_service && typeof invItem.stock_quantity === 'number') {
                const newStock = Math.max(0, invItem.stock_quantity - Number(item.quantity));
                await supabase
                  .from('inventory_items')
                  .update({ stock_quantity: newStock })
                  .eq('id', item.inventory_item_id);
              }
            } catch {
              // Non-blocking stock update
            }
          }
        }
      }

      // Increment invoice number counter with actual sequence number
      const seq = extractDocumentSequenceNumber(invoice.invoice_number);
      await incrementInvoiceNumber.mutateAsync(seq);
      
      return invoiceData as Invoice;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['invoices-with-items'] });
      queryClient.invalidateQueries({ queryKey: ['businesses'] });
      queryClient.invalidateQueries({ queryKey: ['business'] });
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      toast({ title: 'Invoice created successfully' });
    },
    onError: (error) => {
      toast({ 
        variant: 'destructive', 
        title: 'Failed to create invoice', 
        description: error.message 
      });
    },
  });

  const updateInvoice = useMutation({
    mutationFn: async ({ 
      id, 
      invoice, 
      items 
    }: { 
      id: string; 
      invoice: Partial<Invoice>; 
      items?: Omit<InvoiceItem, 'id' | 'invoice_id' | 'created_at'>[];
    }) => {
      // Update invoice
      const { data, error } = await supabase
        .from('invoices')
        .update({ ...invoice, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;

      // If items provided, replace all items
      if (items) {
        // Delete existing items
        await supabase
          .from('invoice_items')
          .delete()
          .eq('invoice_id', id);

        // Insert new items
        if (items.length > 0) {
          const itemsWithInvoiceId = items.map((item, index) => ({
            ...item,
            invoice_id: id,
            sort_order: index,
          }));
          
          const { error: itemsError } = await supabase
            .from('invoice_items')
            .insert(itemsWithInvoiceId);
          
          if (itemsError) throw itemsError;
        }
      }

      return data as Invoice;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['invoice'] });
      toast({ title: 'Invoice updated successfully' });
    },
    onError: (error) => {
      toast({ 
        variant: 'destructive', 
        title: 'Failed to update invoice', 
        description: error.message 
      });
    },
  });

  const updateInvoiceStatus = useMutation({
    mutationFn: async ({ id, status, paymentDetails }: { 
      id: string; 
      status: 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled'; 
      paymentDetails?: { amount_paid?: number; payment_method?: string; payment_date?: string };
    }) => {
      const updateData: Partial<Invoice> = {
        status, 
        updated_at: new Date().toISOString(),
        ...paymentDetails,
      };

      const { data, error } = await supabase
        .from('invoices')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data as Invoice;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['invoice'] });
      queryClient.invalidateQueries({ queryKey: ['invoices-with-items'] });
      queryClient.invalidateQueries({ queryKey: ['businesses'] });
      queryClient.invalidateQueries({ queryKey: ['business'] });
      toast({ title: 'Invoice status updated' });
    },
    onError: (error) => {
      toast({ 
        variant: 'destructive', 
        title: 'Failed to update status', 
        description: error.message 
      });
    },
  });

  const deleteInvoice = useMutation({
    mutationFn: async (id: string) => {
      // Delete items first (cascade should handle this, but being explicit)
      await supabase
        .from('invoice_items')
        .delete()
        .eq('invoice_id', id);

      const { error } = await supabase
        .from('invoices')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['invoices-with-items'] });
      toast({ title: 'Invoice deleted successfully' });
    },
    onError: (error) => {
      toast({ 
        variant: 'destructive', 
        title: 'Failed to delete invoice', 
        description: error.message 
      });
    },
  });

  // Filter invoices by status
  const filterByStatus = (status: string | null) => {
    if (!status || status === 'all') return invoicesQuery.data ?? [];
    return (invoicesQuery.data ?? []).filter(inv => inv.status === status);
  };

  // Search invoices
  const searchInvoices = (query: string) => {
    if (!query) return invoicesQuery.data ?? [];
    const lowerQuery = query.toLowerCase();
    return (invoicesQuery.data ?? []).filter(invoice => 
      invoice.invoice_number.toLowerCase().includes(lowerQuery) ||
      invoice.client_name?.toLowerCase().includes(lowerQuery)
    );
  };

  // Calculate stats accurately
  const stats = {
    totalInvoices: invoicesQuery.data?.length ?? 0,
    paidAmount: (invoicesQuery.data ?? []).reduce((sum, i) => {
      if (i.status === 'paid') return sum + Number(i.total_amount || 0);
      return sum + Number(i.amount_paid || 0);
    }, 0),
    pendingAmount: (invoicesQuery.data ?? []).reduce((sum, i) => {
      if (i.status === 'paid') return sum;
      const total = Number(i.total_amount || 0);
      const paid = Number(i.amount_paid || 0);
      return sum + Math.max(0, total - paid);
    }, 0),
    overdueCount: (invoicesQuery.data ?? []).filter(i => {
      if (i.status === 'overdue') return true;
      if (i.status !== 'paid' && i.due_date && new Date(i.due_date) < new Date()) return true;
      return false;
    }).length,
    draftCount: (invoicesQuery.data ?? []).filter(i => i.status === 'draft').length,
  };

  // Get recent invoices
  const recentInvoices = (invoicesQuery.data ?? []).slice(0, 5);

  // Fetch all invoices WITH items (used for PDF generation in Documents page)
const invoicesWithItemsQuery = useQuery({
  queryKey: ['invoices-with-items', user?.id],
  queryFn: async () => {
    if (!user) return [];
    const { data, error } = await supabase
      .from('invoices')
      .select('*, invoice_items(*)')
      .order('created_at', { ascending: false });
    if (error) throw error;
    // Rename invoice_items → items to match PDF generator
    return (data ?? []).map(inv => ({
      ...inv,
      items: inv.invoice_items ?? [],
    }));
  },
  enabled: !!user,
  staleTime: 1000 * 60,
});

  return {
     invoices: invoicesQuery.data ?? [],
  invoicesWithItems: invoicesWithItemsQuery.data ?? [],  // ← add this
  recentInvoices,
    isLoading: invoicesQuery.isLoading,
    error: invoicesQuery.error,
    stats,
    filterByStatus,
    searchInvoices,
    useInvoice,
    createInvoice,
    updateInvoice,
    updateInvoiceStatus,
    deleteInvoice,
  };
}
