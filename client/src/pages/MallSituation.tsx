import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import { CameraRecord, CameraDetectionState } from '@/types/camera';
import { FloorPlan, FloorRoom } from '@/types/floorplan';
import { IncidentRecord } from '@/types/incident';
import { CameraSituationFloorPlan } from '@/components/camera/CameraSituationFloorPlan';
import { CctvPlayerModal } from '@/components/camera/CctvPlayerModal';
import { IncidentModal } from '@/components/incident/IncidentModal';
import { database } from '@/lib/firebase';
import { ref, onValue, off } from 'firebase/database';
import {
  Compass,
  Flame,
  ShieldCheck,
  Video,
  Layers,
  Maximize2,
  Minimize2,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Building2,
  ArrowRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000';

interface MallSituationProps {
  totalFloors?: number;
  onNavigateToCameras?: () => void;
  onNavigateToFloorPlan?: () => void;
}

export const MallSituation: React.FC<MallSituationProps> = ({
  totalFloors = 1,
  onNavigateToCameras,
  onNavigateToFloorPlan,
}) => {
  const { mallId, getToken } = useAuth();

  const [cameras, setCameras] = useState<CameraRecord[]>([]);
  const [floorPlan, setFloorPlan] = useState<FloorPlan | null>(null);
  const [cameraDetectionStates, setCameraDetectionStates] = useState<Record<string, CameraDetectionState>>({});
  const [incidents, setIncidents] = useState<IncidentRecord[]>([]);
  const [selectedFloorId, setSelectedFloorId] = useState<string>('floor_1');
  const [selectedCameraId, setSelectedCameraId] = useState<string | null>(null);
  const [activeViewingCamera, setActiveViewingCamera] = useState<CameraRecord | null>(null);
  const [inspectingIncident, setInspectingIncident] = useState<IncidentRecord | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [isAiOnline, setIsAiOnline] = useState<boolean>(true);

  const containerRef = useRef<HTMLDivElement>(null);

  const floorCount = Math.max(1, totalFloors || 1);
  const availableFloors = useMemo(() => {
    return Array.from({ length: floorCount }, (_, i) => {
      const num = i + 1;
      const id = `floor_${num}`;
      const name = num === 1 ? 'Ground Floor' : `${num}nd Floor`;
      return { id, number: num, name };
    });
  }, [floorCount]);

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

  // ─── Real-Time Firebase Listener: Camera Detection States ─────────────────
  useEffect(() => {
    if (!mallId) return;

    if (database) {
      const stateRef = ref(database, `malls/${mallId}/cameraDetectionState`);
      onValue(
        stateRef,
        (snapshot) => {
          if (snapshot.exists()) {
            setCameraDetectionStates(snapshot.val() || {});
          } else {
            setCameraDetectionStates({});
          }
        },
        (err) => {
          console.warn('[MallSituation] RTDB cameraDetectionState listener error:', err);
        }
      );

      return () => {
        off(stateRef);
      };
    } else {
      // REST polling fallback
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

  // ─── Real-Time Firebase Listener: Incidents (/malls/{mallId}/incidents) ────
  useEffect(() => {
    if (!mallId) return;

    if (database) {
      const incRef = ref(database, `malls/${mallId}/incidents`);
      onValue(
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
          console.warn('[MallSituation] RTDB incidents listener error:', err);
        }
      );

      return () => {
        off(incRef);
      };
    } else {
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

  // ─── Real-Time Firebase Listener: Floor Plan ──────────────────────────────
  useEffect(() => {
    if (!mallId) return;

    if (database) {
      const fpRef = ref(database, `malls/${mallId}/floorplans/${selectedFloorId}`);
      onValue(
        fpRef,
        (snapshot) => {
          if (snapshot.exists()) {
            setFloorPlan(snapshot.val() as FloorPlan);
          } else {
            setFloorPlan(null);
          }
        },
        (err) => {
          console.warn('[MallSituation] RTDB floorplan listener error:', err);
        }
      );

      return () => {
        off(fpRef);
      };
    } else {
      const fetchFp = async () => {
        try {
          const token = await getToken();
          if (!token) return;
          const res = await fetch(`${API_BASE_URL}/api/malls/${mallId}/floorplan?floorId=${selectedFloorId}`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (res.ok) {
            const json = await res.json();
            setFloorPlan(json.data || null);
          }
        } catch (_) {}
      };
      fetchFp();
    }
  }, [mallId, selectedFloorId, getToken]);

  // ─── Load Cameras ─────────────────────────────────────────────────────────
  const loadCameras = useCallback(async () => {
    if (!mallId) return;
    setIsLoading(true);

    try {
      const token = await getToken();
      if (!token) throw new Error('Authentication required.');

      const res = await fetch(`${API_BASE_URL}/api/malls/${mallId}/cameras`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (res.ok) {
        setCameras(json.data?.cameras || []);
      }
    } catch (err) {
      console.error('[MallSituation] Load cameras error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [mallId, getToken]);

  useEffect(() => {
    loadCameras();
  }, [loadCameras]);

  // Fullscreen Toggle
  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };

  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

  // Compute Active Detected Hazards across all cameras
  const activeHazardsCount = useMemo(() => {
    let count = 0;
    const now = Date.now();
    for (const cam of cameras) {
      const state = cameraDetectionStates[cam.cameraId];
      let isStale = false;
      if (state && state.updatedAt) {
        const diffMs = now - new Date(state.updatedAt).getTime();
        if (diffMs > 30000) isStale = true;
      }

      if (state) {
        if (!isStale && state.isCurrentlyDetected) count++;
      } else {
        const hasDetected = incidents.some((i) => i.cameraId === cam.cameraId && i.status === 'DETECTED');
        if (hasDetected) count++;
      }
    }
    return count;
  }, [cameras, cameraDetectionStates, incidents]);

  return (
    <div
      ref={containerRef}
      className={`h-full flex flex-col justify-between overflow-hidden gap-3 animate-in fade-in duration-200 select-none ${
        isFullscreen ? 'bg-slate-900 p-4 text-white' : ''
      }`}
    >
      {/* 1. Header Toolbar */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-xs flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${
            activeHazardsCount > 0
              ? 'bg-red-50 text-red-600 border-red-200 animate-pulse'
              : 'bg-blue-50 text-blue-600 border-blue-100'
          }`}>
            {activeHazardsCount > 0 ? (
              <Flame className="w-5 h-5 text-red-600 animate-bounce" />
            ) : (
              <Compass className="w-5 h-5 text-blue-600" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-slate-900 tracking-tight">Mall Situation Monitor</h2>
              <Badge
                variant="outline"
                className={`text-[11px] font-semibold px-2 py-0.5 rounded-full flex items-center gap-1.5 ${
                  activeHazardsCount > 0
                    ? 'border-red-300 bg-red-50 text-red-700 animate-pulse'
                    : 'border-emerald-300 bg-emerald-50 text-emerald-700'
                }`}
              >
                <span className={`w-2 h-2 rounded-full ${activeHazardsCount > 0 ? 'bg-red-600 animate-ping' : 'bg-emerald-500'}`} />
                {activeHazardsCount > 0
                  ? `${activeHazardsCount} Active Hazard${activeHazardsCount > 1 ? 's' : ''} Detected`
                  : 'All Zones Normal'}
              </Badge>
              {isAiOnline && (
                <Badge variant="outline" className="text-[10px] font-mono border-blue-200 bg-blue-50 text-blue-700">
                  AI Continuous Sensing
                </Badge>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Live spatial overview of shopping mall blueprint, CCTV surveillance coverage, and fire/smoke presence
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Floor Selector Dropdown */}
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1">
            <Layers className="w-3.5 h-3.5 text-slate-500" />
            <select
              value={selectedFloorId}
              onChange={(e) => setSelectedFloorId(e.target.value)}
              className="bg-transparent text-xs font-semibold text-slate-700 focus:outline-none cursor-pointer"
            >
              {availableFloors.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          </div>

          {/* Refresh Data */}
          <Button
            variant="outline"
            size="sm"
            onClick={loadCameras}
            className="border-slate-200 text-slate-700 hover:bg-slate-50 text-xs h-8 px-2.5"
            title="Refresh situation feeds"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>

          {/* Fullscreen Toggle */}
          <Button
            variant="outline"
            size="sm"
            onClick={toggleFullscreen}
            className="border-slate-200 text-slate-700 hover:bg-slate-50 text-xs h-8 px-2.5"
            title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen Large Display'}
          >
            {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline ml-1">{isFullscreen ? 'Exit Fullscreen' : 'Large Screen'}</span>
          </Button>

          {/* Switch to Feeds Grid */}
          {onNavigateToCameras && (
            <Button
              variant="outline"
              size="sm"
              onClick={onNavigateToCameras}
              className="border-slate-200 text-slate-700 hover:bg-slate-50 text-xs h-8 px-3"
            >
              <Video className="w-3.5 h-3.5 mr-1.5 text-blue-600" />
              Surveillance Grid
            </Button>
          )}

          {/* Switch to Floor Plan Editor */}
          {onNavigateToFloorPlan && (
            <Button
              variant="outline"
              size="sm"
              onClick={onNavigateToFloorPlan}
              className="border-slate-200 text-slate-700 hover:bg-slate-50 text-xs h-8 px-3"
            >
              <Building2 className="w-3.5 h-3.5 mr-1.5 text-slate-500" />
              Edit Blueprint
            </Button>
          )}
        </div>
      </div>

      {/* 2. Main Blueprint Canvas Component (Large Screen Area) */}
      <div className="flex-1 min-h-0 bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden flex flex-col">
        <CameraSituationFloorPlan
          floorPlan={floorPlan}
          cameras={cameras}
          cameraDetectionStates={cameraDetectionStates}
          incidents={incidents}
          selectedCameraId={selectedCameraId}
          onSelectCamera={setSelectedCameraId}
          onViewCameraFeed={(cam) => setActiveViewingCamera(cam)}
          onNavigateToFloorPlan={onNavigateToFloorPlan}
          availableFloors={availableFloors}
          selectedFloorId={selectedFloorId}
          onSelectFloor={setSelectedFloorId}
          onInspectIncident={(inc) => setInspectingIncident(inc)}
        />
      </div>

      {/* 3. Live Stream Player Modal Popup */}
      <CctvPlayerModal
        camera={activeViewingCamera}
        detectionState={activeViewingCamera ? cameraDetectionStates[activeViewingCamera.cameraId] : null}
        isOpen={Boolean(activeViewingCamera)}
        onClose={() => setActiveViewingCamera(null)}
        onNavigateToFloorPlan={onNavigateToFloorPlan}
      />

      {/* 4. Incident Timeline & Evidence Snaps Inspection Modal */}
      {inspectingIncident && (
        <IncidentModal
          incident={inspectingIncident}
          mallId={mallId}
          getToken={getToken}
          onClose={() => setInspectingIncident(null)}
          onStatusUpdated={(updated) => {
            setIncidents((prev) => prev.map((i) => (i.incidentId === updated.incidentId ? updated : i)));
            setInspectingIncident(updated);
          }}
        />
      )}
    </div>
  );
};
