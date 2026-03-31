import { serve } from "https://deno.land/std/http/server.ts";

const CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID")!;
const CLIENT_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET")!;
const REDIRECT_URI = "https://qkbibprgxcmlgyspthha.supabase.co/functions/v1/google-oauth";

serve(async (req) => {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");

  // STEP 1: Redirect to Google
  if (!code) {
    const authUrl =
      `https://accounts.google.com/o/oauth2/v2/auth` +
      `?client_id=${CLIENT_ID}` +
      `&redirect_uri=${REDIRECT_URI}` +
      `&response_type=code` +
      `&scope=https://www.googleapis.com/auth/drive.file` +
      `&access_type=offline&prompt=consent`;

    return Response.redirect(authUrl);
  }

  // STEP 2: Exchange code for token
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      code,
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      redirect_uri: REDIRECT_URI,
      grant_type: "authorization_code",
    }),
  });

  const tokens = await tokenRes.json();

  return Response.redirect(
  `https://vento-three.vercel.app/dashboard?access_token=${tokens.access_token}`
);
});