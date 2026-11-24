import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export interface SidebarItem {
  id: string;
  label: string;
  icon: React.ReactNode;
}

interface AppSidebarProps {
  items: SidebarItem[];
  activeId: string;
  onSelect: (id: string) => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}

export const AppSidebar: React.FC<AppSidebarProps> = ({
  items,
  activeId,
  onSelect,
  isCollapsed,
  onToggleCollapse,
}) => {
  return (
    <aside
      className={`bg-white border-r border-slate-200/90 flex flex-col transition-all duration-300 select-none shrink-0 z-20 h-full overflow-x-hidden ${
        isCollapsed ? 'w-16' : 'w-60'
      }`}
    >
      {/* Navigation items list without horizontal scrolling */}
      <nav className="flex-1 p-2.5 space-y-1.5 overflow-y-auto overflow-x-hidden">
        {items.map((item) => {
          const isActive = activeId === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onSelect(item.id)}
              title={isCollapsed ? item.label : undefined}
              className={`w-full flex items-center rounded-xl transition-all font-medium text-xs sm:text-sm group overflow-hidden ${
                isCollapsed ? 'justify-center p-2.5' : 'gap-3 px-3 py-2.5'
              } ${
                isActive
                  ? 'bg-blue-50 text-blue-700 font-semibold shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70'
              }`}
            >
              <span
                className={`shrink-0 transition-colors ${
                  isActive ? 'text-blue-600' : 'text-slate-400 group-hover:text-slate-600'
                }`}
              >
                {item.icon}
              </span>

              {/* Text wrapping for long menu names */}
              {!isCollapsed && (
                <span className="flex-1 text-left text-xs font-medium leading-snug whitespace-normal break-words">
                  {item.label}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Collapse / Expand Toggle Button */}
      <div className="p-2.5 border-t border-slate-100 shrink-0 overflow-hidden">
        <button
          onClick={onToggleCollapse}
          title={isCollapsed ? 'Expand sidebar' : 'Minimize sidebar'}
          className={`w-full flex items-center rounded-xl py-2 px-2 text-xs font-medium text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors overflow-hidden ${
            isCollapsed ? 'justify-center' : 'justify-between px-3'
          }`}
        >
          {!isCollapsed && <span className="text-xs text-slate-400">Collapse View</span>}
          {isCollapsed ? (
            <ChevronRight className="w-4 h-4 text-slate-500" />
          ) : (
            <ChevronLeft className="w-4 h-4 text-slate-500" />
          )}
        </button>
      </div>
    </aside>
  );
};
