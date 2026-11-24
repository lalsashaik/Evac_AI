import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth, mapFirebaseAuthError } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { ShieldAlert, Flame, Lock, Mail, Eye, EyeOff, Loader2, AlertCircle, ArrowRight } from 'lucide-react';

export const LoginPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const { login, user, role, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // If already logged in, redirect to respective dashboard
  useEffect(() => {
    if (!loading && user && role) {
      if (role === 'superadmin') {
        navigate('/superadmin', { replace: true });
      } else if (role === 'mall_management') {
        navigate('/management', { replace: true });
      }
    }
  }, [user, role, loading, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password) {
      setErrorMessage('Please provide both email and password.');
      return;
    }

    setIsSubmitting(true);
    try {
      const { role: userRole } = await login(trimmedEmail, password);

      const from = (location.state as any)?.from?.pathname;

      if (userRole === 'superadmin') {
        navigate(from || '/superadmin', { replace: true });
      } else if (userRole === 'mall_management') {
        navigate(from || '/management', { replace: true });
      } else {
        navigate('/', { replace: true });
      }
    } catch (err: any) {
      console.error('[LoginPage] Sign in failed:', err);
      const friendlyMsg = mapFirebaseAuthError(err.code || '');
      setErrorMessage(friendlyMsg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-100 flex flex-col justify-center items-center px-4 py-12 relative">
      {/* Brand Header */}
      <div className="text-center mb-8 relative z-10">
        <div className="inline-flex items-center justify-center p-3 bg-red-50 border border-red-100 rounded-2xl mb-3 shadow-xs">
          <ShieldAlert className="w-8 h-8 text-red-600 mr-2" />
          <Flame className="w-8 h-8 text-amber-500" />
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900 flex items-center justify-center gap-1.5">
          Evac<span className="text-red-600">AI</span>
        </h1>
        <p className="text-slate-500 text-sm mt-1 max-w-sm">
          Intelligent Fire &amp; Smoke Detection, CCTV Monitoring &amp; Emergency Safety Management
        </p>
      </div>

      {/* Main Login Card */}
      <Card className="w-full max-w-md bg-white border-slate-200/90 text-slate-800 shadow-xl rounded-2xl relative z-10">
        <CardHeader className="space-y-1 pb-4 border-b border-slate-100">
          <CardTitle className="text-xl font-bold text-slate-900">Sign In</CardTitle>
          <CardDescription className="text-slate-500 text-xs">
            Enter your credentials to access your safety operations portal
          </CardDescription>
        </CardHeader>

        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4 pt-6">
            {/* Error Message Alert */}
            {errorMessage && (
              <div className="flex items-start gap-2.5 p-3 text-xs text-red-700 bg-red-50 border border-red-200 rounded-xl animate-in fade-in duration-200">
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                <div className="leading-snug">{errorMessage}</div>
              </div>
            )}

            {/* Email Field */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5" htmlFor="email">
                <Mail className="w-3.5 h-3.5 text-slate-400" />
                Email Address
              </label>
              <Input
                id="email"
                type="email"
                placeholder="name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                className="bg-slate-50 border-slate-200 text-xs text-slate-900 focus:bg-white focus:border-blue-500 h-10 rounded-xl"
              />
            </div>

            {/* Password Field */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5" htmlFor="password">
                <Lock className="w-3.5 h-3.5 text-slate-400" />
                Password
              </label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  className="bg-slate-50 border-slate-200 text-xs text-slate-900 focus:bg-white focus:border-blue-500 h-10 rounded-xl pr-10"
                />
                <button
                  type="button"
                  tabIndex={-1}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs h-10 rounded-xl shadow-xs transition mt-2"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Authenticating…
                </>
              ) : (
                <>
                  Sign In
                  <ArrowRight className="w-4 h-4 ml-2" />
                </>
              )}
            </Button>
          </CardContent>
        </form>

        <CardFooter className="pt-2 pb-6 flex flex-col items-center justify-center border-t border-slate-100 text-xs text-slate-400 space-y-1">
          <p>Protected by Firebase Authentication &amp; Tenant RBAC</p>
          <p className="text-[11px] text-slate-400">EvacAI Platform v1.0.0</p>
        </CardFooter>
      </Card>
    </div>
  );
};
