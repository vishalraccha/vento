// src/pages/AuthCallback.tsx
import { useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useGoogleDrive } from '@/hooks/useGoogleDrive';

export default function AuthCallback() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { handleCallback } = useGoogleDrive();
  const handled = useRef(false); // prevent double-run in React strict mode

  useEffect(() => {
    if (handled.current) return;
    handled.current = true;

    const code = searchParams.get('code');

    if (code) {
      // ✅ Google Drive OAuth callback
      handleCallback(code).then(() => navigate('/documents', { replace: true }));
    } else {
      // Normal Supabase auth callback (email/password login)
      navigate('/', { replace: true });
    }
  }, []);

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
      <p>Connecting to Google Drive...</p>
    </div>
  );
}