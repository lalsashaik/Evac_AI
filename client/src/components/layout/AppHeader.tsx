import React from 'react';
import { ShieldAlert, Flame } from 'lucide-react';
import { UserDropdown } from './UserDropdown';

export const AppHeader: React.FC = () => {
  return (
    <header className="h-16 bg-white border-b border-slate-200/90 sticky top-0 z-30 px-4 sm:px-6 flex items-center justify-between shadow-xs">
      {/* Left side: Logo & Title ONLY */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-red-600 to-rose-500 text-white flex items-center justify-center shadow-sm">
          <ShieldAlert className="w-5 h-5" />
        </div>
        <div className="flex items-baseline">
          <span className="text-xl font-bold tracking-tight text-slate-900">
            Evac<span className="text-red-600">AI</span>
          </span>
        </div>
      </div>

      {/* Right side: Avatar with initials, Display Name, and Dropdown */}
      <div className="flex items-center">
        <UserDropdown />
      </div>
    </header>
  );
};
