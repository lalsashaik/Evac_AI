import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import {
  type User,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  type IdTokenResult,
} from 'firebase/auth';
import { auth } from '@/lib/firebase';

export type UserRole = 'superadmin' | 'mall_management';

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  role: UserRole | string;
  mallId: string | null;
  mallName?: string | null;
  isActive: boolean;
}

interface AuthContextType {
  user: User | null;
  role: UserRole | null;
  mallId: string | null;
  mallName: string | null;
  mallInfo: any | null;
  profile: UserProfile | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<{ role: UserRole | null; mallId: string | null }>;
  logout: () => Promise<void>;
  getToken: (forceRefresh?: boolean) => Promise<string | null>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000';

export function mapFirebaseAuthError(errorCode: string): string {
  switch (errorCode) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'Invalid email or password. Please verify your credentials.';
    case 'auth/invalid-email':
      return 'Please enter a valid email address.';
    case 'auth/user-disabled':
      return 'This user account has been disabled. Contact platform administrator.';
    case 'auth/too-many-requests':
      return 'Too many failed login attempts. Access temporarily restricted. Try again later.';
    case 'auth/network-request-failed':
      return 'Network connection issue. Please check your internet connection.';
    default:
      return 'Authentication failed. Please check your credentials and try again.';
  }
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<UserRole | null>(null);
  const [mallId, setMallId] = useState<string | null>(null);
  const [mallName, setMallName] = useState<string | null>(null);
  const [mallInfo, setMallInfo] = useState<any | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  // Sync profile & claims with backend
  const syncUserIdentity = useCallback(async (firebaseUser: User, tokenResult?: IdTokenResult) => {
    try {
      const claims = tokenResult?.claims || (await firebaseUser.getIdTokenResult()).claims;
      const userRole = (claims.role as UserRole) || null;
      const userMallId = (claims.mallId as string) || null;

      setRole(userRole);
      setMallId(userMallId);

      // Attempt to retrieve complete profile from backend
      const token = await firebaseUser.getIdToken();
      const res = await fetch(`${API_BASE_URL}/api/auth/me`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          setProfile(json.data);
          if (json.data.role && !userRole) {
            setRole(json.data.role as UserRole);
          }
          if (json.data.mallId && !userMallId) {
            setMallId(json.data.mallId);
          }
          if (json.data.mallName) {
            setMallName(json.data.mallName);
          }
          if (json.data.mallInfo) {
            setMallInfo(json.data.mallInfo);
            if (json.data.mallInfo.name) {
              setMallName(json.data.mallInfo.name);
            }
          }
        }
      }
    } catch (err) {
      console.warn('[AuthContext] Backend profile sync note:', err);
    }
  }, []);

  // Listen to Firebase Auth state changes
  useEffect(() => {
    if (!auth) {
      console.warn('[AuthContext] Firebase auth is not configured.');
      setLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setLoading(true);
      if (firebaseUser) {
        setUser(firebaseUser);
        const tokenResult = await firebaseUser.getIdTokenResult();
        await syncUserIdentity(firebaseUser, tokenResult);
      } else {
        setUser(null);
        setRole(null);
        setMallId(null);
        setMallName(null);
        setMallInfo(null);
        setProfile(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [syncUserIdentity]);

  // Login handler
  const login = async (email: string, password: string) => {
    if (!auth) {
      throw new Error('Firebase authentication is not configured.');
    }

    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const firebaseUser = userCredential.user;

    // Force refresh token to ensure newest custom claims are received
    const tokenResult = await firebaseUser.getIdTokenResult(true);
    const userRole = (tokenResult.claims.role as UserRole) || null;
    const userMallId = (tokenResult.claims.mallId as string) || null;

    setUser(firebaseUser);
    setRole(userRole);
    setMallId(userMallId);

    await syncUserIdentity(firebaseUser, tokenResult);

    return { role: userRole, mallId: userMallId };
  };

  // Logout handler
  const logout = useCallback(async () => {
    if (auth) {
      await signOut(auth);
    }
    setUser(null);
    setRole(null);
    setMallId(null);
    setMallName(null);
    setMallInfo(null);
    setProfile(null);
  }, []);

  // Helper to obtain fresh or existing ID token
  const getToken = useCallback(async (forceRefresh = false): Promise<string | null> => {
    if (!auth?.currentUser) return null;
    return auth.currentUser.getIdToken(forceRefresh);
  }, []);

  // Manually refresh profile
  const refreshProfile = useCallback(async () => {
    if (user) {
      const tokenResult = await user.getIdTokenResult(true);
      await syncUserIdentity(user, tokenResult);
    }
  }, [user, syncUserIdentity]);

  return (
    <AuthContext.Provider
      value={{
        user,
        role,
        mallId,
        mallName,
        mallInfo,
        profile,
        loading,
        login,
        logout,
        getToken,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
