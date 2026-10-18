import { useState, useCallback, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useBusiness } from "./useBusiness";

const SUPABASE_BASE_URL = 
  import.meta.env.VITE_SUPABASE_URL || "https://fvhjvphazrpanoqmsqvv.supabase.co";
const OAUTH_FUNCTION_URL = `${SUPABASE_BASE_URL}/functions/v1/google-oauth`;
const DRIVE_FUNCTION_URL = `${SUPABASE_BASE_URL}/functions/v1/google-drive`;
const SUPABASE_ANON_KEY = 
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ2aGp2cGhhenJwYW5vcW1zcXZ2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMyMjQ4MjksImV4cCI6MjA4ODgwMDgyOX0.A9eu28EbxERdoUw1t-F3n_mjsO5TpOzoU7SCYT3696A";

const getRedirectUri = () => OAUTH_FUNCTION_URL;

// ── Shared header helpers ─────────────────────────────────────────────────────

const publicHeaders = {
  "Content-Type": "application/json",
  "apikey": SUPABASE_ANON_KEY,
};

const authHeaders = (token: string) => ({
  "Content-Type": "application/json",
  "apikey": SUPABASE_ANON_KEY,
  "Authorization": `Bearer ${token}`,
});

// ── Local cache helpers ───────────────────────────────────────────────────────

function getUploadedFiles(): Set<string> {
  try {
    const stored = localStorage.getItem("vento_uploaded_drive_files");
    return new Set(stored ? JSON.parse(stored) : []);
  } catch {
    return new Set();
  }
}

function markFileUploaded(fileName: string) {
  const files = getUploadedFiles();
  files.add(fileName);
  localStorage.setItem("vento_uploaded_drive_files", JSON.stringify([...files]));
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useGoogleDrive() {
  const { user, session } = useAuth();
  const { toast } = useToast();
  const { business } = useBusiness();
  const queryClient = useQueryClient();
  const [isConnecting, setIsConnecting] = useState(false);
  const uploadingFilesRef = useRef<Set<string>>(new Set());

  // ── Check connection status ─────────────────────────────────────────────
  const connectionQuery = useQuery({
    queryKey: ["google-drive-connection", user?.id],
    queryFn: async () => {
      if (!session?.access_token) return { connected: false };

      const response = await fetch(DRIVE_FUNCTION_URL, {
        method: "POST",
        headers: authHeaders(session.access_token),
        body: JSON.stringify({ action: "check_connection" }),
      });

      if (!response.ok) {
        console.error("Check connection error:", await response.text());
        return { connected: false };
      }

      return await response.json();
    },
    enabled: !!session?.access_token,
    retry: false,
    staleTime: 1000 * 60 * 5,
  });

  // ── Connect — get Google OAuth URL ─────────────────────────────────────
 const connect = useCallback(async () => {
  if (!session?.access_token) {
    toast({ variant: "destructive", title: "Not logged in" });
    return;
  }

  setIsConnecting(true);

  try {
    const redirectUri = getRedirectUri();

    const response = await fetch(OAUTH_FUNCTION_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": SUPABASE_ANON_KEY,
        "Authorization": `Bearer ${session.access_token}`, // ← send both
      },
      body: JSON.stringify({ redirectUri, frontendOrigin: window.location.origin }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error("get_auth_url error:", err);
      throw new Error("Failed to get auth URL");
    }

    const { authUrl } = await response.json();
    localStorage.setItem("google_drive_redirect_uri", redirectUri);
    window.location.href = authUrl;
  } catch (error: any) {
    console.error("Connect error:", error);
    toast({ variant: "destructive", title: "Connection failed", description: error.message });
    setIsConnecting(false);
  }
}, [session, toast]);

const inFlightCodes = new Set<string>();
const handledCodes = new Set<string>();

  // ── Handle OAuth callback — exchange code for tokens ───────────────────
  const handleCallback = useCallback(
    async (code: string) => {
      if (!session?.access_token || !user?.id) return false;
      if (!code || inFlightCodes.has(code) || handledCodes.has(code)) {
        return true;
      }

      inFlightCodes.add(code);

      try {
        const redirectUri =
          localStorage.getItem("google_drive_redirect_uri") || getRedirectUri();

        const response = await fetch(DRIVE_FUNCTION_URL, {
          method: "POST",
          headers: authHeaders(session.access_token),
          body: JSON.stringify({
            action: "exchange_code",
            code,
            redirectUri,
            userId: user.id,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          const errMsg = errorData.error || "";

          // If it's invalid_grant, check if user is already connected
          if (errMsg.includes("invalid_grant")) {
            // Already connected or code already used
            queryClient.invalidateQueries({ queryKey: ["google-drive-connection"] });
            handledCodes.add(code);
            return true;
          }

          throw new Error(errMsg || "Failed to exchange code");
        }

        handledCodes.add(code);
        localStorage.removeItem("google_drive_redirect_uri");
        queryClient.invalidateQueries({ queryKey: ["google-drive-connection"] });

        toast({
          title: "Connected!",
          description: "Google Drive has been connected successfully.",
        });

        return true;
      } catch (error: any) {
        console.error("Callback error:", error);
        toast({
          variant: "destructive",
          title: "Connection failed",
          description: error.message || "Failed to complete Google Drive connection.",
        });
        return false;
      } finally {
        inFlightCodes.delete(code);
      }
    },
    [session, user, toast, queryClient],
  );

  // ── Disconnect ──────────────────────────────────────────────────────────
  const disconnect = useMutation({
    mutationFn: async () => {
      if (!session?.access_token) throw new Error("Not authenticated");

      const response = await fetch(DRIVE_FUNCTION_URL, {
        method: "POST",
        headers: authHeaders(session.access_token),
        body: JSON.stringify({ action: "disconnect" }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to disconnect");
      }

      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["google-drive-connection"] });
      toast({ title: "Disconnected", description: "Google Drive has been disconnected." });
    },
    onError: (error: any) => {
      toast({ variant: "destructive", title: "Disconnect failed", description: error.message });
    },
  });

  // ── Upload document ─────────────────────────────────────────────────────
  const uploadDocument = useMutation({
    mutationFn: async ({
      fileName,
      fileContent,
      documentType,
    }: {
      fileName: string;
      fileContent: string;
      documentType: "invoice" | "quotation";
    }) => {
      if (!session?.access_token) throw new Error("Not authenticated");

      // Prevent duplicate in-flight uploads
      if (uploadingFilesRef.current.has(fileName)) {
        return { success: true, alreadyExists: true, message: "Upload already in progress" };
      }

      // Prevent re-uploading already synced files
      if (getUploadedFiles().has(fileName)) {
        return { success: true, alreadyExists: true, message: "Document already synced to Google Drive" };
      }

      uploadingFilesRef.current.add(fileName);

      try {
        const response = await fetch(DRIVE_FUNCTION_URL, {
          method: "POST",
          headers: authHeaders(session.access_token),
          body: JSON.stringify({
            action: "upload_document",
            fileName,
            fileContent,
            documentType,
            businessName: business?.business_name || "My Business",
          }),
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || "Failed to upload");
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
        toast({ title: "Already synced", description: "This document has already been uploaded to Google Drive." });
      } else {
        toast({ title: "Uploaded to Google Drive", description: "Document has been saved to your Google Drive." });
      }
    },
    onError: (error: any) => {
      toast({ variant: "destructive", title: "Upload failed", description: error.message });
    },
  });

  // ── List documents ──────────────────────────────────────────────────────
  const listDocuments = useCallback(
    async (documentType: "invoice" | "quotation") => {
      if (!session?.access_token) throw new Error("Not authenticated");

      const response = await fetch(DRIVE_FUNCTION_URL, {
        method: "POST",
        headers: authHeaders(session.access_token),
        body: JSON.stringify({
          action: "list_documents",
          documentType,
          businessName: business?.business_name || "My Business",
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to list documents");
      }

      return await response.json();
    },
    [session, business],
  );

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