import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { LogOut, ChevronDown, User, Mail, Shield, Building2 } from 'lucide-react';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000';

export function getInitials(name?: string | null, email?: string | null): string {
  if (name && name.trim()) {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  }
  if (email && email.trim()) {
    const localPart = email.split('@')[0];
    return localPart.slice(0, 2).toUpperCase();
  }
  return 'U';
}

export const UserDropdown: React.FC = () => {
  const { user, profile, role, mallId, mallName, mallInfo, getToken, logout } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [resolvedMallName, setResolvedMallName] = useState<string | null>(
    mallName || mallInfo?.name || profile?.mallName || null
  );
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const knownName = mallName || mallInfo?.name || profile?.mallName;
    if (knownName) {
      setResolvedMallName(knownName);
      return;
    }
    if (mallId) {
      getToken().then((token) => {
        if (!token) return;
        fetch(`${API_BASE_URL}/api/malls/${mallId}/info`, {
          headers: { Authorization: `Bearer ${token}` },
        })
          .then((res) => res.json())
          .then((json) => {
            if (json.success && json.data?.name) {
              setResolvedMallName(json.data.name);
            }
          })
          .catch(() => {});
      });
    }
  }, [mallId, mallName, mallInfo, profile?.mallName, getToken]);

  const displayName = profile?.displayName || user?.displayName || (user?.email ? user.email.split('@')[0] : 'User');
  const email = user?.email || '';
  const initials = getInitials(displayName, email);

  // Close when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Close on Escape key
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Trigger Button: Avatar + Display Name + Chevron */}
      <button
        onClick={() => setIsOpen((prev) => !prev)}
        className="flex items-center gap-2.5 px-2 py-1.5 rounded-full hover:bg-slate-100 transition-colors border border-transparent hover:border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
        aria-expanded={isOpen}
        aria-haspopup="true"
      >
        {/* Avatar with initial alphabets */}
        <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 text-white font-semibold text-xs flex items-center justify-center shadow-sm tracking-wider select-none">
          {initials}
        </div>

        {/* Display name */}
        <span className="text-sm font-medium text-slate-700 max-w-[140px] truncate select-none hidden sm:inline">
          {displayName}
        </span>

        {/* Dropdown chevron */}
        <ChevronDown
          className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-64 bg-white rounded-xl shadow-xl border border-slate-200/90 py-2 z-50 animate-in fade-in zoom-in-95 duration-150">
          {/* Header section with details */}
          <div className="px-4 py-3 border-b border-slate-100 flex items-start gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-50 border border-blue-200 text-blue-700 font-bold text-sm flex items-center justify-center shrink-0">
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-slate-800 truncate" title={displayName}>
                {displayName}
              </p>
              <p className="text-xs text-slate-500 truncate flex items-center gap-1 mt-0.5" title={email}>
                <Mail className="w-3 h-3 shrink-0 text-slate-400" />
                {email}
              </p>
            </div>
          </div>

          {/* Role & Mall Info Badge */}
          <div className="px-4 py-2 bg-slate-50/70 border-b border-slate-100 text-xs flex items-center justify-between">
            <span className="text-slate-500 font-medium flex items-center gap-1">
              <Shield className="w-3.5 h-3.5 text-blue-600" />
              Role:
            </span>
            <span className="font-semibold text-blue-700 bg-blue-100/70 px-2 py-0.5 rounded-full capitalize">
              {role === 'superadmin' ? 'Superadmin' : 'Mall Management'}
            </span>
          </div>

          {mallId && (
            <div className="px-4 py-2 border-b border-slate-100 text-xs">
              <span className="text-slate-500 font-medium flex items-center gap-1 mb-1">
                <Building2 className="w-3.5 h-3.5 text-blue-600" />
                Assigned Mall:
              </span>
              <p className="font-semibold text-xs text-slate-800 bg-slate-50 border border-slate-200/80 px-2.5 py-1.5 rounded-lg truncate" title={resolvedMallName || mallName || mallInfo?.name || mallId}>
                {resolvedMallName || mallName || mallInfo?.name || mallId}
              </p>
            </div>
          )}

          {/* Sign Out Button */}
          <div className="px-2 pt-2">
            <button
              onClick={async () => {
                setIsOpen(false);
                await logout();
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 hover:text-red-700 rounded-lg transition-colors"
            >
              <LogOut className="w-4 h-4" />
              Sign Out
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
