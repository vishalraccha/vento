import { serve } from "https://deno.land/std/http/server.ts";

const CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID")!;
const REDIRECT_URI = 
  Deno.env.get("SUPABASE_URL") 
    ? `${Deno.env.get("SUPABASE_URL")}/functions/v1/google-oauth` 
    : "https://fvhjvphazrpanoqmsqvv.supabase.co/functions/v1/google-oauth";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

serve(async (req) => {
  // ── CORS preflight ──────────────────────────────────────────────────────
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const code = url.searchParams.get("code");

  // ── GET with ?code= → Google redirecting back after user approves ───────
  // Redirect user to your frontend app so handleCallback() can pick up ?code=
  if (req.method === "GET" && code) {
    // Extract frontend origin from the state parameter (passed during auth URL generation)
    const state = url.searchParams.get("state");
    let frontendOrigin = "http://localhost:8080";
    if (state) {
      try {
        const decoded = JSON.parse(atob(state));
        if (decoded.origin) frontendOrigin = decoded.origin;
      } catch {
        // fallback to default
      }
    }
    const frontendUrl = `${frontendOrigin}/documents?code=${code}`;
    return new Response(null, {
      status: 302,
      headers: {
        ...corsHeaders,
        "Location": frontendUrl,
      },
    });
  }

  // ── POST → frontend wants the Google auth URL (never redirect, return JSON) 
  if (req.method === "POST") {
    let frontendOrigin = "http://localhost:8080";
    try {
      const body = await req.json();
      if (body.frontendOrigin) frontendOrigin = body.frontendOrigin;
    } catch {
      // ignore parse errors
    }

    // Encode the frontend origin in the state parameter so we can redirect back correctly
    const state = btoa(JSON.stringify({ origin: frontendOrigin }));

    const authUrl =
      `https://accounts.google.com/o/oauth2/v2/auth` +
      `?client_id=${encodeURIComponent(CLIENT_ID)}` +
      `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
      `&response_type=code` +
      `&scope=${encodeURIComponent("https://www.googleapis.com/auth/drive.file")}` +
      `&access_type=offline` +
      `&prompt=consent` +
      `&state=${encodeURIComponent(state)}`;

    return new Response(JSON.stringify({ authUrl }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return new Response("Not found", { status: 404, headers: corsHeaders });
});