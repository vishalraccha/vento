import { useState, useEffect } from 'react';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2 } from 'lucide-react';
import {
  LoginForm,
  SignUpForm,
  ForgotPasswordForm,
  ResetPasswordForm,
  OAuthButtons,
} from '@/components/auth';

type AuthView = 'login' | 'signup' | 'forgot' | 'reset';

const Auth = () => {
  const [searchParams] = useSearchParams();
  const mode = searchParams.get('mode');
  
  const [activeView, setActiveView] = useState<AuthView>(mode === 'reset' ? 'reset' : 'login');
  const [activeTab, setActiveTab] = useState<'login' | 'signup'>('login');

  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const from = (location.state as { from?: { pathname: string } })?.from?.pathname || '/';

  // Redirect if already authenticated (except for password reset)
  useEffect(() => {
    if (!loading && user && activeView !== 'reset') {
      navigate(from, { replace: true });
    }
  }, [user, loading, navigate, from, activeView]);

  // Sync tab with view
  useEffect(() => {
    if (activeView === 'login' || activeView === 'signup') {
      setActiveTab(activeView);
    }
  }, [activeView]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const handleTabChange = (value: string) => {
    setActiveTab(value as 'login' | 'signup');
    setActiveView(value as AuthView);
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-12">
      {/* Logo and Branding */}
      <div className="mb-8 text-center">
        <div className="mb-4 flex items-center justify-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary">
            <span className="text-3xl font-bold text-primary-foreground">V</span>
          </div>
        </div>
        <h1 className="text-3xl font-bold text-foreground">Vento</h1>
        <p className="mt-2 text-muted-foreground">Professional Invoice Management</p>
      </div>

      {/* Auth Card */}
      <Card className="w-full max-w-md shadow-lg">
        {activeView === 'forgot' ? (
          <>
            <CardHeader className="pb-4">
              <CardTitle className="text-center">Reset Password</CardTitle>
            </CardHeader>
            <ForgotPasswordForm onBack={() => setActiveView('login')} />
          </>
        ) : activeView === 'reset' ? (
          <>
            <CardHeader className="pb-4">
              <CardTitle className="text-center">Set New Password</CardTitle>
            </CardHeader>
            <ResetPasswordForm />
          </>
        ) : (
          <Tabs value={activeTab} onValueChange={handleTabChange}>
            <CardHeader className="pb-4">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="login">Sign In</TabsTrigger>
                <TabsTrigger value="signup">Sign Up</TabsTrigger>
              </TabsList>
            </CardHeader>

            <TabsContent value="login" className="mt-0">
              <LoginForm onForgotPassword={() => setActiveView('forgot')} />
              <div className="px-6 pb-6">
                <OAuthButtons />
              </div>
            </TabsContent>

            <TabsContent value="signup" className="mt-0">
              <SignUpForm onSuccess={() => setActiveView('login')} />
              <div className="px-6 pb-6">
                <OAuthButtons />
              </div>
            </TabsContent>
          </Tabs>
        )}
      </Card>

      {/* Footer */}
      <p className="mt-8 text-center text-sm text-muted-foreground">
        By continuing, you agree to our Terms of Service and Privacy Policy.
      </p>
    </div>
  );
};

export default Auth;
