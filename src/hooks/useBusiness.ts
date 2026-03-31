import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Business } from '@/types/database';
import { useToast } from '@/hooks/use-toast';
import { useRealtimeSubscription } from './useRealtimeSubscription';

export function useBusiness() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Enable real-time updates for business
  useRealtimeSubscription({ tables: ['businesses'], enabled: !!user });

  const businessQuery = useQuery({
    queryKey: ['businesses', user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase
        .from('businesses')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();
      
      if (error) throw error;
      return data as Business | null;
    },
    enabled: !!user,
  });

  const updateBusiness = useMutation({
    mutationFn: async (updates: Partial<Business>) => {
      if (!user) throw new Error('Not authenticated');
      
      const { data, error } = await supabase
        .from('businesses')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('user_id', user.id)
        .select()
        .maybeSingle();
      
      if (error) throw error;
      return data as Business;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['businesses'] });
      toast({ title: 'Business profile updated successfully' });
    },
    onError: (error) => {
      toast({ 
        variant: 'destructive', 
        title: 'Failed to update business profile', 
        description: error.message 
      });
    },
  });

  const uploadLogo = useMutation({
    mutationFn: async (file: File) => {
      if (!user) throw new Error('Not authenticated');
      
      // Generate unique filename
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/logo-${Date.now()}.${fileExt}`;
      
      // Delete old logo if exists
      if (businessQuery.data?.logo_url) {
        const oldPath = businessQuery.data.logo_url.split('/').pop();
        if (oldPath) {
          await supabase.storage
            .from('business-logos')
            .remove([`${user.id}/${oldPath}`]);
        }
      }
      
      // Upload new logo
      const { error: uploadError } = await supabase.storage
        .from('business-logos')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: true,
        });
      
      if (uploadError) throw uploadError;
      
      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('business-logos')
        .getPublicUrl(fileName);
      
      // Update business with logo URL
      const { data, error } = await supabase
        .from('businesses')
        .update({ logo_url: publicUrl, updated_at: new Date().toISOString() })
        .eq('user_id', user.id)
        .select()
        .maybeSingle();
      
      if (error) throw error;
      return data as Business;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['businesses'] });
      toast({ title: 'Logo uploaded successfully' });
    },
    onError: (error) => {
      toast({ 
        variant: 'destructive', 
        title: 'Failed to upload logo', 
        description: error.message 
      });
    },
  });

  const removeLogo = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error('Not authenticated');
      if (!businessQuery.data?.logo_url) return null;
      
      // Extract filename from URL
      const urlParts = businessQuery.data.logo_url.split('/');
      const fileName = urlParts.slice(-2).join('/'); // user_id/filename
      
      // Delete from storage
      await supabase.storage
        .from('business-logos')
        .remove([fileName]);
      
      // Update business
      const { data, error } = await supabase
        .from('businesses')
        .update({ logo_url: null, updated_at: new Date().toISOString() })
        .eq('user_id', user.id)
        .select()
        .maybeSingle();
      
      if (error) throw error;
      return data as Business;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['businesses'] });
      toast({ title: 'Logo removed successfully' });
    },
    onError: (error) => {
      toast({ 
        variant: 'destructive', 
        title: 'Failed to remove logo', 
        description: error.message 
      });
    },
  });

  // Generate next invoice number
  const getNextInvoiceNumber = () => {
    const business = businessQuery.data;
    if (!business) return 'INV-001';
    
    const prefix = business.invoice_prefix || 'INV';
    const currentNum = (business.current_invoice_number || 0) + 1;
    const startNum = business.invoice_starting_number || 1;
    const num = Math.max(currentNum, startNum);
    
    return `${prefix}-${String(num).padStart(3, '0')}`;
  };

  // Generate next quotation number
  const getNextQuotationNumber = () => {
    const business = businessQuery.data;
    if (!business) return 'QT-001';
    
    const prefix = business.quotation_prefix || 'QT';
    const currentNum = (business.current_quotation_number || 0) + 1;
    const startNum = business.quotation_starting_number || 1;
    const num = Math.max(currentNum, startNum);
    
    return `${prefix}-${String(num).padStart(3, '0')}`;
  };

  // Increment invoice counter
  const incrementInvoiceNumber = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error('Not authenticated');
      
      const currentNum = businessQuery.data?.current_invoice_number || 0;
      
      const { error } = await supabase
        .from('businesses')
        .update({ 
          current_invoice_number: currentNum + 1,
          updated_at: new Date().toISOString() 
        })
        .eq('user_id', user.id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['businesses'] });
    },
  });

  // Increment quotation counter
  const incrementQuotationNumber = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error('Not authenticated');
      
      const currentNum = businessQuery.data?.current_quotation_number || 0;
      
      const { error } = await supabase
        .from('businesses')
        .update({ 
          current_quotation_number: currentNum + 1,
          updated_at: new Date().toISOString() 
        })
        .eq('user_id', user.id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['businesses'] });
    },
  });

  return {
    business: businessQuery.data,
    isLoading: businessQuery.isLoading,
    error: businessQuery.error,
    updateBusiness,
    uploadLogo,
    removeLogo,
    getNextInvoiceNumber,
    getNextQuotationNumber,
    incrementInvoiceNumber,
    incrementQuotationNumber,
  };
}
