import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const GOOGLE_CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID");
const GOOGLE_CLIENT_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

interface GoogleTokens {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
}

interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  webViewLink: string;
}

// Exchange authorization code for tokens
async function exchangeCodeForTokens(code: string, redirectUri: string): Promise<GoogleTokens> {
  console.log("Exchanging code for tokens...");
  
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: GOOGLE_CLIENT_ID!,
      client_secret: GOOGLE_CLIENT_SECRET!,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });
  console.log("Redirect URI:", redirectUri);
  

  if (!response.ok) {
    const error = await response.text();
    console.error("Token exchange failed:", error);
    throw new Error(`Token exchange failed: ${error}`);
  }

  return await response.json();
}

// Refresh access token using refresh token
async function refreshAccessToken(refreshToken: string): Promise<GoogleTokens> {
  console.log("Refreshing access token...");
  
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: GOOGLE_CLIENT_ID!,
      client_secret: GOOGLE_CLIENT_SECRET!,
      grant_type: "refresh_token",
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error("Token refresh failed:", error);
    throw new Error(`Token refresh failed: ${error}`);
  }

  return await response.json();
}

// Create folder in Google Drive
async function createFolder(accessToken: string, folderName: string, parentId?: string): Promise<DriveFile> {
  console.log(`Creating folder: ${folderName}`);
  
  const metadata: any = {
    name: folderName,
    mimeType: "application/vnd.google-apps.folder",
  };
  
  if (parentId) {
    metadata.parents = [parentId];
  }

  const response = await fetch("https://www.googleapis.com/drive/v3/files", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(metadata),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error("Create folder failed:", error);
    throw new Error(`Create folder failed: ${error}`);
  }

  return await response.json();
}

// Find folder by name
async function findFolder(accessToken: string, folderName: string, parentId?: string): Promise<DriveFile | null> {
  console.log(`Finding folder: ${folderName}`);
  
  let query = `name='${folderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;
  if (parentId) {
    query += ` and '${parentId}' in parents`;
  }

  const response = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name,mimeType,webViewLink)`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );

  if (!response.ok) {
    const error = await response.text();
    console.error("Find folder failed:", error);
    throw new Error(`Find folder failed: ${error}`);
  }

  const data = await response.json();
  return data.files?.[0] || null;
}

// Find file by name in a folder (to prevent duplicates)
async function findFileByName(accessToken: string, fileName: string, folderId: string): Promise<DriveFile | null> {
  console.log(`Finding file: ${fileName} in folder: ${folderId}`);
  
  const query = `name='${fileName}' and '${folderId}' in parents and trashed=false`;

  const response = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name,mimeType,webViewLink)`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );

  if (!response.ok) {
    const error = await response.text();
    console.error("Find file failed:", error);
    throw new Error(`Find file failed: ${error}`);
  }

  const data = await response.json();
  return data.files?.[0] || null;
}

// Get or create folder structure
async function getOrCreateFolderStructure(accessToken: string, businessName: string): Promise<{ rootId: string; invoicesId: string; quotationsId: string }> {
  // Find or create root Vento folder
  let rootFolder = await findFolder(accessToken, "Vento Documents");
  if (!rootFolder) {
    rootFolder = await createFolder(accessToken, "Vento Documents");
  }

  // Find or create business folder
  const safeName = businessName || "My Business";
  let businessFolder = await findFolder(accessToken, safeName, rootFolder.id);
  if (!businessFolder) {
    businessFolder = await createFolder(accessToken, safeName, rootFolder.id);
  }

  // Find or create Invoices folder
  let invoicesFolder = await findFolder(accessToken, "Invoices", businessFolder.id);
  if (!invoicesFolder) {
    invoicesFolder = await createFolder(accessToken, "Invoices", businessFolder.id);
  }

  // Find or create Quotations folder
  let quotationsFolder = await findFolder(accessToken, "Quotations", businessFolder.id);
  if (!quotationsFolder) {
    quotationsFolder = await createFolder(accessToken, "Quotations", businessFolder.id);
  }

  return {
    rootId: businessFolder.id,
    invoicesId: invoicesFolder.id,
    quotationsId: quotationsFolder.id,
  };
}

// Upload file to Google Drive
async function uploadFile(
  accessToken: string,
  fileName: string,
  fileContent: string, // Base64 encoded
  mimeType: string,
  folderId: string
): Promise<DriveFile> {
  console.log(`Uploading file: ${fileName} to folder: ${folderId}`);

  const metadata = {
    name: fileName,
    parents: [folderId],
  };

  // Decode base64 content
  Uint8Array.from(atob(fileContent), c => c.charCodeAt(0));

  // Create multipart upload
  const boundary = "-------314159265358979323846";
  const delimiter = "\r\n--" + boundary + "\r\n";
  const closeDelim = "\r\n--" + boundary + "--";

  const metadataStr = JSON.stringify(metadata);
  
  // Build multipart body manually
  const encoder = new TextEncoder();
  const metadataPart = encoder.encode(
    delimiter +
    "Content-Type: application/json; charset=UTF-8\r\n\r\n" +
    metadataStr +
    delimiter +
    `Content-Type: ${mimeType}\r\nContent-Transfer-Encoding: base64\r\n\r\n`
  );
  const filePart = encoder.encode(fileContent);
  const closePart = encoder.encode(closeDelim);

  // Combine parts
  const body = new Uint8Array(metadataPart.length + filePart.length + closePart.length);
  body.set(metadataPart, 0);
  body.set(filePart, metadataPart.length);
  body.set(closePart, metadataPart.length + filePart.length);

  const response = await fetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,mimeType,webViewLink",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": `multipart/related; boundary=${boundary}`,
      },
      body: body,
    }
  );

  if (!response.ok) {
    const error = await response.text();
    console.error("Upload failed:", error);
    throw new Error(`Upload failed: ${error}`);
  }

  return await response.json();
}

// List files in folder
async function listFiles(accessToken: string, folderId: string): Promise<DriveFile[]> {
  console.log(`Listing files in folder: ${folderId}`);

  const response = await fetch(
    `https://www.googleapis.com/drive/v3/files?q='${folderId}' in parents and trashed=false&fields=files(id,name,mimeType,webViewLink)&orderBy=createdTime desc`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );

  if (!response.ok) {
    const error = await response.text();
    console.error("List files failed:", error);
    throw new Error(`List files failed: ${error}`);
  }

  const data = await response.json();
  return data.files || [];
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify auth
   const { action, ...params } = await req.json();
console.log(`Action: ${action}`);

let userId: string | null = null;

// ✅ Only protect required actions
if (action !== "get_auth_url") {
  const authHeader = req.headers.get("Authorization");

  if (!authHeader?.startsWith("Bearer ")) {
    throw new Error("Missing authorization header");
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !SUPABASE_ANON_KEY) {
    throw new Error("Supabase environment is not configured");
  }

  const token = authHeader.replace("Bearer ", "").trim();

  const authSupabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: {
      headers: {
        Authorization: authHeader,
      },
    },
  });

  const { data: claimsData, error: authError } =
    await authSupabase.auth.getClaims(token);

  userId = claimsData?.claims?.sub;

  if (authError || !userId) {
    throw new Error("Unauthorized");
  }
}

// ✅ service role client (always available)
const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

    

    let result: any;

    switch (action) {
      case "exchange_code": {
        // Exchange OAuth code for tokens and store them
        const { code, redirectUri } = params;
        const tokens = await exchangeCodeForTokens(code, redirectUri);
        
        // Store tokens in database
        const { error: upsertError } = await supabase
          .from("google_drive_tokens")
          .upsert({
            user_id: userId,
            access_token: tokens.access_token,
            refresh_token: tokens.refresh_token,
            expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
          }, { onConflict: "user_id" });

        if (upsertError) {
          console.error("Failed to store tokens:", upsertError);
          throw new Error("Failed to store tokens");
        }

        result = { success: true };
        break;
      }

      case "check_connection": {
        // Check if user has valid Google Drive connection
        const { data: tokenData } = await supabase
          .from("google_drive_tokens")
          .select("*")
          .eq("user_id", userId)
          .single();

        if (!tokenData) {
          result = { connected: false };
          break;
        }

        // Check if token is expired
        const expiresAt = new Date(tokenData.expires_at);
        if (expiresAt <= new Date()) {
          // Try to refresh
          try {
            const newTokens = await refreshAccessToken(tokenData.refresh_token);
            await supabase
              .from("google_drive_tokens")
              .update({
                access_token: newTokens.access_token,
                expires_at: new Date(Date.now() + newTokens.expires_in * 1000).toISOString(),
              })
              .eq("user_id", userId);
            
            result = { connected: true };
          } catch {
            result = { connected: false };
          }
        } else {
          result = { connected: true };
        }
        break;
      }

      case "disconnect": {
        // Remove tokens from database
        await supabase
          .from("google_drive_tokens")
          .delete()
          .eq("user_id", userId);
        
        result = { success: true };
        break;
      }

      case "upload_document": {
        // Upload a document to Google Drive
        const { fileName, fileContent, documentType, businessName } = params;
        
        // Get tokens
        const { data: tokenData } = await supabase
          .from("google_drive_tokens")
          .select("*")
          .eq("user_id", userId)
          .single();

        if (!tokenData) {
          throw new Error("Google Drive not connected");
        }

        // Refresh token if needed
        let accessToken = tokenData.access_token;
        const expiresAt = new Date(tokenData.expires_at);
        if (expiresAt <= new Date()) {
          const newTokens = await refreshAccessToken(tokenData.refresh_token);
          accessToken = newTokens.access_token;
          await supabase
            .from("google_drive_tokens")
            .update({
              access_token: newTokens.access_token,
              expires_at: new Date(Date.now() + newTokens.expires_in * 1000).toISOString(),
            })
            .eq("user_id", userId);
        }

        // Get or create folder structure
        const folders = await getOrCreateFolderStructure(accessToken, businessName);
        
        // Determine target folder
        const targetFolderId = documentType === "invoice" ? folders.invoicesId : folders.quotationsId;

        // Check if file with same name already exists (prevent duplicates)
        const existingFile = await findFileByName(accessToken, fileName, targetFolderId);
        if (existingFile) {
          console.log(`File ${fileName} already exists in Google Drive, skipping upload`);
          result = {
            success: true,
            file: existingFile,
            alreadyExists: true,
            message: "Document already synced to Google Drive",
          };
          break;
        }

        // Upload file
        const uploadedFile = await uploadFile(
          accessToken,
          fileName,
          fileContent,
          "application/pdf",
          targetFolderId
        );

        result = {
          success: true,
          file: uploadedFile,
          alreadyExists: false,
        };
        break;
      }

      case "list_documents": {
        // List documents from Google Drive
        const { documentType, businessName } = params;
        
        // Get tokens
        const { data: tokenData } = await supabase
          .from("google_drive_tokens")
          .select("*")
          .eq("user_id", userId)
          .single();

        if (!tokenData) {
          throw new Error("Google Drive not connected");
        }

        // Refresh token if needed
        let accessToken = tokenData.access_token;
        const expiresAt = new Date(tokenData.expires_at);
        if (expiresAt <= new Date()) {
          const newTokens = await refreshAccessToken(tokenData.refresh_token);
          accessToken = newTokens.access_token;
          await supabase
            .from("google_drive_tokens")
            .update({
              access_token: newTokens.access_token,
              expires_at: new Date(Date.now() + newTokens.expires_in * 1000).toISOString(),
            })
            .eq("user_id", userId);
        }

        // Get folder structure
        const folders = await getOrCreateFolderStructure(accessToken, businessName);
        
        // List files from appropriate folder
        const folderId = documentType === "invoice" ? folders.invoicesId : folders.quotationsId;
        const files = await listFiles(accessToken, folderId);

        result = { files };
        break;
      }

      case "get_auth_url": {
        // Generate Google OAuth URL
        const { redirectUri } = params;
        const scopes = [
          "https://www.googleapis.com/auth/drive.file",
        ];
        
        const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
        authUrl.searchParams.set("client_id", GOOGLE_CLIENT_ID!);
        authUrl.searchParams.set("redirect_uri", redirectUri);
        authUrl.searchParams.set("response_type", "code");
        authUrl.searchParams.set("scope", scopes.join(" "));
        authUrl.searchParams.set("access_type", "offline");
        authUrl.searchParams.set("prompt", "consent");

        result = { authUrl: authUrl.toString() };
        break;
      }

      default:
        throw new Error(`Unknown action: ${action}`);
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Error:", error);
    const status = error?.message === "Unauthorized" || error?.message === "Missing authorization header" ? 401 : 400;

    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
