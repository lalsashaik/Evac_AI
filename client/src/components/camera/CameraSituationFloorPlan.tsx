import React, { useRef, useState, useEffect, useMemo, useCallback } from 'react';
import { Stage, Layer, Rect, Group, Text, Circle, Line } from 'react-konva';
import {
  FloorPlan,
  ROOM_STYLES,
  DOOR_COLORS,
} from '@/types/floorplan';
import { CameraRecord, CameraDetectionState } from '@/types/camera';
import { IncidentRecord } from '@/types/incident';
import {
  Flame,
  Play,
  Layers,
  MapPin,
  Clock,
  Compass,
  X,
  ShieldCheck,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Crosshair,
  Radio,
  History,
  Camera,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatDateTime } from '@/lib/utils';

// ─── Reference Blueprint Coordinate Space ─────────────────────────────────────
const CANVAS_W = 1000;
const CANVAS_H = 660;
const GRID_SIZE = 25;

function toPx(norm: number, total: number): number {
  return norm * total;
}

interface CameraSituationFloorPlanProps {
  floorPlan: FloorPlan | null;
  cameras: CameraRecord[];
  cameraDetectionStates: Record<string, CameraDetectionState>;
  incidents: IncidentRecord[];
  selectedCameraId: string | null;
  onSelectCamera: (cameraId: string | null) => void;
  onViewCameraFeed: (camera: CameraRecord) => void;
  onNavigateToFloorPlan?: () => void;
  availableFloors?: { id: string; number: number; name: string }[];
  selectedFloorId?: string;
  onSelectFloor?: (floorId: string) => void;
  onInspectIncident?: (incident: IncidentRecord) => void;
}

export const CameraSituationFloorPlan: React.FC<CameraSituationFloorPlanProps> = ({
  floorPlan,
  cameras,
  cameraDetectionStates,
  incidents,
  selectedCameraId,
  onSelectCamera,
  onViewCameraFeed,
  onNavigateToFloorPlan,
  availableFloors = [],
  selectedFloorId = 'floor_1',
  onSelectFloor,
  onInspectIncident,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<any>(null);

  // Transform states: zoom scale and pan offset
  const [stageScale, setStageScale] = useState<number>(1.0);
  const [stagePos, setStagePos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [pulsePhase, setPulsePhase] = useState<number>(0);
  const [isDragging, setIsDragging] = useState<boolean>(false);

  // Subtle pulsing animation loop for active hazard markers
  useEffect(() => {
    let animId: number;
    const start = performance.now();
    const animate = (time: number) => {
      const elapsed = (time - start) / 1000;
      setPulsePhase(Math.sin(elapsed * 3.8) * 0.5 + 0.5); // 0 to 1 smooth oscillation
      animId = requestAnimationFrame(animate);
    };
    animId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animId);
  }, []);

  // Placed elements on the active floor plan
  const rooms = useMemo(() => (floorPlan?.rooms ? Object.values(floorPlan.rooms) : []), [floorPlan]);
  const doors = useMemo(() => (floorPlan?.doors ? Object.values(floorPlan.doors) : []), [floorPlan]);
  const floorMarkers = useMemo(() => (floorPlan?.cameras ? Object.values(floorPlan.cameras) : []), [floorPlan]);

  // Auto-fit framing: scales and centers the entire blueprint sheet in the viewport
  const fitToBounds = useCallback(() => {
    if (!containerRef.current) return;
    const containerW = containerRef.current.clientWidth;
    const containerH = containerRef.current.clientHeight;
    if (containerW <= 50 || containerH <= 50) return;

    // Scale entire 1000x660 blueprint canvas so it comfortably fits within the viewport with equal margins
    const scaleW = (containerW * 0.94) / CANVAS_W;
    const scaleH = (containerH * 0.94) / CANVAS_H;
    const fitScale = Math.max(0.35, Math.min(2.5, Math.min(scaleW, scaleH)));

    // Center the entire sheet (origin 0,0 to CANVAS_W, CANVAS_H) with equal margins on all sides
    const posX = (containerW - CANVAS_W * fitScale) / 2;
    const posY = (containerH - CANVAS_H * fitScale) / 2;

    setStageScale(fitScale);
    setStagePos({ x: posX, y: posY });
  }, []);

  // Auto-fit on initial load, container resize, or when floorPlan loads
  useEffect(() => {
    fitToBounds();
    const ro = new ResizeObserver(() => fitToBounds());
    if (containerRef.current) ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, [fitToBounds, floorPlan]);

  // Map camera states and active incidents per camera
  const cameraStatusMap = useMemo(() => {
    const map = new Map<
      string,
      {
        isCurrentlyDetected: boolean;
        detectionType: string | null;
        activeIncidents: IncidentRecord[];
        allIncidents: IncidentRecord[];
        detectionState: CameraDetectionState | null;
        latestIncident: IncidentRecord | null;
        isStale: boolean;
      }
    >();

    const now = Date.now();

    for (const cam of cameras) {
      const state = cameraDetectionStates[cam.cameraId] || null;
      let isStale = false;
      if (state && state.updatedAt) {
        const diffMs = now - new Date(state.updatedAt).getTime();
        // Considered stale if no update for > 45 seconds
        if (diffMs > 45000) {
          isStale = true;
        }
      }

      // Filter active DETECTED incidents for this camera (sorted most recent first)
      const camIncidents = incidents
        .filter((i) => i.cameraId === cam.cameraId)
        .sort((a, b) => new Date(b.detectedAt || b.createdAt).getTime() - new Date(a.detectedAt || a.createdAt).getTime());
      const activeDetected = camIncidents.filter((i) => i.status === 'DETECTED');
      const latestInc = camIncidents[0] || null;

      // Continuous monitoring real-time state:
      // 1. If detectionState is available and fresh (<45s):
      //    Follow real-time presence (isCurrentlyDetected: true = hazard, false = normal/clear).
      // 2. If state is absent or stale, check if active DETECTED incident exists.
      let isCurrentlyDetected = false;
      let detType: string | null = null;

      if (state && !isStale) {
        isCurrentlyDetected = Boolean(state.isCurrentlyDetected);
        detType = isCurrentlyDetected ? (state.detectionType || activeDetected[0]?.detectionType || 'fire') : null;
      } else if (state && isStale) {
        // Stale state: camera worker stopped or offline -> show normal unless active incident
        isCurrentlyDetected = state.isCurrentlyDetected && activeDetected.length > 0;
        detType = isCurrentlyDetected ? (state.detectionType || 'fire') : null;
      } else {
        // Fallback when detectionState is absent (unit tests or initial mock)
        isCurrentlyDetected = activeDetected.length > 0;
        detType = activeDetected[0]?.detectionType || null;
      }

      map.set(cam.cameraId, {
        isCurrentlyDetected,
        detectionType: detType,
        activeIncidents: activeDetected,
        allIncidents: camIncidents,
        detectionState: state,
        latestIncident: latestInc,
        isStale,
      });
    }

    return map;
  }, [cameras, cameraDetectionStates, incidents]);

  // Selected camera details for contextual popup
  const selectedCamera = useMemo(() => {
    if (!selectedCameraId) return null;
    return cameras.find((c) => c.cameraId === selectedCameraId) || null;
  }, [selectedCameraId, cameras]);

  const selectedStatus = useMemo(() => {
    if (!selectedCamera) return null;
    return cameraStatusMap.get(selectedCamera.cameraId) || null;
  }, [selectedCamera, cameraStatusMap]);

  // Active hazards list
  const activeHazardCameras = useMemo(() => {
    const list: CameraRecord[] = [];
    for (const cam of cameras) {
      if (cameraStatusMap.get(cam.cameraId)?.isCurrentlyDetected) {
        list.push(cam);
      }
    }
    return list;
  }, [cameras, cameraStatusMap]);

  const activeHazardsCount = activeHazardCameras.length;

  // Zoom controls
  const handleZoom = (direction: 'in' | 'out') => {
    const factor = direction === 'in' ? 1.25 : 0.8;
    const nextScale = Math.max(0.3, Math.min(4.5, stageScale * factor));
    if (!containerRef.current) return;
    const containerW = containerRef.current.clientWidth;
    const containerH = containerRef.current.clientHeight;

    // Zoom centered on stage center
    const centerX = containerW / 2;
    const centerY = containerH / 2;
    const nextX = centerX - (centerX - stagePos.x) * (nextScale / stageScale);
    const nextY = centerY - (centerY - stagePos.y) * (nextScale / stageScale);

    setStageScale(nextScale);
    setStagePos({ x: nextX, y: nextY });
  };

  // Center on active fire / hazard camera
  const focusOnHazard = useCallback(() => {
    if (activeHazardCameras.length === 0 || !containerRef.current) return;
    const targetCam = activeHazardCameras[0];
    const cx = targetCam.x ?? floorPlan?.cameras?.[targetCam.cameraId]?.x;
    const cy = targetCam.y ?? floorPlan?.cameras?.[targetCam.cameraId]?.y;
    if (cx === null || cx === undefined || cy === null || cy === undefined) return;

    const containerW = containerRef.current.clientWidth;
    const containerH = containerRef.current.clientHeight;
    const pixelX = cx * CANVAS_W;
    const pixelY = cy * CANVAS_H;

    const targetScale = 2.4; // Zoom close to hazard
    const posX = containerW / 2 - pixelX * targetScale;
    const posY = containerH / 2 - pixelY * targetScale;

    setStageScale(targetScale);
    setStagePos({ x: posX, y: posY });
    onSelectCamera(targetCam.cameraId);
  }, [activeHazardCameras, floorPlan, onSelectCamera]);

  // Mouse wheel zoom
  const handleWheel = (e: any) => {
    e.evt.preventDefault();
    const scaleBy = 1.08;
    const oldScale = stageScale;
    const stage = stageRef.current;
    if (!stage) return;

    const pointer = stage.getPointerPosition();
    if (!pointer) return;

    const mousePointTo = {
      x: (pointer.x - stagePos.x) / oldScale,
      y: (pointer.y - stagePos.y) / oldScale,
    };

    const newScale = e.evt.deltaY < 0 ? oldScale * scaleBy : oldScale / scaleBy;
    const clampedScale = Math.max(0.35, Math.min(4.5, newScale));

    setStageScale(clampedScale);
    setStagePos({
      x: pointer.x - mousePointTo.x * clampedScale,
      y: pointer.y - mousePointTo.y * clampedScale,
    });
  };

  const hasFloorPlan = Boolean(floorPlan && (rooms.length > 0 || doors.length > 0 || floorMarkers.length > 0));

  // Timescale observations array for selected incident
  const selectedObservations = useMemo(() => {
    if (!selectedStatus?.latestIncident?.observations) return [];
    const obs = selectedStatus.latestIncident.observations;
    return Array.isArray(obs) ? obs : Object.values(obs);
  }, [selectedStatus]);

  return (
    <div className="w-full h-full flex flex-col bg-white rounded-xl overflow-hidden relative select-none">
      {/* 1. Sleek Compact Header Bar */}
      <div className="px-4 py-2.5 bg-slate-50/90 border-b border-slate-200 flex items-center justify-between gap-3 shrink-0 flex-wrap">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-blue-50 border border-blue-200 text-blue-600 flex items-center justify-center shrink-0">
            <Compass className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="text-xs font-bold text-slate-800 truncate">
                Mall Situation Blueprint &bull; {floorPlan?.floorName || 'Ground Floor'}
              </h3>
              {activeHazardsCount > 0 ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-red-600 text-white animate-pulse shadow-xs">
                  <Flame className="w-3 h-3 animate-bounce" />
                  {activeHazardsCount} Active Hazard{activeHazardsCount > 1 ? 's' : ''} Detected
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <ShieldCheck className="w-3 h-3 text-emerald-600" />
                  All Cameras Normal
                </span>
              )}
            </div>
            <p className="text-[10px] text-slate-500 truncate">
              Drag to pan &bull; Scroll or use buttons to zoom &bull; Click any camera to view live feed &amp; telemetry
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* Multi-floor selector */}
          {availableFloors.length > 1 && onSelectFloor && (
            <select
              value={selectedFloorId}
              onChange={(e) => onSelectFloor(e.target.value)}
              className="h-7 rounded-md border border-slate-200 bg-white px-2.5 text-[11px] font-semibold text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer shadow-xs"
            >
              {availableFloors.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          )}

          {onNavigateToFloorPlan && (
            <Button
              variant="outline"
              size="sm"
              onClick={onNavigateToFloorPlan}
              className="h-7 px-2.5 text-[11px] text-slate-600 hover:text-slate-900 border-slate-200"
              title="Open Floor Plan Editor"
            >
              <Layers className="w-3 h-3 mr-1 text-blue-600" />
              Edit Blueprint
            </Button>
          )}
        </div>
      </div>

      {/* 2. Main Blueprint Canvas Area */}
      <div
        ref={containerRef}
        className={`flex-1 min-h-0 w-full overflow-hidden bg-slate-900/5 relative ${
          isDragging ? 'cursor-grabbing' : 'cursor-grab'
        }`}
      >
        {!hasFloorPlan ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center">
            <div className="w-14 h-14 rounded-2xl bg-white shadow-xs border border-slate-200 text-slate-400 flex items-center justify-center mb-3">
              <Compass className="w-7 h-7 text-slate-400" />
            </div>
            <h4 className="text-sm font-bold text-slate-800">Floor Plan Not Configured</h4>
            <p className="text-xs text-slate-500 mt-1 max-w-sm leading-relaxed">
              No architectural layout is mapped for this floor. Open Floor Planning to draw rooms, corridors, and assign surveillance cameras.
            </p>
            {onNavigateToFloorPlan && (
              <Button
                size="sm"
                onClick={onNavigateToFloorPlan}
                className="mt-3.5 bg-blue-600 hover:bg-blue-700 text-white text-xs h-8 px-4"
              >
                Configure Floor Plan
              </Button>
            )}
          </div>
        ) : (
          <>
            <Stage
              ref={stageRef}
              width={containerRef.current?.clientWidth || 800}
              height={containerRef.current?.clientHeight || 600}
              scaleX={stageScale}
              scaleY={stageScale}
              x={stagePos.x}
              y={stagePos.y}
              draggable={true}
              onDragStart={() => setIsDragging(true)}
              onDragEnd={(e) => {
                setIsDragging(false);
                setStagePos({ x: e.target.x(), y: e.target.y() });
              }}
              onWheel={handleWheel}
              onClick={(e) => {
                // Click outside elements to deselect
                if (e.target === e.target.getStage()) {
                  onSelectCamera(null);
                }
              }}
            >
              {/* Floor Plan Architectural Canvas Background */}
              <Layer listening={false}>
                {/* Clean Canvas Card */}
                <Rect
                  x={0}
                  y={0}
                  width={CANVAS_W}
                  height={CANVAS_H}
                  fill="#ffffff"
                  stroke="#cbd5e1"
                  strokeWidth={1.5}
                  cornerRadius={10}
                  shadowColor="#0f172a"
                  shadowBlur={18}
                  shadowOpacity={0.06}
                  shadowOffset={{ x: 0, y: 4 }}
                />

                {/* Architectural Blueprint Grid Pattern */}
                {Array.from({ length: Math.floor(CANVAS_W / GRID_SIZE) + 1 }).map((_, i) => (
                  <Line
                    key={`v_${i}`}
                    points={[i * GRID_SIZE, 0, i * GRID_SIZE, CANVAS_H]}
                    stroke="#f1f5f9"
                    strokeWidth={0.7}
                  />
                ))}
                {Array.from({ length: Math.floor(CANVAS_H / GRID_SIZE) + 1 }).map((_, i) => (
                  <Line
                    key={`h_${i}`}
                    points={[0, i * GRID_SIZE, CANVAS_W, i * GRID_SIZE]}
                    stroke="#f1f5f9"
                    strokeWidth={0.7}
                  />
                ))}
              </Layer>

              {/* Architectural Rooms Layer */}
              <Layer>
                {rooms.map((room) => {
                  const rx = toPx(room.x, CANVAS_W);
                  const ry = toPx(room.y, CANVAS_H);
                  const rw = toPx(room.width, CANVAS_W);
                  const rh = toPx(room.height, CANVAS_H);
                  const styles = ROOM_STYLES[room.type] || ROOM_STYLES.room;

                  return (
                    <Group key={room.roomId} listening={false}>
                      <Rect
                        x={rx}
                        y={ry}
                        width={rw}
                        height={rh}
                        fill={room.fill || styles.fill}
                        stroke={room.stroke || styles.stroke}
                        strokeWidth={1.4}
                        cornerRadius={4}
                      />

                      {/* Stairwell hatch lines */}
                      {room.type === 'stairwell' &&
                        [0.3, 0.5, 0.7].map((frac, idx) => (
                          <Line
                            key={idx}
                            points={[rx + 6, ry + rh * frac, rx + rw - 6, ry + rh * frac]}
                            stroke="#a855f7"
                            strokeWidth={1.5}
                            dash={[3, 2]}
                          />
                        ))}

                      {/* Room name label */}
                      <Text
                        x={rx + 7}
                        y={ry + 7}
                        text={room.name}
                        fontSize={11}
                        fontFamily="sans-serif"
                        fontStyle="bold"
                        fill="#0f172a"
                      />

                      {/* Category label */}
                      <Text
                        x={rx + 7}
                        y={ry + 22}
                        text={room.type === 'room' ? 'Shop' : styles.label}
                        fontSize={9}
                        fontFamily="sans-serif"
                        fill="#64748b"
                      />
                    </Group>
                  );
                })}

                {/* Doors Layer */}
                {doors.map((door) => {
                  const dx = toPx(door.x, CANVAS_W);
                  const dy = toPx(door.y, CANVAS_H);
                  const doorConfig = DOOR_COLORS[door.type] || DOOR_COLORS.shop_door;
                  const isShopDoor = door.type === 'shop_door' || door.type === 'internal';

                  return (
                    <Group key={door.doorId} x={dx} y={dy} listening={false}>
                      {isShopDoor ? (
                        <Rect
                          x={-10}
                          y={-5}
                          width={20}
                          height={10}
                          fill={doorConfig.fill}
                          stroke="#ffffff"
                          strokeWidth={1.2}
                          cornerRadius={2}
                        />
                      ) : (
                        <Rect
                          x={-8}
                          y={-8}
                          width={16}
                          height={16}
                          fill={doorConfig.fill}
                          stroke="#ffffff"
                          strokeWidth={1.2}
                          rotation={45}
                          cornerRadius={2}
                        />
                      )}
                    </Group>
                  );
                })}

                {/* Cameras Layer */}
                {cameras.map((cam) => {
                  let cx: number | null = null;
                  let cy: number | null = null;

                  if (cam.x !== null && cam.x !== undefined && cam.y !== null && cam.y !== undefined) {
                    cx = toPx(cam.x, CANVAS_W);
                    cy = toPx(cam.y, CANVAS_H);
                  } else {
                    const marker = floorPlan?.cameras?.[cam.cameraId];
                    if (marker && marker.x !== undefined && marker.y !== undefined) {
                      cx = toPx(marker.x, CANVAS_W);
                      cy = toPx(marker.y, CANVAS_H);
                    }
                  }

                  if (cx === null || cy === null) return null;

                  const statusInfo = cameraStatusMap.get(cam.cameraId);
                  const isHazard = statusInfo?.isCurrentlyDetected === true;
                  const isSelected = selectedCameraId === cam.cameraId;
                  const detType = (statusInfo?.detectionType || 'fire').toUpperCase();

                  // Pulsing radar animation
                  const pulseRadius1 = 12 + pulsePhase * 16;
                  const pulseOpacity1 = 0.7 - pulsePhase * 0.6;
                  const pulseRadius2 = 12 + ((pulsePhase + 0.5) % 1) * 16;
                  const pulseOpacity2 = 0.7 - ((pulsePhase + 0.5) % 1) * 0.6;

                  return (
                    <Group
                      key={cam.cameraId}
                      x={cx}
                      y={cy}
                      onClick={(e) => {
                        e.cancelBubble = true;
                        onSelectCamera(cam.cameraId);
                      }}
                      onTap={(e) => {
                        e.cancelBubble = true;
                        onSelectCamera(cam.cameraId);
                      }}
                    >
                      {/* Active Hazard: Dual Concentric Pulsing Radar Rings */}
                      {isHazard && (
                        <>
                          <Circle
                            radius={pulseRadius1}
                            stroke="#ef4444"
                            strokeWidth={2}
                            fill="#fee2e2"
                            opacity={pulseOpacity1}
                            listening={false}
                          />
                          <Circle
                            radius={pulseRadius2}
                            stroke="#dc2626"
                            strokeWidth={1.5}
                            opacity={pulseOpacity2}
                            listening={false}
                          />
                        </>
                      )}

                      {/* Camera Outer Circle */}
                      <Circle
                        radius={12}
                        fill={isHazard ? '#fee2e2' : isSelected ? '#dbeafe' : '#ffffff'}
                        stroke={isHazard ? '#dc2626' : isSelected ? '#1d4ed8' : '#2563eb'}
                        strokeWidth={isHazard || isSelected ? 3 : 1.8}
                        shadowColor={isHazard ? '#ef4444' : '#2563eb'}
                        shadowBlur={isHazard ? 8 : 4}
                        shadowOpacity={0.3}
                      />

                      {/* Camera Center Core */}
                      <Circle
                        radius={5.5}
                        fill={isHazard ? '#dc2626' : isSelected ? '#1d4ed8' : '#2563eb'}
                      />

                      {/* Camera Name Tag */}
                      <Text
                        x={-30}
                        y={15}
                        text={cam.name}
                        fontSize={9.5}
                        fontFamily="sans-serif"
                        fontStyle="bold"
                        fill={isHazard ? '#991b1b' : '#1e3a8a'}
                        listening={false}
                      />

                      {/* Active Hazard Banner Pill */}
                      {isHazard && (
                        <Group y={-26}>
                          <Rect
                            x={-30}
                            y={0}
                            width={60}
                            height={16}
                            fill="#dc2626"
                            cornerRadius={4}
                            shadowColor="#000"
                            shadowBlur={4}
                            shadowOpacity={0.25}
                          />
                          <Text
                            x={-27}
                            y={3}
                            text={`🔥 ${detType}`}
                            fontSize={8.5}
                            fontFamily="sans-serif"
                            fontStyle="bold"
                            fill="#ffffff"
                          />
                        </Group>
                      )}
                    </Group>
                  );
                })}
              </Layer>
            </Stage>

            {/* 3. Floating Interactive Zoom & Focus Controls (Top-Left of Canvas) */}
            <div className="absolute top-3 left-3 z-20 flex items-center gap-1 bg-white/95 backdrop-blur-md p-1 rounded-xl border border-slate-200/90 shadow-md">
              <button
                type="button"
                onClick={() => handleZoom('in')}
                className="w-7 h-7 rounded-lg text-slate-700 hover:bg-slate-100 flex items-center justify-center transition-colors"
                title="Zoom In (+)"
              >
                <ZoomIn className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => handleZoom('out')}
                className="w-7 h-7 rounded-lg text-slate-700 hover:bg-slate-100 flex items-center justify-center transition-colors"
                title="Zoom Out (-)"
              >
                <ZoomOut className="w-4 h-4" />
              </button>
              <div className="w-[1px] h-4 bg-slate-200 my-auto" />
              <button
                type="button"
                onClick={fitToBounds}
                className="h-7 px-2.5 rounded-lg text-slate-700 hover:bg-slate-100 flex items-center gap-1 text-[11px] font-semibold transition-colors"
                title="Fit blueprint to screen"
              >
                <Maximize2 className="w-3.5 h-3.5 text-blue-600" />
                <span>Fit Screen</span>
              </button>

              {activeHazardsCount > 0 && (
                <>
                  <div className="w-[1px] h-4 bg-slate-200 my-auto" />
                  <button
                    type="button"
                    onClick={focusOnHazard}
                    className="h-7 px-2.5 rounded-lg bg-red-600 hover:bg-red-700 text-white flex items-center gap-1 text-[11px] font-bold shadow-xs animate-pulse transition-colors"
                    title="Center on active fire hazard"
                  >
                    <Flame className="w-3.5 h-3.5" />
                    <span>Focus Hazard</span>
                  </button>
                </>
              )}
            </div>

            {/* 4. Contextual Telemetry & Detail Drawer when Marker is Clicked */}
            {selectedCamera && (
              <div className="absolute top-3 right-3 z-30 max-w-sm w-full bg-white/95 backdrop-blur-md rounded-2xl border border-slate-200 shadow-2xl p-4 space-y-3 animate-in fade-in slide-in-from-right-4 duration-200">
                <div className="flex items-start justify-between gap-2 pb-2.5 border-b border-slate-100">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="text-sm font-bold text-slate-900 truncate" title={selectedCamera.name}>
                        {selectedCamera.name}
                      </h4>
                      {selectedStatus?.isCurrentlyDetected ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-600 text-white animate-pulse">
                          <Flame className="w-3 h-3" />
                          ACTIVE {selectedStatus.detectionType?.toUpperCase()}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <ShieldCheck className="w-3 h-3 text-emerald-600" />
                          Clear / Normal
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] font-mono text-slate-400 mt-0.5">{selectedCamera.cameraId}</p>
                  </div>

                  <button
                    type="button"
                    onClick={() => onSelectCamera(null)}
                    className="w-6 h-6 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 flex items-center justify-center shrink-0"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="space-y-2 text-xs text-slate-600">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400 flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-slate-400" /> Room / Area:
                    </span>
                    <span className="font-semibold text-slate-800 truncate max-w-[170px]">
                      {selectedCamera.roomName || 'Corridor Walkway'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-slate-400 flex items-center gap-1.5">
                      <Layers className="w-3.5 h-3.5 text-slate-400" /> Floor Level:
                    </span>
                    <span className="font-medium text-slate-700">
                      {selectedCamera.floorName || selectedCamera.floorId}
                    </span>
                  </div>

                  {selectedStatus?.isCurrentlyDetected ? (
                    <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-900 space-y-1.5">
                      <div className="flex items-center justify-between font-bold text-xs">
                        <span className="flex items-center gap-1">
                          <Radio className="w-3.5 h-3.5 text-red-600 animate-pulse" /> Live Hazard:
                        </span>
                        <span className="uppercase text-red-600 font-extrabold">{selectedStatus.detectionType || 'Fire'}</span>
                      </div>
                      {selectedStatus.detectionState?.lastDetectedAt && (
                        <div className="flex items-center justify-between text-[11px] text-red-700 font-mono">
                          <span>Latest Frame:</span>
                          <span>{formatDateTime(selectedStatus.detectionState.lastDetectedAt)}</span>
                        </div>
                      )}
                      {selectedStatus.activeIncidents.length > 0 && (
                        <div className="flex items-center justify-between text-[11px] text-red-700 font-mono">
                          <span>Incident ID:</span>
                          <span className="font-bold">{selectedStatus.activeIncidents[0].incidentId}</span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="p-2.5 rounded-xl bg-emerald-50/80 border border-emerald-200 text-emerald-900 space-y-1 text-xs">
                      <div className="flex items-center justify-between font-bold text-[11px]">
                        <span className="flex items-center gap-1 text-emerald-700">
                          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" /> Surveillance Status:
                        </span>
                        <span className="text-emerald-700 font-extrabold">ALL CLEAR / SAFE</span>
                      </div>
                      {selectedStatus?.detectionState?.updatedAt && (
                        <div className="flex items-center justify-between text-[10px] text-emerald-600 font-mono">
                          <span>Latest Scan:</span>
                          <span>{formatDateTime(selectedStatus.detectionState.updatedAt)}</span>
                        </div>
                      )}
                      {selectedStatus?.latestIncident?.status === 'RESOLVED' && (
                        <div className="flex items-center justify-between text-[10px] text-emerald-700 font-mono">
                          <span>Recent Incident:</span>
                          <span className="font-semibold text-emerald-800">Auto-Resolved (Fire Cleared)</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Evidence & Observation Snaps Track */}
                  {selectedObservations.length > 0 && (
                    <div className="pt-2 border-t border-slate-100 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-slate-700 flex items-center gap-1">
                          <Camera className="w-3.5 h-3.5 text-blue-600" />
                          Surveillance Snaps ({selectedObservations.length})
                        </span>
                        {selectedStatus?.latestIncident && onInspectIncident && (
                          <button
                            type="button"
                            onClick={() => onInspectIncident(selectedStatus.latestIncident!)}
                            className="text-[10px] text-blue-600 hover:text-blue-800 font-semibold cursor-pointer"
                          >
                            Inspect Full Timeline &rarr;
                          </button>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-1.5 max-h-36 overflow-y-auto pr-0.5">
                        {selectedObservations.map((obs, idx) => {
                          const isSafe = obs.detectionType === 'normal' || obs.note?.toLowerCase().includes('conclud') || obs.note?.toLowerCase().includes('extinguish');
                          const isBreakout = idx === 0 && !isSafe;

                          return (
                            <div
                              key={obs.observationId || idx}
                              onClick={() => {
                                if (selectedStatus?.latestIncident && onInspectIncident) {
                                  onInspectIncident(selectedStatus.latestIncident);
                                }
                              }}
                              className={`p-1.5 rounded-lg border text-left cursor-pointer transition hover:shadow-xs ${
                                isSafe
                                  ? 'bg-emerald-50/70 border-emerald-200 hover:bg-emerald-50'
                                  : isBreakout
                                  ? 'bg-red-50/70 border-red-200 hover:bg-red-50'
                                  : 'bg-amber-50/70 border-amber-200 hover:bg-amber-50'
                              }`}
                            >
                              <div className="flex items-center justify-between gap-1">
                                <span
                                  className={`text-[9px] font-bold px-1 py-0.2 rounded ${
                                    isSafe
                                      ? 'bg-emerald-200/80 text-emerald-800'
                                      : isBreakout
                                      ? 'bg-red-200/80 text-red-800'
                                      : 'bg-amber-200/80 text-amber-800'
                                  }`}
                                >
                                  {isSafe ? '✓ All Clear' : isBreakout ? '🚨 Fire' : `#${obs.observationIndex || idx + 1}`}
                                </span>
                                <span className="text-[9px] text-slate-500 font-mono">
                                  {obs.timeFormatted || (obs.observedAt ? new Date(obs.observedAt).toLocaleTimeString() : '')}
                                </span>
                              </div>
                              <p className="text-[10px] text-slate-700 font-medium truncate mt-1">
                                {isSafe ? 'Normal / Clear Snap' : `${(obs.detectionType || 'Hazard').toUpperCase()} Snap`}
                              </p>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                <Button
                  size="sm"
                  onClick={() => onViewCameraFeed(selectedCamera)}
                  className={`w-full text-xs h-8 font-bold cursor-pointer ${
                    selectedStatus?.isCurrentlyDetected
                      ? 'bg-red-600 hover:bg-red-700 text-white shadow-sm'
                      : 'bg-blue-600 hover:bg-blue-700 text-white'
                  }`}
                >
                  <Play className="w-3.5 h-3.5 mr-1.5" />
                  Open CCTV Live Feed
                </Button>
              </div>
            )}
          </>
        )}
      </div>

      {/* 5. Bottom Architectural Legend Bar */}
      <div className="px-4 py-2 bg-white border-t border-slate-200/90 flex items-center justify-between text-xs text-slate-500 shrink-0 select-none flex-wrap gap-2">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5 font-medium text-slate-600 text-[11px]">
            <span className="w-3 h-3 rounded-full border-2 border-blue-600 bg-white" />
            Normal CCTV Surveillance
          </span>
          <span className="flex items-center gap-1.5 font-bold text-red-600 text-[11px]">
            <span className="w-3 h-3 rounded-full border-2 border-red-600 bg-red-100 animate-pulse" />
            Active Fire / Smoke Incident
          </span>
        </div>
        <div className="text-slate-400 font-mono text-[11px]">
          {floorMarkers.length} Mapped on Blueprint &bull; {cameras.length} Total Monitored
        </div>
      </div>
    </div>
  );
};
