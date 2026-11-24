import React from 'react';
import { EditorTool } from '@/types/floorplan';

interface ToolbarProps {
  activeTool: EditorTool;
  onToolChange: (tool: EditorTool) => void;
  onDeleteSelected: () => void;
  hasSelection: boolean;
}

interface ToolConfig {
  id: EditorTool;
  label: string;
  category: 'edit' | 'spaces' | 'doors' | 'hardware';
  icon: React.ReactNode;
}

const tools: ToolConfig[] = [
  {
    id: 'select',
    label: 'Select / Move',
    category: 'edit',
    icon: (
      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 15l-5-5m0 0l-5-5m5 5l5 5M4 4l16 16" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3l7 7m0 0v6m0-6h6" />
      </svg>
    ),
  },
  {
    id: 'room',
    label: 'Add Shop / Room',
    category: 'spaces',
    icon: (
      <svg className="w-3.5 h-3.5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <rect x={3} y={3} width={18} height={18} rx={2} strokeWidth={2} />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v8M8 12h8" />
      </svg>
    ),
  },
  {
    id: 'corridor',
    label: 'Add Corridor',
    category: 'spaces',
    icon: (
      <svg className="w-3.5 h-3.5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16M8 4v16" />
      </svg>
    ),
  },
  {
    id: 'stairwell',
    label: 'Stairs / Staircase',
    category: 'spaces',
    icon: (
      <svg className="w-3.5 h-3.5 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 19h4v-4h4v-4h4V7h5" />
      </svg>
    ),
  },
  {
    id: 'elevator',
    label: 'Elevator / Lift',
    category: 'spaces',
    icon: (
      <svg className="w-3.5 h-3.5 text-cyan-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <rect x={4} y={3} width={16} height={18} rx={2} strokeWidth={2} />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10l4-4 4 4M8 14l4 4 4-4" />
      </svg>
    ),
  },
  {
    id: 'shop_door',
    label: 'Shop Entry / Door',
    category: 'doors',
    icon: (
      <svg className="w-3.5 h-3.5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12h18M3 6h18M3 18h18" />
      </svg>
    ),
  },
  {
    id: 'main_entry',
    label: 'Mall Main Entry/Exit',
    category: 'doors',
    icon: (
      <svg className="w-3.5 h-3.5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
      </svg>
    ),
  },
  {
    id: 'emergency_exit',
    label: 'Emergency Fire Exit',
    category: 'doors',
    icon: (
      <svg className="w-3.5 h-3.5 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16l4-4m0 0l-4-4m4 4H3m5 4v1a3 3 0 003 3h7a3 3 0 003-3V7a3 3 0 00-3-3h-7a3 3 0 00-3 3v1" />
      </svg>
    ),
  },
  {
    id: 'camera',
    label: 'CCTV Camera',
    category: 'hardware',
    icon: (
      <svg className="w-3.5 h-3.5 text-blue-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.069A1 1 0 0121 8.82v6.36a1 1 0 01-1.447.894L15 14M3 8h12a2 2 0 012 2v4a2 2 0 01-2 2H3a2 2 0 01-2-2v-4a2 2 0 012-2z" />
      </svg>
    ),
  },
  {
    id: 'delete',
    label: 'Delete Element',
    category: 'edit',
    icon: (
      <svg className="w-3.5 h-3.5 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
      </svg>
    ),
  },
];

export function EditorToolbar({ activeTool, onToolChange, onDeleteSelected, hasSelection }: ToolbarProps) {
  return (
    <div className="bg-white border border-slate-200/90 rounded-xl p-2 shadow-xs flex flex-col h-full justify-between select-none overflow-hidden">
      {/* Tools List */}
      <div className="flex-1 min-h-0 overflow-y-auto space-y-1 pr-0.5">
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2 pb-0.5">Mall Elements</p>
        {tools.map((tool) => {
          const isActive = activeTool === tool.id;
          const isDelete = tool.id === 'delete';

          return (
            <button
              key={tool.id}
              onClick={() => {
                if (isDelete && hasSelection) {
                  onDeleteSelected();
                } else {
                  onToolChange(tool.id);
                }
              }}
              title={tool.label}
              className={`
                flex items-center gap-2 px-2 py-1.5 rounded-lg text-left w-full transition-all text-[11px]
                ${
                  isActive
                    ? 'bg-blue-50 border border-blue-200 text-blue-700 font-semibold shadow-xs'
                    : isDelete
                    ? 'border border-transparent hover:bg-red-50 text-slate-600 hover:text-red-700'
                    : 'border border-transparent hover:bg-slate-100/70 text-slate-600 hover:text-slate-900'
                }
                ${isDelete ? 'mt-1.5 border-t border-slate-100 pt-1.5 text-red-600 font-medium' : ''}
              `}
            >
              <span className={`shrink-0 ${isActive ? 'text-blue-600' : 'text-slate-400'}`}>{tool.icon}</span>
              <span className="truncate leading-tight font-medium">{tool.label}</span>
            </button>
          );
        })}
      </div>

      {/* Compact Status Indicator at Bottom */}
      <div className="pt-2 border-t border-slate-100 text-[10px] text-slate-500 text-center shrink-0">
        Tool: <span className="font-bold text-blue-700 capitalize">{activeTool.replace('_', ' ')}</span>
      </div>
    </div>
  );
}
