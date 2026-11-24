import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { useAuth } from '@/context/AuthContext';
import { FloorPlanCanvas } from '@/components/floorplan/FloorPlanCanvas';
import { PropertiesPanel } from '@/components/floorplan/PropertiesPanel';
import { EditorToolbar } from '@/components/floorplan/EditorToolbar';
import {
  FloorPlan,
  FloorRoom,
  FloorDoor,
  FloorCameraMarker,
  SelectedElement,
  EditorTool,
} from '@/types/floorplan';
import { Save, AlertCircle, RefreshCw, Layers } from 'lucide-react';
import { CctvPlayerModal } from '@/components/camera/CctvPlayerModal';
import { CameraRecord } from '@/types/camera';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000';

type SaveState = 'idle' | 'saving' | 'saved' | 'error';

interface FloorPlanEditorProps {
  totalFloors?: number;
}

function emptyFloorPlan(floorId = 'floor_1', floorNumber = 1, floorName = 'Ground Floor'): FloorPlan {
  return {
    floorId,
    floorName,
    floorNumber,
    canvasWidth: 1000,
    canvasHeight: 660,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    rooms: {},
    doors: {},
    cameras: {},
  };
}

function getOrdinalSuffix(n: number): string {
  if (n === 1) return 'st';
  if (n === 2) return 'nd';
  if (n === 3) return 'rd';
  return 'th';
}

function getFloorDisplayName(num: number): string {
  if (num === 1) return 'Ground Floor';
  const ordinal = num - 1;
  return `${ordinal}${getOrdinalSuffix(ordinal)} Floor (G+${ordinal})`;
}

export function FloorPlanEditor({ totalFloors = 1 }: FloorPlanEditorProps) {
  const { mallId, getToken } = useAuth();

  const floorCount = Math.max(1, Math.min(10, totalFloors || 1));
  const availableFloors = useMemo(() => {
    return Array.from({ length: floorCount }, (_, i) => {
      const num = i + 1;
      return {
        id: `floor_${num}`,
        number: num,
        name: getFloorDisplayName(num),
      };
    });
  }, [floorCount]);

  const [selectedFloorId, setSelectedFloorId] = useState<string>('floor_1');
  const [floorPlan, setFloorPlan] = useState<FloorPlan>(emptyFloorPlan('floor_1', 1, 'Ground Floor'));
  const [selectedElement, setSelectedElement] = useState<SelectedElement>(null);
  const [activeTool, setActiveTool] = useState<EditorTool>('select');
  const [loadState, setLoadState] = useState<'loading' | 'loaded' | 'empty' | 'error'>('loading');
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [saveError, setSaveError] = useState<string | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [viewingCameraForFeed, setViewingCameraForFeed] = useState<CameraRecord | null>(null);

  const handleViewCameraFeed = useCallback(async (camMarker: FloorCameraMarker) => {
    if (!mallId) return;

    try {
      const token = await getToken();
      if (token) {
        const res = await fetch(`${API_BASE_URL}/api/malls/${mallId}/cameras/${camMarker.cameraId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const json = await res.json();
          if (json.success && json.data) {
            setViewingCameraForFeed(json.data);
            return;
          }
        }
      }
    } catch (err) {
      console.warn('[FloorPlanEditor] Could not fetch camera details, falling back:', err);
    }

    // Fallback if freshly created or not saved yet
    setViewingCameraForFeed({
      cameraId: camMarker.cameraId,
      mallId: mallId || '',
      name: camMarker.name || 'Floor Plan Camera',
      floorId: selectedFloorId,
      streamType: 'simulated',
      streamUrl: '/videos/cctv_entrance_sample.mp4',
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      floorName: floorPlan.floorName,
      x: camMarker.x,
      y: camMarker.y,
      rotation: camMarker.rotation,
      health: {
        cameraId: camMarker.cameraId,
        status: 'online',
        updatedAt: new Date().toISOString(),
      },
    });
  }, [mallId, getToken, selectedFloorId, floorPlan.floorName]);

  // Keep selectedFloorId valid within available floors range
  useEffect(() => {
    if (!availableFloors.some((f) => f.id === selectedFloorId)) {
      setSelectedFloorId('floor_1');
    }
  }, [availableFloors, selectedFloorId]);

  // ─── Load floor plan for selected floor ──────────────────────────────────────

  const loadFloor = useCallback(async (floorIdToLoad: string) => {
    if (!mallId) return;
    setLoadState('loading');

    const floorMeta = availableFloors.find((f) => f.id === floorIdToLoad) || {
      id: floorIdToLoad,
      number: 1,
      name: 'Ground Floor',
    };

    try {
      const token = await getToken();
      const res = await fetch(`${API_BASE_URL}/api/malls/${mallId}/floorplan?floorId=${floorIdToLoad}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message || 'Failed to load floor plan');

      if (json.data) {
        setFloorPlan({
          ...emptyFloorPlan(floorMeta.id, floorMeta.number, floorMeta.name),
          ...json.data,
          floorId: floorMeta.id,
          floorNumber: json.data.floorNumber || floorMeta.number,
          floorName: floorMeta.name,
          rooms: json.data.rooms || {},
          doors: json.data.doors || {},
          cameras: json.data.cameras || {},
        });
        setLoadState('loaded');
      } else {
        setFloorPlan(emptyFloorPlan(floorMeta.id, floorMeta.number, floorMeta.name));
        setLoadState('empty');
      }
      setHasUnsavedChanges(false);
    } catch (err: any) {
      console.error('[FloorPlanEditor] Load error:', err);
      setLoadState('error');
    }
  }, [mallId, getToken, availableFloors]);

  useEffect(() => {
    loadFloor(selectedFloorId);
  }, [selectedFloorId, loadFloor]);

  // Handle floor switch
  const handleFloorChange = (newFloorId: string) => {
    if (newFloorId === selectedFloorId) return;
    setSelectedElement(null);
    setSelectedFloorId(newFloorId);
  };

  // ─── Save floor plan ──────────────────────────────────────────────────────────

  const saveFloorPlan = useCallback(async () => {
    if (!mallId) return;
    setSaveState('saving');
    setSaveError(null);

    const currentFloorMeta = availableFloors.find((f) => f.id === selectedFloorId) || {
      id: selectedFloorId,
      number: 1,
      name: 'Ground Floor',
    };

    try {
      const token = await getToken();
      const res = await fetch(`${API_BASE_URL}/api/malls/${mallId}/floorplan?floorId=${selectedFloorId}`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          floorId: selectedFloorId,
          floorName: currentFloorMeta.name,
          floorNumber: currentFloorMeta.number,
          canvasWidth: floorPlan.canvasWidth,
          canvasHeight: floorPlan.canvasHeight,
          rooms: floorPlan.rooms,
          doors: floorPlan.doors,
          cameras: floorPlan.cameras,
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message || 'Failed to save floor plan');

      setSaveState('saved');
      setHasUnsavedChanges(false);
      setLoadState('loaded');
      setTimeout(() => setSaveState('idle'), 3000);
    } catch (err: any) {
      console.error('[FloorPlanEditor] Save error:', err);
      setSaveError(err.message);
      setSaveState('error');
    }
  }, [mallId, selectedFloorId, floorPlan, getToken, availableFloors]);

  // Keyboard shortcut Ctrl+S
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        saveFloorPlan();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [saveFloorPlan]);

  // ─── Element mutation handlers ────────────────────────────────────────────────

  const updateRoom = useCallback((roomId: string, updates: Partial<FloorRoom>) => {
    setFloorPlan((prev) => {
      const current = prev.rooms[roomId];
      if (!current) return prev;
      return {
        ...prev,
        rooms: {
          ...prev.rooms,
          [roomId]: { ...current, ...updates },
        },
      };
    });
    setHasUnsavedChanges(true);
  }, []);

  const updateDoor = useCallback((doorId: string, updates: Partial<FloorDoor>) => {
    setFloorPlan((prev) => {
      const current = prev.doors[doorId];
      if (!current) return prev;
      return {
        ...prev,
        doors: {
          ...prev.doors,
          [doorId]: { ...current, ...updates },
        },
      };
    });
    setHasUnsavedChanges(true);
  }, []);

  const updateCamera = useCallback((cameraId: string, updates: Partial<FloorCameraMarker>) => {
    setFloorPlan((prev) => {
      const current = prev.cameras[cameraId];
      if (!current) return prev;
      return {
        ...prev,
        cameras: {
          ...prev.cameras,
          [cameraId]: { ...current, ...updates },
        },
      };
    });
    setHasUnsavedChanges(true);
  }, []);

  const addRoom = useCallback((room: FloorRoom) => {
    setFloorPlan((prev) => ({
      ...prev,
      rooms: { ...prev.rooms, [room.roomId]: room },
    }));
    setHasUnsavedChanges(true);
    setActiveTool('select');
  }, []);

  const addDoor = useCallback((door: FloorDoor) => {
    setFloorPlan((prev) => ({
      ...prev,
      doors: { ...prev.doors, [door.doorId]: door },
    }));
    setHasUnsavedChanges(true);
    setActiveTool('select');
  }, []);

  const addCamera = useCallback((camera: FloorCameraMarker) => {
    setFloorPlan((prev) => ({
      ...prev,
      cameras: { ...prev.cameras, [camera.cameraId]: camera },
    }));
    setHasUnsavedChanges(true);
    setActiveTool('select');
  }, []);

  const deleteSelected = useCallback(() => {
    if (!selectedElement) return;
    setFloorPlan((prev) => {
      if (selectedElement.type === 'room') {
        const next = { ...prev.rooms };
        delete next[selectedElement.id];
        return { ...prev, rooms: next };
      }
      if (selectedElement.type === 'door') {
        const next = { ...prev.doors };
        delete next[selectedElement.id];
        return { ...prev, doors: next };
      }
      if (selectedElement.type === 'camera') {
        const next = { ...prev.cameras };
        delete next[selectedElement.id];
        return { ...prev, cameras: next };
      }
      return prev;
    });
    setSelectedElement(null);
    setHasUnsavedChanges(true);
  }, [selectedElement]);

  const handleToolChange = useCallback((tool: EditorTool) => {
    setActiveTool(tool);
    if (tool !== 'select') {
      setSelectedElement(null);
    }
  }, []);

  // ─── Status Badge ─────────────────────────────────────────────────────────────

  function SaveStatusBadge() {
    if (saveState === 'saving') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700">
          <RefreshCw className="w-3 h-3 animate-spin" />
          Saving…
        </span>
      );
    }
    if (saveState === 'saved') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
          ✓ Saved
        </span>
      );
    }
    if (saveState === 'error') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-red-50 text-red-700 border border-red-200">
          <AlertCircle className="w-3 h-3" />
          Save failed
        </span>
      );
    }
    if (hasUnsavedChanges) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
          Unsaved changes
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-500">
        Saved to cloud
      </span>
    );
  }

  // ─── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="h-full w-full flex flex-col min-h-0 overflow-hidden gap-2">
      {/* Editor Sub-Header: Floor Selector + Save Controls */}
      <div className="bg-white px-3.5 py-1.5 rounded-xl border border-slate-200/90 shadow-xs flex items-center justify-between shrink-0 h-11">
        <div className="flex items-center gap-2.5 min-w-0">
          <Layers className="w-4 h-4 text-blue-600 shrink-0" />

          {/* Floor Switcher / Display */}
          {availableFloors.length <= 1 ? (
            <div className="flex items-center gap-1.5 bg-slate-100/90 rounded-lg px-2.5 py-1 border border-slate-200">
              <span className="text-[10px] uppercase font-bold text-slate-500">Floor:</span>
              <span className="text-xs font-bold text-slate-800">Ground Floor</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 bg-slate-100 rounded-lg p-0.5 border border-slate-200">
              <span className="text-[10px] uppercase font-bold text-slate-500 pl-1.5">Floor:</span>
              <select
                value={selectedFloorId}
                onChange={(e) => handleFloorChange(e.target.value)}
                className="bg-white border border-slate-200 text-xs font-bold text-slate-800 rounded px-2 py-0.5 focus:ring-1 focus:ring-blue-500 cursor-pointer shadow-xs"
              >
                {availableFloors.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <span className="hidden lg:inline text-slate-300">|</span>
          <span className="hidden lg:inline text-xs text-slate-500 truncate">
            Configure shops, walkways, stairs, emergency exits, and CCTV cameras.
          </span>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <SaveStatusBadge />
          <button
            onClick={saveFloorPlan}
            disabled={saveState === 'saving'}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-semibold shadow-xs transition"
          >
            {saveState === 'saving' ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Saving…</span>
              </>
            ) : (
              <>
                <Save className="w-3.5 h-3.5" />
                <span>Save Floor</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Main 3-column Layout: Full height stretching */}
      <div className="flex-1 min-h-0 flex gap-2.5 items-stretch overflow-hidden">
        {/* Toolbar — Left */}
        <div className="w-36 shrink-0 h-full">
          <EditorToolbar
            activeTool={activeTool}
            onToolChange={handleToolChange}
            onDeleteSelected={deleteSelected}
            hasSelection={selectedElement !== null}
          />
        </div>

        {/* Canvas — Center */}
        <div className="flex-1 min-w-0 h-full">
          <FloorPlanCanvas
            floorPlan={floorPlan}
            selectedElement={selectedElement}
            activeTool={activeTool}
            onSelectElement={setSelectedElement}
            onUpdateRoom={updateRoom}
            onUpdateDoor={updateDoor}
            onUpdateCamera={updateCamera}
            onAddRoom={addRoom}
            onAddDoor={addDoor}
            onAddCamera={addCamera}
            onDeleteSelected={deleteSelected}
          />
        </div>

        {/* Properties Panel — Right */}
        <div className="w-60 shrink-0 h-full bg-white border border-slate-200/90 rounded-xl shadow-xs overflow-hidden flex flex-col">
          <PropertiesPanel
            selectedElement={selectedElement}
            rooms={floorPlan.rooms}
            doors={floorPlan.doors}
            cameras={floorPlan.cameras}
            onUpdateRoom={updateRoom}
            onUpdateDoor={updateDoor}
            onUpdateCamera={updateCamera}
            onDeleteSelected={deleteSelected}
            onViewCameraFeed={handleViewCameraFeed}
          />
        </div>
      </div>

      {/* CCTV Player Modal on Floor Plan */}
      <CctvPlayerModal
        camera={viewingCameraForFeed}
        isOpen={Boolean(viewingCameraForFeed)}
        onClose={() => setViewingCameraForFeed(null)}
      />

      {/* Legend & Shortcuts Bar */}
      <div className="bg-white px-3 py-1 rounded-lg border border-slate-200/80 shadow-xs flex items-center justify-between text-xs text-slate-600 shrink-0 h-8 select-none">
        <div className="flex items-center gap-3.5 text-[11px] overflow-hidden">
          <span className="flex items-center gap-1.5 font-medium">
            <span className="w-2.5 h-2.5 rounded bg-blue-100 border border-blue-500 inline-block" />
            Shop
          </span>
          <span className="flex items-center gap-1.5 font-medium">
            <span className="w-2.5 h-2.5 rounded bg-emerald-100 border border-emerald-500 inline-block" />
            Corridor
          </span>
          <span className="flex items-center gap-1.5 font-medium">
            <span className="w-2.5 h-2.5 rounded bg-purple-100 border border-purple-500 inline-block" />
            Stairs
          </span>
          <span className="flex items-center gap-1.5 font-medium">
            <span className="w-2.5 h-2.5 rounded bg-cyan-100 border border-cyan-500 inline-block" />
            Elevator
          </span>
          <span className="flex items-center gap-1.5 font-medium">
            <span className="w-3 h-2 rounded-xs bg-blue-600 inline-block" />
            Shop Entry
          </span>
          <span className="flex items-center gap-1.5 font-medium">
            <span className="w-2.5 h-2.5 rotate-45 bg-emerald-600 inline-block" />
            Main Entry/Exit
          </span>
          <span className="flex items-center gap-1.5 font-medium">
            <span className="w-2.5 h-2.5 rotate-45 bg-red-600 inline-block" />
            Emergency Exit
          </span>
          <span className="flex items-center gap-1.5 font-medium">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-700 border border-blue-400 inline-block" />
            Camera
          </span>
        </div>
        <div className="text-slate-400 text-[10px] font-mono hidden sm:block shrink-0">
          Press <kbd className="px-1 py-0.5 rounded bg-slate-100 border border-slate-200 text-slate-600">Ctrl+S</kbd> to save · <kbd className="px-1 py-0.5 rounded bg-slate-100 border border-slate-200 text-slate-600">Del</kbd> to remove
        </div>
      </div>
    </div>
  );
}
