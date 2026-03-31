import { useState, useCallback, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useBusiness } from './useBusiness';

const FUNCTION_URL = 'https://qkbibprgxcmlgysptbha.supabase.co/functions/v1/google-oauth';

// ✅ FIXED: Use /auth/callback — this matches Google Console registered URI
const getRedirectUri = () =>
  "https://qkbibprgxcmlgyspthha.supabase.co/functions/v1/google-oauth";

function getUploadedFiles(): Set<string> {
  try {
    const stored = localStorage.getItem('vento_uploaded_drive_files');
    return new Set(stored ? JSON.parse(stored) : []);
  } catch {
    return new Set();
  }
}

function markFileUploaded(fileName: string) {
  const files = getUploadedFiles();
  files.add(fileName);
  localStorage.setItem('vento_uploaded_drive_files', JSON.stringify([...files]));
}

export function useGoogleDrive() {
  const { user, session } = useAuth();
  const { toast } = useToast();
  const { business } = useBusiness();
  const queryClient = useQueryClient();
  const [isConnecting, setIsConnecting] = useState(false);
  const uploadingFilesRef = useRef<Set<string>>(new Set());

  const connectionQuery = useQuery({
    queryKey: ['google-drive-connection', user?.id],
    queryFn: async () => {
      if (!session?.access_token) return { connected: false };

      const response = await fetch(FUNCTION_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ action: 'check_connection' }),
      });

      if (!response.ok) {
        console.error('Check connection error:', await response.json());
        return { connected: false };
      }

      return await response.json();
    },
    enabled: !!user && !!session,
    staleTime: 1000 * 60 * 5,
  });

  const connect = useCallback(async () => {
    if (!session?.access_token) {
      toast({
        variant: 'destructive',
        title: 'Not logged in',
        description: 'Please log in to connect Google Drive.',
      });
      return;
    }

    setIsConnecting(true);

    try {
      // ✅ FIXED: redirectUri now matches Google Console
      const redirectUri = getRedirectUri();

      const response = await fetch(FUNCTION_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          action: 'get_auth_url',
          redirectUri,          // ✅ sends /auth/callback to your Edge Function
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to get auth URL');
      }

      const { authUrl } = await response.json();

      // ✅ Store the correct redirectUri for the callback step
      localStorage.setItem('google_drive_redirect_uri', redirectUri);

      window.location.href = authUrl;
    } catch (error: any) {
      console.error('Connect error:', error);
      toast({
        variant: 'destructive',
        title: 'Connection failed',
        description: error.message || 'Failed to connect to Google Drive.',
      });
      setIsConnecting(false);
    }
  }, [session, toast]);

  // ✅ handleCallback stays the same — it reads redirectUri from localStorage
  const handleCallback = useCallback(async (code: string) => {
    if (!session?.access_token) return false;

    try {
      const redirectUri = localStorage.getItem('google_drive_redirect_uri') || getRedirectUri();

      const response = await fetch(FUNCTION_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          action: 'exchange_code',
          code,
          redirectUri,          // ✅ must match what was sent in get_auth_url
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to exchange code');
      }

      localStorage.removeItem('google_drive_redirect_uri');
      queryClient.invalidateQueries({ queryKey: ['google-drive-connection'] });

      toast({
        title: 'Connected!',
        description: 'Google Drive has been connected successfully.',
      });

      return true;
    } catch (error: any) {
      console.error('Callback error:', error);
      toast({
        variant: 'destructive',
        title: 'Connection failed',
        description: error.message || 'Failed to complete Google Drive connection.',
      });
      return false;
    }
  }, [session, toast, queryClient]);

  const disconnect = useMutation({
    mutationFn: async () => {
      if (!session?.access_token) throw new Error('Not authenticated');

      const response = await fetch(FUNCTION_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ action: 'disconnect' }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to disconnect');
      }

      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['google-drive-connection'] });
      toast({ title: 'Disconnected', description: 'Google Drive has been disconnected.' });
    },
    onError: (error: any) => {
      toast({ variant: 'destructive', title: 'Disconnect failed', description: error.message });
    },
  });

  const uploadDocument = useMutation({
    mutationFn: async ({
      fileName,
      fileContent,
      documentType,
    }: {
      fileName: string;
      fileContent: string;
      documentType: 'invoice' | 'quotation';
    }) => {
      if (!session?.access_token) throw new Error('Not authenticated');

      if (uploadingFilesRef.current.has(fileName)) {
        return { success: true, alreadyExists: true, message: 'Upload already in progress' };
      }

      const alreadyUploaded = getUploadedFiles();
      if (alreadyUploaded.has(fileName)) {
        return { success: true, alreadyExists: true, message: 'Document already synced to Google Drive' };
      }

      uploadingFilesRef.current.add(fileName);

      try {
        const response = await fetch(FUNCTION_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            action: 'upload_document',
            fileName,
            fileContent,
            documentType,
            businessName: business?.business_name || 'My Business',
          }),
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || 'Failed to upload');
        }

        const data = await response.json();
        markFileUploaded(fileName);
        return data;
      } finally {
        uploadingFilesRef.current.delete(fileName);
      }
    },
    onSuccess: (data) => {
      if (data.alreadyExists) {
        toast({ title: 'Already synced', description: 'This document has already been uploaded to Google Drive.' });
      } else {
        toast({ title: 'Uploaded to Google Drive', description: 'Document has been saved to your Google Drive.' });
      }
    },
    onError: (error: any) => {
      toast({ variant: 'destructive', title: 'Upload failed', description: error.message });
    },
  });

  const listDocuments = useCallback(async (documentType: 'invoice' | 'quotation') => {
    if (!session?.access_token) throw new Error('Not authenticated');

    const response = await fetch(FUNCTION_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        action: 'list_documents',
        documentType,
        businessName: business?.business_name || 'My Business',
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to list documents');
    }

    return await response.json();
  }, [session, business]);

  return {
    isConnected: connectionQuery.data?.connected ?? false,
    isLoading: connectionQuery.isLoading,
    isConnecting,
    connect,
    handleCallback,
    disconnect: disconnect.mutate,
    isDisconnecting: disconnect.isPending,
    uploadDocument: uploadDocument.mutateAsync,
    isUploading: uploadDocument.isPending,
    listDocuments,
  };
}