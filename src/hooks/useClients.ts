import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Client } from '@/types/database';
import { useToast } from '@/hooks/use-toast';
import { useRealtimeSubscription } from './useRealtimeSubscription';

export function useClients() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Enable real-time updates
  useRealtimeSubscription({ tables: ['clients'], enabled: !!user });

  const clientsQuery = useQuery({
    queryKey: ['clients', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .order('name', { ascending: true });
      
      if (error) throw error;
      return data as Client[];
    },
    enabled: !!user,
    staleTime: 1000 * 60, // Consider data fresh for 1 minute
  });

  // Get single client by ID
  const useClient = (clientId: string | undefined) => {
    return useQuery({
      queryKey: ['clients', clientId],
      queryFn: async () => {
        if (!clientId) return null;
        const { data, error } = await supabase
          .from('clients')
          .select('*')
          .eq('id', clientId)
          .maybeSingle();
        
        if (error) throw error;
        return data as Client | null;
      },
      enabled: !!clientId && !!user,
    });
  };

  const createClient = useMutation({
    mutationFn: async (client: Omit<Client, 'id' | 'user_id' | 'created_at' | 'updated_at'>) => {
      if (!user) throw new Error('Not authenticated');
      
      const { data, error } = await supabase
        .from('clients')
        .insert({ ...client, user_id: user.id })
        .select()
        .single();
      
      if (error) throw error;
      return data as Client;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      toast({ title: 'Client created successfully' });
    },
    onError: (error) => {
      toast({ 
        variant: 'destructive', 
        title: 'Failed to create client', 
        description: error.message 
      });
    },
  });

  const updateClient = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Client> & { id: string }) => {
      const { data, error } = await supabase
        .from('clients')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data as Client;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      toast({ title: 'Client updated successfully' });
    },
    onError: (error) => {
      toast({ 
        variant: 'destructive', 
        title: 'Failed to update client', 
        description: error.message 
      });
    },
  });

  const deleteClient = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('clients')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      toast({ title: 'Client deleted successfully' });
    },
    onError: (error) => {
      toast({ 
        variant: 'destructive', 
        title: 'Failed to delete client', 
        description: error.message 
      });
    },
  });

  // Search clients
  const searchClients = (query: string) => {
    if (!query) return clientsQuery.data ?? [];
    const lowerQuery = query.toLowerCase();
    return (clientsQuery.data ?? []).filter(client => 
      client.name.toLowerCase().includes(lowerQuery) ||
      client.email?.toLowerCase().includes(lowerQuery) ||
      client.phone?.includes(query)
    );
  };

  // Get active clients only
  const activeClients = (clientsQuery.data ?? []).filter(c => c.is_active !== false);

  // Stats
  const stats = {
    totalClients: clientsQuery.data?.length ?? 0,
    activeClients: activeClients.length,
  };

  return {
    clients: clientsQuery.data ?? [],
    activeClients,
    isLoading: clientsQuery.isLoading,
    error: clientsQuery.error,
    stats,
    searchClients,
    useClient,
    createClient,
    updateClient,
    deleteClient,
  };
}
