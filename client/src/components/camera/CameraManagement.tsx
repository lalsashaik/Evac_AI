import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '@/context/AuthContext';
import { CameraRecord, CameraDetectionState } from '@/types/camera';
import { FloorPlan, FloorRoom } from '@/types/floorplan';
import { IncidentRecord } from '@/types/incident';
import { CctvPlayerModal } from './CctvPlayerModal';
import { CameraFormModal } from './CameraFormModal';
import { database } from '@/lib/firebase';
import { ref, onValue, off } from 'firebase/database';
import {
  Video,
  Plus,
  Search,
  Filter,
  Play,
  Edit2,
  Trash2,
  Wifi,
  WifiOff,
  Layers,
  MapPin,
  Radio,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  SlidersHorizontal,
  Compass,
  Flame,
  ShieldCheck,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000';

interface CameraManagementProps {
  totalFloors?: number;
  onNavigateToFloorPlan?: () => void;
  onNavigateToSituation?: () => void;
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

export const CameraManagement: React.FC<CameraManagementProps> = ({
  totalFloors = 1,
  onNavigateToFloorPlan,
  onNavigateToSituation,
}) => {
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

  const [cameras, setCameras] = useState<CameraRecord[]>([]);
  const [roomsByFloor, setRoomsByFloor] = useState<Record<string, FloorRoom[]>>({});
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedFloorFilter, setSelectedFloorFilter] = useState<string>('all');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>('all');

  // Modal states
  const [viewingCamera, setViewingCamera] = useState<CameraRecord | null>(null);
  const [isFormModalOpen, setIsFormModalOpen] = useState<boolean>(false);
  const [editingCamera, setEditingCamera] = useState<CameraRecord | null>(null);
  const [deletingCamera, setDeletingCamera] = useState<CameraRecord | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const [isAiOnline, setIsAiOnline] = useState<boolean | null>(null);

  // ─── Real-Time M8 Situation States ───────────────────────────────────────────
  const [cameraDetectionStates, setCameraDetectionStates] = useState<Record<string, CameraDetectionState>>({});
  const [incidents, setIncidents] = useState<IncidentRecord[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string | null>(null);

  // Active Floor for Floor Plan
  const activeFloorId = selectedFloorFilter !== 'all' ? selectedFloorFilter : 'floor_1';

  // Check AI Service connectivity on port 8000
  useEffect(() => {
    let isMounted = true;
    const probeAiService = async () => {
      try {
        const res = await fetch('http://localhost:8000/health');
        if (isMounted) setIsAiOnline(res.ok);
      } catch {
        if (isMounted) setIsAiOnline(false);
      }
    };
    probeAiService();
    const interval = setInterval(probeAiService, 15000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  // ─── Real-Time Firebase Listener: Camera Detection States (M8 Presence) ──────
  useEffect(() => {
    if (!mallId) return;

    if (database) {
      const stateRef = ref(database, `malls/${mallId}/cameraDetectionState`);
      const unsubscribe = onValue(
        stateRef,
        (snapshot) => {
          if (snapshot.exists()) {
            setCameraDetectionStates(snapshot.val() || {});
          } else {
            setCameraDetectionStates({});
          }
        },
        (err) => {
          console.warn('[CameraManagement] RTDB cameraDetectionState listener error:', err);
        }
      );

      return () => {
        off(stateRef);
      };
    } else {
      // REST fallback
      const fetchState = async () => {
        try {
          const res = await fetch(`${API_BASE_URL}/api/detection/state/${mallId}`);
          if (res.ok) {
            const json = await res.json();
            setCameraDetectionStates(json.data || {});
          }
        } catch (_) {}
      };
      fetchState();
      const interval = setInterval(fetchState, 3000);
      return () => clearInterval(interval);
    }
  }, [mallId]);

  // ─── Real-Time Firebase Listener: Incidents (/malls/{mallId}/incidents) ───────
  useEffect(() => {
    if (!mallId) return;

    if (database) {
      const incRef = ref(database, `malls/${mallId}/incidents`);
      const unsubscribe = onValue(
        incRef,
        (snapshot) => {
          if (snapshot.exists()) {
            const data = snapshot.val() || {};
            const list: IncidentRecord[] = Object.values(data);
            list.sort((a, b) => new Date(b.detectedAt || b.createdAt).getTime() - new Date(a.detectedAt || a.createdAt).getTime());
            setIncidents(list);
          } else {
            setIncidents([]);
          }
        },
        (err) => {
          console.warn('[CameraManagement] RTDB incidents listener error:', err);
        }
      );

      return () => {
        off(incRef);
      };
    } else {
      // REST fallback
      const fetchIncidents = async () => {
        try {
          const token = await getToken();
          if (!token) return;
          const res = await fetch(`${API_BASE_URL}/api/malls/${mallId}/incidents?limit=100`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (res.ok) {
            const json = await res.json();
            const list: IncidentRecord[] = json.data?.incidents || [];
            list.sort((a, b) => new Date(b.detectedAt || b.createdAt).getTime() - new Date(a.detectedAt || a.createdAt).getTime());
            setIncidents(list);
          }
        } catch (_) {}
      };
      fetchIncidents();
      const interval = setInterval(fetchIncidents, 3000);
      return () => clearInterval(interval);
    }
  }, [mallId, getToken]);

  // ─── Fetch Cameras and Floorplan Rooms ────────────────────────────────────────
  const loadData = useCallback(async () => {
    if (!mallId) return;
    setIsLoading(true);
    setError(null);

    try {
      const token = await getToken();
      if (!token) throw new Error('Authentication required.');

      // 1. Fetch cameras
      const camRes = await fetch(`${API_BASE_URL}/api/malls/${mallId}/cameras`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const camJson = await camRes.json();
      if (!camRes.ok) throw new Error(camJson.error?.message || 'Failed to fetch cameras');

      const loadedCameras: CameraRecord[] = camJson.data?.cameras || [];
      setCameras(loadedCameras);

      // 2. Fetch floorplans in parallel to get rooms for available floors
      const roomsMap: Record<string, FloorRoom[]> = {};
      await Promise.all(
        availableFloors.map(async (floor) => {
          try {
            const fpRes = await fetch(`${API_BASE_URL}/api/malls/${mallId}/floorplan?floorId=${floor.id}`, {
              headers: { Authorization: `Bearer ${token}` },
            });
            if (fpRes.ok) {
              const fpJson = await fpRes.json();
              if (fpJson.data?.rooms) {
                roomsMap[floor.id] = Object.values(fpJson.data.rooms);
              }
            }
          } catch (fpErr) {
            console.warn(`[CameraManagement] Error loading rooms for floor ${floor.id}:`, fpErr);
          }
        })
      );
      setRoomsByFloor(roomsMap);
    } catch (err: any) {
      console.error('[CameraManagement] Load error:', err);
      setError(err.message || 'Error connecting to camera management service.');
    } finally {
      setIsLoading(false);
    }
  }, [mallId, getToken, floorCount]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // ─── Save Camera Handler (Create / Update) ───────────────────────────────────
  const handleSaveCamera = async (cameraData: Partial<CameraRecord>) => {
    if (!mallId) return;
    const token = await getToken();
    if (!token) throw new Error('Authentication required.');

    const isEditing = Boolean(editingCamera);
    const url = isEditing
      ? `${API_BASE_URL}/api/malls/${mallId}/cameras/${editingCamera!.cameraId}`
      : `${API_BASE_URL}/api/malls/${mallId}/cameras`;
    const method = isEditing ? 'PATCH' : 'POST';

    const res = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(cameraData),
    });

    const json = await res.json();
    if (!res.ok) {
      throw new Error(json.error?.message || 'Failed to save camera.');
    }

    await loadData();
    setEditingCamera(null);
  };

  // ─── Delete Camera Handler ────────────────────────────────────────────────────
  const handleDeleteCamera = async () => {
    if (!mallId || !deletingCamera) return;
    setIsDeleting(true);

    try {
      const token = await getToken();
      if (!token) throw new Error('Authentication required.');

      const res = await fetch(`${API_BASE_URL}/api/malls/${mallId}/cameras/${deletingCamera.cameraId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error?.message || 'Failed to delete camera.');
      }

      setDeletingCamera(null);
      await loadData();
    } catch (err: any) {
      alert(`Delete failed: ${err.message}`);
    } finally {
      setIsDeleting(false);
    }
  };

  // ─── Toggle Camera Active State ──────────────────────────────────────────────
  const handleToggleActive = async (camera: CameraRecord, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!mallId) return;

    try {
      const token = await getToken();
      if (!token) return;

      const newActive = !camera.isActive;
      await fetch(`${API_BASE_URL}/api/malls/${mallId}/cameras/${camera.cameraId}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ isActive: newActive }),
      });

      setCameras((prev) =>
        prev.map((c) =>
          c.cameraId === camera.cameraId
            ? { ...c, isActive: newActive, health: { ...c.health!, status: newActive ? 'online' : 'inactive', updatedAt: new Date().toISOString() } }
            : c
        )
      );
    } catch (err) {
      console.error('Error toggling camera active state:', err);
    }
  };

  // ─── Filtered Cameras ────────────────────────────────────────────────────────
  const filteredCameras = cameras.filter((cam) => {
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = (cam.name || '').toLowerCase().includes(q);
      const matchId = (cam.cameraId || '').toLowerCase().includes(q);
      const matchRoom = (cam.roomName || '').toLowerCase().includes(q);
      if (!matchName && !matchId && !matchRoom) return false;
    }

    if (selectedFloorFilter !== 'all') {
      if (cam.floorId !== selectedFloorFilter) return false;
    }

    if (selectedStatusFilter === 'active' && !cam.isActive) return false;
    if (selectedStatusFilter === 'inactive' && cam.isActive) return false;
    if (selectedStatusFilter === 'simulated' && cam.streamType !== 'simulated') return false;
    if (selectedStatusFilter === 'mjpeg' && cam.streamType !== 'mjpeg' && cam.streamType !== 'esp32cam') return false;

    return true;
  });

  // Aggregate stats
  const totalCount = cameras.length;
  const activeCount = cameras.filter((c) => c.isActive).length;
  const simulatedCount = cameras.filter((c) => c.streamType === 'simulated').length;
  const placedOnFloorCount = cameras.filter((c) => c.x !== null && c.y !== null).length;

  // Active detected hazard count across all cameras
  const activeDetectedCameras = useMemo(() => {
    const now = Date.now();
    const set = new Set<string>();

    for (const cam of cameras) {
      const state = cameraDetectionStates[cam.cameraId];
      let isStale = false;
      if (state && state.updatedAt) {
        const diffMs = now - new Date(state.updatedAt).getTime();
        if (diffMs > 45000) isStale = true;
      }

      const camIncidents = incidents.filter((i) => i.cameraId === cam.cameraId);
      const activeDetectedInc = camIncidents.filter((i) => i.status === 'DETECTED');

      if (state && !isStale) {
        if (state.isCurrentlyDetected) {
          set.add(cam.cameraId);
        }
      } else if (state && isStale) {
        if (state.isCurrentlyDetected && activeDetectedInc.length > 0) {
          set.add(cam.cameraId);
        }
      } else if (activeDetectedInc.length > 0) {
        set.add(cam.cameraId);
      }
    }

    return set;
  }, [cameras, cameraDetectionStates, incidents]);

  return (
    <div className="h-full flex flex-col justify-between overflow-hidden gap-3 animate-in fade-in duration-200 select-none">
      {/* 1. Header & Actions Bar */}
      <div className="bg-white rounded-xl p-3.5 sm:px-5 border border-slate-200/90 shadow-xs flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 border border-blue-100 flex items-center justify-center shrink-0">
            <Video className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-base sm:text-lg font-bold tracking-tight text-slate-900 leading-tight">
              CCTV Camera Surveillance Management
            </h1>
            <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-2 flex-wrap">
              <span>Real-time feeds &amp; Mall Situation Floor Plan visualizer</span>
              <span className="text-slate-300">·</span>
              <span className="font-semibold text-slate-700">{totalCount} Cameras Configured</span>
              <span className="text-slate-300">·</span>
              {isAiOnline === true ? (
                <span
                  className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200"
                  title="Python AI Service is online on port 8000 (YOLOv8 Active)"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  AI Vision: Online (YOLOv8)
                </span>
              ) : (
                <span
                  className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-500 border border-slate-200"
                  title="Start AI service via npm run dev:ai"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                  AI Vision: Standby (:8000)
                </span>
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button
            size="sm"
            onClick={() => {
              setEditingCamera(null);
              setIsFormModalOpen(true);
            }}
            className="bg-blue-600 hover:bg-blue-700 text-white shadow-xs text-xs h-8 px-3"
          >
            <Plus className="w-3.5 h-3.5 mr-1.5" />
            Add Camera
          </Button>

          {onNavigateToSituation && (
            <Button
              variant="outline"
              size="sm"
              onClick={onNavigateToSituation}
              className={`text-xs h-8 px-3 cursor-pointer ${
                activeDetectedCameras.size > 0
                  ? 'border-red-300 bg-red-50 text-red-700 hover:bg-red-100 font-bold animate-pulse'
                  : 'border-slate-200 text-slate-700 hover:bg-slate-50'
              }`}
            >
              <Compass className={`w-3.5 h-3.5 mr-1.5 ${activeDetectedCameras.size > 0 ? 'text-red-600' : 'text-blue-600'}`} />
              Mall Situation
              {activeDetectedCameras.size > 0 && (
                <span className="ml-1.5 px-1.5 py-0.2 rounded-full bg-red-600 text-white text-[10px]">
                  {activeDetectedCameras.size} Active
                </span>
              )}
            </Button>
          )}

          {onNavigateToFloorPlan && (
            <Button
              variant="outline"
              size="sm"
              onClick={onNavigateToFloorPlan}
              className="border-slate-200 text-slate-700 hover:bg-slate-50 text-xs h-8 px-3"
            >
              <Compass className="w-3.5 h-3.5 mr-1.5 text-blue-600" />
              Floor Plan Canvas
            </Button>
          )}
        </div>
      </div>

      {/* 2. Metrics Bar: Total, Active, Simulated Loops, Placed on Floor */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 shrink-0">
        <Card className="bg-white border-slate-200/90 shadow-xs">
          <CardContent className="p-3.5 flex items-center justify-between">
            <div className="min-w-0 pr-2">
              <p className="text-[11px] font-medium text-slate-500">Total Cameras</p>
              <p className="text-base font-bold text-slate-900 mt-0.5">{totalCount} Devices</p>
              <p className="text-[11px] text-slate-400 mt-0.5 truncate">Across all building floors</p>
            </div>
            <div className="w-9 h-9 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
              <Video className="w-4 h-4" />
            </div>
          </CardContent>
        </Card>

        {/* Hazard Status Metric Card */}
        {activeDetectedCameras.size > 0 ? (
          <Card className="bg-red-600 text-white border-red-700 shadow-md animate-pulse">
            <CardContent className="p-3.5 flex items-center justify-between">
              <div className="min-w-0 pr-2">
                <p className="text-[11px] font-bold uppercase tracking-wider text-red-100">Active Incident Alert</p>
                <p className="text-base font-extrabold text-white mt-0.5">
                  {activeDetectedCameras.size} Affected Camera{activeDetectedCameras.size > 1 ? 's' : ''}
                </p>
                <p className="text-[11px] text-red-100 mt-0.5 truncate font-medium">Highlighted on floor plan blueprint</p>
              </div>
              <div className="w-9 h-9 rounded-lg bg-white/20 text-white flex items-center justify-center shrink-0">
                <Flame className="w-5 h-5 animate-bounce" />
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="bg-white border-slate-200/90 shadow-xs">
            <CardContent className="p-3.5 flex items-center justify-between">
              <div className="min-w-0 pr-2">
                <p className="text-[11px] font-medium text-slate-500">Hazard Surveillance</p>
                <p className="text-base font-bold text-emerald-700 mt-0.5">All Zones Normal</p>
                <p className="text-[11px] text-emerald-600 font-medium mt-0.5 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  0 Active Detection Alerts
                </p>
              </div>
              <div className="w-9 h-9 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-4 h-4" />
              </div>
            </CardContent>
          </Card>
        )}

        <Card className="bg-white border-slate-200/90 shadow-xs">
          <CardContent className="p-3.5 flex items-center justify-between">
            <div className="min-w-0 pr-2">
              <p className="text-[11px] font-medium text-slate-500">Active Feeds</p>
              <p className="text-base font-bold text-slate-900 mt-0.5">{activeCount} Monitored</p>
              <p className="text-[11px] text-slate-400 mt-0.5 truncate">Live Grid Operational</p>
            </div>
            <div className="w-9 h-9 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
              <Radio className="w-4 h-4" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white border-slate-200/90 shadow-xs">
          <CardContent className="p-3.5 flex items-center justify-between">
            <div className="min-w-0 pr-2">
              <p className="text-[11px] font-medium text-slate-500">Floor Plan Placed</p>
              <p className="text-base font-bold text-slate-900 mt-0.5">{placedOnFloorCount} Mapped</p>
              <p className="text-[11px] text-slate-400 mt-0.5 truncate">Spatial coordinates active</p>
            </div>
            <div className="w-9 h-9 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
              <Layers className="w-4 h-4" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 3. Search, Filter & Layout Mode Switcher Bar */}
      <div className="bg-white rounded-xl px-4 py-2.5 border border-slate-200/90 shadow-xs flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-2 flex-1 min-w-[200px] max-w-md">
          <div className="relative w-full">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <Input
              type="text"
              placeholder="Search cameras by name, ID, or room…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="text-xs h-8 pl-8 bg-slate-50 focus:bg-white"
            />
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Floor filter */}
          <select
            value={selectedFloorFilter}
            onChange={(e) => setSelectedFloorFilter(e.target.value)}
            className="h-8 rounded-lg border border-slate-200 bg-slate-50 px-2.5 text-xs text-slate-700 font-medium focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
          >
            <option value="all">All Building Floors</option>
            {availableFloors.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>

          {/* Status filter */}
          <select
            value={selectedStatusFilter}
            onChange={(e) => setSelectedStatusFilter(e.target.value)}
            className="h-8 rounded-lg border border-slate-200 bg-slate-50 px-2.5 text-xs text-slate-700 font-medium focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
          >
            <option value="all">All Feeds &amp; Sources</option>
            <option value="active">Active Feeds Only</option>
            <option value="inactive">Inactive Feeds Only</option>
            <option value="simulated">Simulated (MP4/WebM) Only</option>
            <option value="mjpeg">MJPEG Stream Only</option>
          </select>

          <Button
            variant="ghost"
            size="sm"
            onClick={loadData}
            className="h-8 px-2 text-slate-500 hover:text-slate-800"
            title="Refresh camera list"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* 4. Main CCTV Camera Grid View */}
      <div className="flex-1 min-h-0 bg-white rounded-xl border border-slate-200/90 shadow-xs overflow-hidden flex flex-col p-3 sm:p-4">
            {isLoading ? (
              <div className="flex-1 flex flex-col items-center justify-center text-slate-400 gap-2">
                <RefreshCw className="w-6 h-6 animate-spin text-blue-600" />
                <p className="text-xs font-semibold text-slate-600">Loading mall surveillance cameras…</p>
              </div>
            ) : error ? (
              <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
                <AlertCircle className="w-8 h-8 text-rose-500 mb-2" />
                <p className="text-xs font-semibold text-slate-800">{error}</p>
                <Button size="sm" onClick={loadData} className="mt-3 text-xs h-7">
                  Try Again
                </Button>
              </div>
            ) : filteredCameras.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
                <div className="w-14 h-14 rounded-2xl bg-blue-50 border border-blue-100 text-blue-600 flex items-center justify-center mb-3">
                  <Video className="w-7 h-7" />
                </div>
                <h3 className="text-sm font-bold text-slate-800">No CCTV cameras found</h3>
                <p className="text-xs text-slate-500 max-w-sm mt-1 leading-relaxed">
                  {cameras.length === 0
                    ? 'No cameras have been registered for this property yet. Add a camera or place one on the interactive Floor Plan editor.'
                    : 'No cameras match your current search or filter query. Adjust your filters to see more results.'}
                </p>
                <div className="mt-4 flex items-center gap-2">
                  <Button
                    size="sm"
                    onClick={() => {
                      setEditingCamera(null);
                      setIsFormModalOpen(true);
                    }}
                    className="bg-blue-600 hover:bg-blue-700 text-white text-xs h-8 px-3.5"
                  >
                    <Plus className="w-3.5 h-3.5 mr-1" />
                    Add New Camera
                  </Button>
                  {cameras.length > 0 && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setSearchQuery('');
                        setSelectedFloorFilter('all');
                        setSelectedStatusFilter('all');
                      }}
                      className="text-xs h-8"
                    >
                      Clear Filters
                    </Button>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex-1 min-h-0 overflow-y-auto pr-1">
                <div className="grid gap-3.5 grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                  {filteredCameras.map((cam) => {
                    const isSimulated = cam.streamType === 'simulated';
                    const isOnline = cam.isActive && cam.health?.status !== 'offline';

                    // Determine active hazard detection for this camera
                    const now = Date.now();
                    const detState = cameraDetectionStates[cam.cameraId];
                    let isStale = false;
                    if (detState?.updatedAt) {
                      const diffMs = now - new Date(detState.updatedAt).getTime();
                      if (diffMs > 30000) isStale = true;
                    }

                    const camIncidents = incidents.filter((i) => i.cameraId === cam.cameraId);
                    const activeDetectedInc = camIncidents.filter((i) => i.status === 'DETECTED');
                    const latestInc = camIncidents[0] || null;
                    const allCamObs = latestInc?.observations
                      ? (Array.isArray(latestInc.observations) ? latestInc.observations : Object.values(latestInc.observations))
                      : [];
                    const totalSnapsCount = allCamObs.length || (latestInc?.evidenceAvailable ? 1 : 0);

                    let isHazardActive = false;
                    let hazardType = 'fire';

                    if (detState && !isStale) {
                      isHazardActive = Boolean(detState.isCurrentlyDetected);
                      hazardType = detState.detectionType || (activeDetectedInc[0]?.detectionType || 'fire');
                    } else if (detState && isStale) {
                      isHazardActive = Boolean(detState.isCurrentlyDetected) && activeDetectedInc.length > 0;
                      hazardType = detState.detectionType || (activeDetectedInc[0]?.detectionType || 'fire');
                    } else {
                      isHazardActive = activeDetectedInc.length > 0;
                      hazardType = activeDetectedInc[0]?.detectionType || 'fire';
                    }

                    const isSelected = selectedCameraId === cam.cameraId;

                    return (
                      <div
                        key={cam.cameraId}
                        onClick={() => setSelectedCameraId(cam.cameraId)}
                        className={`group rounded-xl border transition-all flex flex-col justify-between overflow-hidden cursor-pointer ${
                          isHazardActive
                            ? 'border-red-500 shadow-md ring-2 ring-red-400/50 bg-red-50/15'
                            : isSelected
                            ? 'border-blue-500 ring-2 ring-blue-400/40 bg-white shadow-md'
                            : 'border-slate-200/90 bg-white hover:border-blue-400 hover:shadow-md'
                        }`}
                      >
                        {/* Card Top: Video Preview Thumbnail with Overlay Status */}
                        <div
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedCameraId(cam.cameraId);
                            setViewingCamera(cam);
                          }}
                          className="relative h-36 bg-slate-950 cursor-pointer overflow-hidden flex items-center justify-center group/thumb"
                        >
                          {/* Video tag thumbnail (muted, paused at first frame) */}
                          {isSimulated ? (
                            <video
                              src={cam.streamUrl}
                              playsInline
                              muted
                              preload="metadata"
                              className="w-full h-full object-cover opacity-80 group-hover/thumb:opacity-95 transition"
                            />
                          ) : (
                            <div className="w-full h-full flex flex-col items-center justify-center bg-slate-900 text-slate-400 p-4 text-center">
                              <Radio className="w-7 h-7 text-purple-400 mb-1 animate-pulse" />
                              <span className="text-[10px] font-mono text-purple-200">MJPEG Stream Feed</span>
                              <span className="text-[9px] text-slate-500 font-mono truncate max-w-full px-2 mt-0.5">
                                {cam.streamUrl}
                              </span>
                            </div>
                          )}

                          {/* Dark gradient overlay */}
                          <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-slate-950/40" />

                          {/* Top Badges */}
                          <div className="absolute top-2.5 left-2.5 right-2.5 flex items-center justify-between z-10 gap-1 flex-wrap">
                            {/* Hazard Alert Badge or Normal Active Status */}
                            {isHazardActive ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-red-600 text-white shadow-md animate-pulse">
                                <Flame className="w-3 h-3 text-white animate-bounce" />
                                ACTIVE {(hazardType || 'HAZARD').toUpperCase()}
                              </span>
                            ) : cam.isActive ? (
                              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/90 text-white shadow-xs backdrop-blur-xs">
                                <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                                Active
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-700/90 text-slate-200 shadow-xs backdrop-blur-xs">
                                Inactive
                              </span>
                            )}

                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-black/60 text-slate-200 backdrop-blur-xs border border-white/10 uppercase tracking-wider">
                              {isSimulated ? 'Simulated' : 'MJPEG'}
                            </span>

                            {isHazardActive ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-950/80 text-red-200 backdrop-blur-xs border border-red-500/30">
                                Hazard Alert
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-indigo-950/70 text-indigo-200 backdrop-blur-xs border border-indigo-400/20">
                                AI Ready
                              </span>
                            )}
                          </div>

                          {/* Play Button Overlay */}
                          <div className="absolute inset-0 flex items-center justify-center opacity-80 group-hover/thumb:opacity-100 group-hover/thumb:scale-105 transition">
                            <div
                              className={`w-10 h-10 rounded-full flex items-center justify-center shadow-lg border border-white/20 ${
                                isHazardActive ? 'bg-red-600/95 text-white' : 'bg-blue-600/90 text-white'
                              }`}
                            >
                              <Play className="w-4 h-4 ml-0.5" />
                            </div>
                          </div>

                          {/* Bottom Info on Thumbnail */}
                          <div className="absolute bottom-2 left-2.5 right-2.5 flex items-center justify-between text-[10px] text-white/90 drop-shadow-md z-10">
                            <span className="font-mono">{cam.floorName || 'Ground Floor'}</span>
                            <span className={`font-mono ${isHazardActive ? 'text-red-400 font-bold' : 'text-emerald-300'}`}>
                              {isHazardActive ? '● HAZARD ACTIVE' : '● LIVE READY'}
                            </span>
                          </div>
                        </div>

                        {/* Card Content Body */}
                        <div className="p-3.5 flex-1 flex flex-col justify-between">
                          <div>
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <h4
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedCameraId(cam.cameraId);
                                    setViewingCamera(cam);
                                  }}
                                  className={`text-sm font-bold truncate hover:text-blue-600 cursor-pointer ${
                                    isHazardActive ? 'text-red-900' : 'text-slate-900'
                                  }`}
                                  title={cam.name}
                                >
                                  {cam.name}
                                </h4>
                                <p className="text-[10px] font-mono text-slate-400 mt-0.5">{cam.cameraId}</p>
                              </div>
                              {/* Active toggle button */}
                              <button
                                onClick={(e) => handleToggleActive(cam, e)}
                                title={cam.isActive ? 'Deactivate camera' : 'Activate camera'}
                                className={`p-1.5 rounded-lg text-xs font-semibold transition ${
                                  cam.isActive
                                    ? 'text-emerald-700 bg-emerald-50 hover:bg-emerald-100'
                                    : 'text-slate-400 bg-slate-100 hover:bg-slate-200'
                                }`}
                              >
                                {cam.isActive ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
                              </button>
                            </div>

                            {/* Active Hazard Warning or Clear Normal State in Card */}
                            {isHazardActive ? (
                              <div className="mt-2 p-1.5 rounded-lg bg-red-50 border border-red-200 text-red-900 flex items-center justify-between text-[11px] font-bold">
                                <span className="flex items-center gap-1.5">
                                  <Flame className="w-3.5 h-3.5 text-red-600 animate-bounce" />
                                  Active {(hazardType || 'Hazard').toUpperCase()} Presence
                                </span>
                                <span className="text-[10px] text-red-700">See Floor Plan</span>
                              </div>
                            ) : (
                              <div className="mt-2 p-1.5 rounded-lg bg-emerald-50/70 border border-emerald-200 text-emerald-800 flex items-center justify-between text-[11px] font-semibold">
                                <span className="flex items-center gap-1.5">
                                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                                  Normal Surveillance (No Fire)
                                </span>
                                {totalSnapsCount > 0 && (
                                  <span className="text-[10px] font-mono text-emerald-700 font-bold bg-emerald-100/80 px-1.5 py-0.5 rounded">
                                    {totalSnapsCount} Snap{totalSnapsCount > 1 ? 's' : ''}
                                  </span>
                                )}
                              </div>
                            )}

                            {/* Location Details */}
                            <div className="mt-2.5 pt-2 border-t border-slate-100 space-y-1 text-xs text-slate-600">
                              <div className="flex items-center justify-between text-[11px]">
                                <span className="text-slate-400 flex items-center gap-1">
                                  <MapPin className="w-3 h-3 text-slate-400" />
                                  Location:
                                </span>
                                <span className="font-medium text-slate-800 truncate max-w-[170px]">
                                  {cam.roomName || 'Corridor Walkway / Area'}
                                </span>
                              </div>

                              <div className="flex items-center justify-between text-[11px]">
                                <span className="text-slate-400 flex items-center gap-1">
                                  <Layers className="w-3 h-3 text-slate-400" />
                                  Floor Level:
                                </span>
                                <span className="font-medium text-slate-800">
                                  {cam.floorName || cam.floorId}
                                </span>
                              </div>

                              <div className="flex items-center justify-between text-[11px]">
                                <span className="text-slate-400">Position (X, Y):</span>
                                <span className="font-mono text-[10px] text-slate-600 font-semibold">
                                  {cam.x !== null && cam.y !== null
                                    ? `${(cam.x! * 100).toFixed(0)}%, ${(cam.y! * 100).toFixed(0)}%`
                                    : 'Unplaced on canvas'}
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Card Bottom Actions */}
                          <div className="mt-3.5 pt-2.5 border-t border-slate-100 flex items-center justify-between gap-1.5">
                            <Button
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedCameraId(cam.cameraId);
                                setViewingCamera(cam);
                              }}
                              className={`text-xs h-7 px-2.5 flex-1 font-semibold ${
                                isHazardActive
                                  ? 'bg-red-600 hover:bg-red-700 text-white shadow-xs font-bold'
                                  : 'bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200'
                              }`}
                            >
                              <Play className="w-3 h-3 mr-1" />
                              {isHazardActive ? 'Inspect Active Feed' : 'View Feed'}
                            </Button>

                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingCamera(cam);
                                setIsFormModalOpen(true);
                              }}
                              className="h-7 w-7 p-0 text-slate-500 hover:text-slate-900 hover:bg-slate-100"
                              title="Edit camera configuration"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </Button>

                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                setDeletingCamera(cam);
                              }}
                              className="h-7 w-7 p-0 text-slate-400 hover:text-red-600 hover:bg-red-50"
                              title="Delete camera"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
      </div>

      {/* ─── MODALS ─── */}

      {/* CCTV Player Modal */}
      <CctvPlayerModal
        camera={viewingCamera}
        detectionState={viewingCamera ? cameraDetectionStates[viewingCamera.cameraId] : null}
        isOpen={Boolean(viewingCamera)}
        onClose={() => setViewingCamera(null)}
        onNavigateToFloorPlan={onNavigateToFloorPlan}
      />

      {/* Add / Edit Camera Modal */}
      <CameraFormModal
        isOpen={isFormModalOpen}
        onClose={() => {
          setIsFormModalOpen(false);
          setEditingCamera(null);
        }}
        onSave={handleSaveCamera}
        initialData={editingCamera}
        availableFloors={availableFloors}
        roomsByFloor={roomsByFloor}
      />

      {/* Delete Confirmation Modal */}
      {deletingCamera && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-md w-full p-5 space-y-3">
            <div className="w-10 h-10 rounded-full bg-red-50 border border-red-100 text-red-600 flex items-center justify-center">
              <Trash2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">Delete CCTV Camera?</h3>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                Are you sure you want to delete camera{' '}
                <strong className="text-slate-800">"{deletingCamera.name}"</strong> (
                <code className="text-xs font-mono">{deletingCamera.cameraId}</code>)?
              </p>
              <div className="mt-2.5 p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-[11px] text-amber-800">
                This will remove its surveillance stream and floor plan marker. Associated rooms, doors, and historical
                incident records will remain intact.
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setDeletingCamera(null)}
                disabled={isDeleting}
                className="text-xs h-8"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleDeleteCamera}
                disabled={isDeleting}
                className="bg-red-600 hover:bg-red-700 text-white text-xs h-8"
              >
                {isDeleting ? 'Deleting…' : 'Confirm Delete'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
