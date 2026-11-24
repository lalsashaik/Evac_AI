import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth, UserRole } from '@/context/AuthContext';
import { Loader2 } from 'lucide-react';

interface ProtectedRouteProps {
  children: React.ReactElement;
  allowedRoles?: UserRole[];
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  allowedRoles,
}) => {
  const { user, role, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 text-slate-800">
        <Loader2 className="w-10 h-10 animate-spin text-blue-600 mb-4" />
        <p className="text-sm font-medium text-slate-600">Verifying security credentials...</p>
      </div>
    );
  }

  // Unauthenticated user -> redirect to /login
  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Check role restrictions
  if (allowedRoles && allowedRoles.length > 0) {
    if (!role || !allowedRoles.includes(role)) {
      // Authenticated but wrong role -> redirect to appropriate dashboard
      if (role === 'superadmin') {
        return <Navigate to="/superadmin" replace />;
      }
      if (role === 'mall_management') {
        return <Navigate to="/management" replace />;
      }
      // If user has no valid role assigned yet
      return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-4">
          <div className="max-w-md w-full bg-white rounded-xl shadow-lg border border-red-100 p-6 text-center">
            <h2 className="text-xl font-bold text-red-600 mb-2">Access Restricted</h2>
            <p className="text-sm text-slate-600 mb-6">
              Your account ({user.email}) does not have an assigned role on EvacAI. Please contact the platform superadmin.
            </p>
            <a
              href="/login"
              className="inline-block px-4 py-2 bg-slate-900 text-white rounded-lg text-sm font-medium hover:bg-slate-800 transition"
            >
              Back to Login
            </a>
          </div>
        </div>
      );
    }
  }

  return children;
};
