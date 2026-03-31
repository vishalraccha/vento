import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

type TableName = 'invoices' | 'clients' | 'inventory_items' | 'quotations' | 'tasks' | 'businesses';

interface UseRealtimeSubscriptionOptions {
  tables: TableName[];
  enabled?: boolean;
}

export function useRealtimeSubscription({ tables, enabled = true }: UseRealtimeSubscriptionOptions) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!user || !enabled) return;

    const channels = tables.map((table) => {
      const channel = supabase
        .channel(`realtime-${table}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: table,
            filter: `user_id=eq.${user.id}`,
          },
          (payload) => {
            console.log(`Realtime update on ${table}:`, payload.eventType);
            // Invalidate the query to refetch data
            queryClient.invalidateQueries({ queryKey: [table] });
          }
        )
        .subscribe();

      return channel;
    });

    return () => {
      channels.forEach((channel) => {
        supabase.removeChannel(channel);
      });
    };
  }, [user, tables, enabled, queryClient]);
}

// Hook for invoice items (uses invoice_id filter through invoices)
export function useInvoiceItemsRealtime(invoiceId: string | undefined) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!invoiceId) return;

    const channel = supabase
      .channel(`realtime-invoice-items-${invoiceId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'invoice_items',
          filter: `invoice_id=eq.${invoiceId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['invoice', invoiceId] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [invoiceId, queryClient]);
}
