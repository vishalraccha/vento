import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const GOOGLE_CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID");
const GOOGLE_CLIENT_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

// 🔹 Exchange code for tokens
async function exchangeCodeForTokens(code: string, redirectUri: string) {
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

  if (!response.ok) {
    throw new Error("Token exchange failed");
  }

  return await response.json();
}

serve(async (req) => {
  // ✅ CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { action, ...params } = await req.json();

    let userId: string | null = null;

    // ✅ Only protect sensitive actions
    if (action !== "get_auth_url") {
      const authHeader = req.headers.get("Authorization");

      if (!authHeader?.startsWith("Bearer ")) {
        throw new Error("Missing authorization header");
      }

      const token = authHeader.replace("Bearer ", "");

      const supabaseAuth = createClient(
        SUPABASE_URL!,
        SUPABASE_ANON_KEY!,
        {
          global: {
            headers: { Authorization: authHeader },
          },
        }
      );

      const { data, error } = await supabaseAuth.auth.getUser(token);

      if (error || !data.user) {
        throw new Error("Unauthorized");
      }

      userId = data.user.id;
    }

    let result: any;

    // ==============================
    // 🔥 ROUTES
    // ==============================

    switch (action) {
      // 🚀 STEP 1: GET GOOGLE AUTH URL
      case "get_auth_url": {
        const { redirectUri } = params;

        const authUrl =
          `https://accounts.google.com/o/oauth2/v2/auth` +
          `?client_id=${GOOGLE_CLIENT_ID}` +
          `&redirect_uri=${redirectUri}` +
          `&response_type=code` +
          `&scope=https://www.googleapis.com/auth/drive.file` +
          `&access_type=offline&prompt=consent`;

        result = { authUrl };
        break;
      }

      // 🚀 STEP 2: EXCHANGE CODE
      case "exchange_code": {
        const { code, redirectUri } = params;

        const tokens = await exchangeCodeForTokens(code, redirectUri);

        const supabase = createClient(
          SUPABASE_URL!,
          SUPABASE_SERVICE_ROLE_KEY!
        );

        await supabase.from("google_drive_tokens").upsert({
          user_id: userId,
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token,
          expires_at: new Date(
            Date.now() + tokens.expires_in * 1000
          ).toISOString(),
        });

        result = { success: true };
        break;
      }

      // 🔍 CHECK CONNECTION
      case "check_connection": {
        const supabase = createClient(
          SUPABASE_URL!,
          SUPABASE_SERVICE_ROLE_KEY!
        );

        const { data } = await supabase
          .from("google_drive_tokens")
          .select("*")
          .eq("user_id", userId)
          .single();

        result = { connected: !!data };
        break;
      }

      // ❌ DISCONNECT
      case "disconnect": {
        const supabase = createClient(
          SUPABASE_URL!,
          SUPABASE_SERVICE_ROLE_KEY!
        );

        await supabase
          .from("google_drive_tokens")
          .delete()
          .eq("user_id", userId);

        result = { success: true };
        break;
      }

      default:
        throw new Error("Invalid action");
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});