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
      const { data: initialData, error } = await supabase
        .from('businesses')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();
      
      if (error) throw error;

      let data = initialData;

      // Auto-provision a business profile row if one doesn't exist yet
      if (!data) {
        const { data: created, error: insertError } = await supabase
          .from('businesses')
          .insert({
            user_id: user.id,
            email: user.email,
            business_name: 'My Business',
            invoice_prefix: 'INV',
            invoice_starting_number: 1,
            current_invoice_number: 0,
            quotation_prefix: 'QT',
            quotation_starting_number: 1,
            current_quotation_number: 0,
            setup_completed: false,
          })
          .select()
          .maybeSingle();
        
        if (!insertError && created) {
          data = created;
        }
      }

      return data as Business | null;
    },
    enabled: !!user,
  });

  const updateBusiness = useMutation({
    mutationFn: async (updates: Partial<Business>) => {
      if (!user) throw new Error('Not authenticated');
      
      // Check if business row already exists
      const { data: existing } = await supabase
        .from('businesses')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();

      let result;
      if (existing) {
        // Use update so unspecified fields like logo_url are NEVER wiped
        result = await supabase
          .from('businesses')
          .update({ ...updates, updated_at: new Date().toISOString() })
          .eq('user_id', user.id)
          .select()
          .maybeSingle();
      } else {
        result = await supabase
          .from('businesses')
          .insert({ user_id: user.id, ...updates, updated_at: new Date().toISOString() })
          .select()
          .maybeSingle();
      }
      
      if (result.error) throw result.error;
      return result.data as Business;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['businesses'] });
      queryClient.invalidateQueries({ queryKey: ['business'] });
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
      const fileExt = file.name.split('.').pop() || 'png';
      const fileName = `${user.id}/logo-${Date.now()}.${fileExt}`;
      
      let finalLogoUrl: string | null = null;
      
      // Attempt upload to Supabase storage
      try {
        if (businessQuery.data?.logo_url && !businessQuery.data.logo_url.startsWith('data:')) {
          const oldPath = businessQuery.data.logo_url.split('/').pop();
          if (oldPath) {
            await supabase.storage
              .from('business-logos')
              .remove([`${user.id}/${oldPath}`]);
          }
        }

        const { error: uploadError } = await supabase.storage
          .from('business-logos')
          .upload(fileName, file, {
            cacheControl: '3600',
            upsert: true,
          });
        
        if (!uploadError) {
          const { data: { publicUrl } } = supabase.storage
            .from('business-logos')
            .getPublicUrl(fileName);
          finalLogoUrl = publicUrl;
        }
      } catch (storageErr) {
        console.warn('Storage bucket upload failed, using data URL fallback:', storageErr);
      }

      // If storage is not available, convert to base64 Data URL so upload ALWAYS succeeds
      if (!finalLogoUrl) {
        finalLogoUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
      }
      
      // Update business with logo URL
      const { data, error } = await supabase
        .from('businesses')
        .update({ logo_url: finalLogoUrl, updated_at: new Date().toISOString() })
        .eq('user_id', user.id)
        .select()
        .maybeSingle();
      
      if (error) throw error;
      return data as Business;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['businesses'] });
      queryClient.invalidateQueries({ queryKey: ['business'] });
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
    mutationFn: async (targetNumber?: number) => {
      if (!user) throw new Error('Not authenticated');
      
      const { data: existing } = await supabase
        .from('businesses')
        .select('id, current_invoice_number')
        .eq('user_id', user.id)
        .maybeSingle();
      
      const nextNum = targetNumber !== undefined 
        ? Math.max(targetNumber, (existing?.current_invoice_number || 0))
        : (existing?.current_invoice_number || 0) + 1;
      
      const { error } = await supabase
        .from('businesses')
        .upsert({ 
          user_id: user.id,
          current_invoice_number: nextNum,
          updated_at: new Date().toISOString() 
        }, { onConflict: 'user_id' });
      
      if (error) throw error;
      return nextNum;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['businesses'] });
      queryClient.invalidateQueries({ queryKey: ['business'] });
    },
  });

  // Increment quotation counter
  const incrementQuotationNumber = useMutation({
    mutationFn: async (targetNumber?: number) => {
      if (!user) throw new Error('Not authenticated');
      
      const { data: existing } = await supabase
        .from('businesses')
        .select('id, current_quotation_number')
        .eq('user_id', user.id)
        .maybeSingle();
      
      const nextNum = targetNumber !== undefined 
        ? Math.max(targetNumber, (existing?.current_quotation_number || 0))
        : (existing?.current_quotation_number || 0) + 1;
      
      const { error } = await supabase
        .from('businesses')
        .upsert({ 
          user_id: user.id,
          current_quotation_number: nextNum,
          updated_at: new Date().toISOString() 
        }, { onConflict: 'user_id' });
      
      if (error) throw error;
      return nextNum;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['businesses'] });
      queryClient.invalidateQueries({ queryKey: ['business'] });
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
