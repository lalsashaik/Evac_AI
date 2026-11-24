import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Stage, Layer, Rect, Group, Text, Circle, Line, Transformer } from 'react-konva';
import Konva from 'konva';
import {
  FloorRoom,
  FloorDoor,
  FloorCameraMarker,
  FloorPlan,
  SelectedElement,
  EditorTool,
  ROOM_STYLES,
  DOOR_COLORS,
  RoomType,
  DoorType,
} from '@/types/floorplan';

// ─── Constants ────────────────────────────────────────────────────────────────

/** Reference canvas dimensions. Positions stored normalized (0–1). */
const CANVAS_W = 1000;
const CANVAS_H = 660;
const GRID_SIZE = 20;

// ─── Helper utilities ─────────────────────────────────────────────────────────

function snapToGrid(val: number): number {
  return Math.round(val / GRID_SIZE) * GRID_SIZE;
}

function uid(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`;
}

function toNorm(px: number, total: number): number {
  return Math.max(0, Math.min(1, px / total));
}

function toPx(norm: number, total: number): number {
  return norm * total;
}

// ─── Sub-component: Grid ──────────────────────────────────────────────────────

function GridLines({ w, h }: { w: number; h: number }) {
  const lines: React.ReactNode[] = [];
  for (let x = 0; x <= w; x += GRID_SIZE) {
    lines.push(
      <Line key={`vl${x}`} points={[x, 0, x, h]} stroke="#f1f5f9" strokeWidth={0.8} listening={false} />
    );
  }
  for (let y = 0; y <= h; y += GRID_SIZE) {
    lines.push(
      <Line key={`hl${y}`} points={[0, y, w, y]} stroke="#f1f5f9" strokeWidth={0.8} listening={false} />
    );
  }
  return <>{lines}</>;
}

// ─── Sub-component: Room Shape ────────────────────────────────────────────────

interface RoomShapeProps {
  room: FloorRoom;
  isSelected: boolean;
  tool: EditorTool;
  onSelect: () => void;
  onChange: (updates: Partial<FloorRoom>) => void;
}

function RoomShape({ room, isSelected, tool, onSelect, onChange }: RoomShapeProps) {
  const shapeRef = useRef<Konva.Rect>(null);
  const trRef = useRef<Konva.Transformer>(null);
  const px = toPx(room.x, CANVAS_W);
  const py = toPx(room.y, CANVAS_H);
  const pw = toPx(room.width, CANVAS_W);
  const ph = toPx(room.height, CANVAS_H);

  useEffect(() => {
    if (isSelected && trRef.current && shapeRef.current) {
      trRef.current.nodes([shapeRef.current]);
      trRef.current.getLayer()?.batchDraw();
    }
  }, [isSelected]);

  const draggable = tool === 'select';
  const styles = ROOM_STYLES[room.type] || ROOM_STYLES.room;

  return (
    <Group>
      <Rect
        ref={shapeRef}
        x={px}
        y={py}
        width={pw}
        height={ph}
        fill={room.fill || styles.fill}
        stroke={isSelected ? '#2563eb' : (room.stroke || styles.stroke)}
        strokeWidth={isSelected ? 2.5 : 1.5}
        cornerRadius={3}
        draggable={draggable}
        onClick={(e) => {
          e.cancelBubble = true;
          onSelect();
        }}
        onTap={(e) => {
          e.cancelBubble = true;
          onSelect();
        }}
        onDragEnd={(e) => {
          const nx = toNorm(snapToGrid(e.target.x()), CANVAS_W);
          const ny = toNorm(snapToGrid(e.target.y()), CANVAS_H);
          onChange({ x: nx, y: ny });
        }}
        onTransformEnd={() => {
          const node = shapeRef.current;
          if (!node) return;
          const scaleX = node.scaleX();
          const scaleY = node.scaleY();
          node.scaleX(1);
          node.scaleY(1);

          const newW = snapToGrid(Math.max(40, node.width() * scaleX));
          const newH = snapToGrid(Math.max(30, node.height() * scaleY));
          const newX = snapToGrid(node.x());
          const newY = snapToGrid(node.y());

          onChange({
            x: toNorm(newX, CANVAS_W),
            y: toNorm(newY, CANVAS_H),
            width: toNorm(newW, CANVAS_W),
            height: toNorm(newH, CANVAS_H),
          });
        }}
      />

      {/* Decorative inner elements for stairs and elevators */}
      {room.type === 'stairwell' && (
        <Group listening={false}>
          {[0.3, 0.5, 0.7].map((frac, i) => (
            <Line
              key={i}
              points={[px + 8, py + ph * frac, px + pw - 8, py + ph * frac]}
              stroke="#a855f7"
              strokeWidth={1.5}
              dash={[3, 2]}
            />
          ))}
        </Group>
      )}

      {/* Room Name Label */}
      <Text
        x={px + 6}
        y={py + 6}
        text={room.name}
        fontSize={11}
        fontFamily="sans-serif"
        fontStyle="bold"
        fill="#1e293b"
        listening={false}
      />

      {/* Category sub-label */}
      <Text
        x={px + 6}
        y={py + 20}
        text={room.type === 'room' ? 'Shop' : styles.label}
        fontSize={9}
        fontFamily="sans-serif"
        fill="#64748b"
        listening={false}
      />

      {isSelected && (
        <Transformer
          ref={trRef}
          boundBoxFunc={(oldBox, newBox) => {
            if (newBox.width < 40 || newBox.height < 30) return oldBox;
            return newBox;
          }}
          rotateEnabled={false}
          anchorFill="#ffffff"
          anchorStroke="#2563eb"
          anchorSize={8}
          borderStroke="#2563eb"
        />
      )}
    </Group>
  );
}

// ─── Sub-component: Door Shape ────────────────────────────────────────────────

interface DoorShapeProps {
  door: FloorDoor;
  isSelected: boolean;
  tool: EditorTool;
  onSelect: () => void;
  onChange: (updates: Partial<FloorDoor>) => void;
}

function DoorShape({ door, isSelected, tool, onSelect, onChange }: DoorShapeProps) {
  const px = toPx(door.x, CANVAS_W);
  const py = toPx(door.y, CANVAS_H);
  const doorConfig = DOOR_COLORS[door.type] || DOOR_COLORS.shop_door;
  const isShopDoor = door.type === 'shop_door' || door.type === 'internal';
  const isEmergency = door.type === 'emergency_exit' || door.type === 'exit';
  const draggable = tool === 'select';

  return (
    <Group
      x={px}
      y={py}
      draggable={draggable}
      onClick={(e) => {
        e.cancelBubble = true;
        onSelect();
      }}
      onTap={(e) => {
        e.cancelBubble = true;
        onSelect();
      }}
      onDragEnd={(e) => {
        onChange({
          x: toNorm(snapToGrid(e.target.x()), CANVAS_W),
          y: toNorm(snapToGrid(e.target.y()), CANVAS_H),
        });
      }}
    >
      {/* Visual marker: diamond for mall exit/emergency, rectangular portal for shop doors */}
      {isShopDoor ? (
        <Rect
          x={-10}
          y={-6}
          width={20}
          height={12}
          fill={doorConfig.fill}
          stroke={isSelected ? '#1e293b' : '#ffffff'}
          strokeWidth={isSelected ? 2 : 1}
          cornerRadius={2}
        />
      ) : (
        <Rect
          x={-8}
          y={-8}
          width={16}
          height={16}
          fill={doorConfig.fill}
          stroke={isSelected ? '#1e293b' : '#ffffff'}
          strokeWidth={isSelected ? 2 : 1}
          rotation={45}
          cornerRadius={2}
        />
      )}

      {/* Label */}
      <Text
        x={-24}
        y={10}
        text={door.label || (isEmergency ? 'Emergency Exit' : isShopDoor ? 'Shop Entry' : 'Main Entry/Exit')}
        fontSize={9}
        fontFamily="sans-serif"
        fontStyle="bold"
        fill={doorConfig.fill}
        listening={false}
      />
    </Group>
  );
}

// ─── Sub-component: Camera Marker ─────────────────────────────────────────────

interface CameraMarkerProps {
  camera: FloorCameraMarker;
  isSelected: boolean;
  tool: EditorTool;
  onSelect: () => void;
  onChange: (updates: Partial<FloorCameraMarker>) => void;
}

function CameraMarker({ camera, isSelected, tool, onSelect, onChange }: CameraMarkerProps) {
  const px = toPx(camera.x, CANVAS_W);
  const py = toPx(camera.y, CANVAS_H);
  const draggable = tool === 'select';

  return (
    <Group
      x={px}
      y={py}
      draggable={draggable}
      onClick={(e) => {
        e.cancelBubble = true;
        onSelect();
      }}
      onTap={(e) => {
        e.cancelBubble = true;
        onSelect();
      }}
      onDragEnd={(e) => {
        onChange({
          x: toNorm(snapToGrid(e.target.x()), CANVAS_W),
          y: toNorm(snapToGrid(e.target.y()), CANVAS_H),
        });
      }}
    >
      {/* Outer ring */}
      <Circle
        radius={11}
        fill={isSelected ? '#dbeafe' : '#ffffff'}
        stroke="#2563eb"
        strokeWidth={isSelected ? 2.5 : 1.5}
      />
      {/* Center dot */}
      <Circle radius={5} fill="#2563eb" />
      {/* Camera label */}
      <Text
        x={-20}
        y={13}
        text={camera.name}
        fontSize={9}
        fontFamily="sans-serif"
        fontStyle="bold"
        fill="#1e40af"
        listening={false}
      />
    </Group>
  );
}

// ─── Main FloorPlanCanvas ─────────────────────────────────────────────────────

interface FloorPlanCanvasProps {
  floorPlan: FloorPlan;
  selectedElement: SelectedElement;
  activeTool: EditorTool;
  onSelectElement: (el: SelectedElement) => void;
  onUpdateRoom: (roomId: string, updates: Partial<FloorRoom>) => void;
  onUpdateDoor: (doorId: string, updates: Partial<FloorDoor>) => void;
  onUpdateCamera: (cameraId: string, updates: Partial<FloorCameraMarker>) => void;
  onAddRoom: (room: FloorRoom) => void;
  onAddDoor: (door: FloorDoor) => void;
  onAddCamera: (camera: FloorCameraMarker) => void;
  onDeleteSelected: () => void;
}

export function FloorPlanCanvas({
  floorPlan,
  selectedElement,
  activeTool,
  onSelectElement,
  onUpdateRoom,
  onUpdateDoor,
  onUpdateCamera,
  onAddRoom,
  onAddDoor,
  onAddCamera,
  onDeleteSelected,
}: FloorPlanCanvasProps) {
  const stageContainerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  // Responsive uniform scale fitting both width AND height within available space
  useEffect(() => {
    const update = () => {
      if (stageContainerRef.current) {
        const availW = stageContainerRef.current.clientWidth - 16;
        const availH = stageContainerRef.current.clientHeight - 16;
        if (availW > 20 && availH > 20) {
          const scaleW = availW / CANVAS_W;
          const scaleH = availH / CANVAS_H;
          const fitScale = Math.min(scaleW, scaleH);
          setScale(Math.max(0.2, Math.min(1.5, fitScale)));
        }
      }
    };
    update();
    const ro = new ResizeObserver(update);
    if (stageContainerRef.current) ro.observe(stageContainerRef.current);
    return () => ro.disconnect();
  }, []);

  const handleStageClick = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent>) => {
      const isStageClick = e.target === e.target.getStage();
      if (!isStageClick) return;

      const stage = e.target.getStage()!;
      const pos = stage.getPointerPosition()!;
      const cx = snapToGrid(pos.x / scale);
      const cy = snapToGrid(pos.y / scale);

      if (activeTool === 'select') {
        onSelectElement(null);
        return;
      }

      if (activeTool === 'delete') return;

      // Handle spatial elements
      if (
        activeTool === 'room' ||
        activeTool === 'corridor' ||
        activeTool === 'stairwell' ||
        activeTool === 'elevator'
      ) {
        const type: RoomType = activeTool;
        const styles = ROOM_STYLES[type];
        let defaultW = 120;
        let defaultH = 90;
        let defaultName = 'Shop';

        if (type === 'corridor') {
          defaultW = 180;
          defaultH = 50;
          defaultName = 'Corridor';
        } else if (type === 'stairwell') {
          defaultW = 90;
          defaultH = 90;
          defaultName = 'Stairs';
        } else if (type === 'elevator') {
          defaultW = 70;
          defaultH = 70;
          defaultName = 'Elevator';
        }

        const room: FloorRoom = {
          roomId: uid(type),
          name: defaultName,
          type,
          x: toNorm(cx, CANVAS_W),
          y: toNorm(cy, CANVAS_H),
          width: toNorm(defaultW, CANVAS_W),
          height: toNorm(defaultH, CANVAS_H),
          fill: styles.fill,
          stroke: styles.stroke,
          createdAt: new Date().toISOString(),
        };
        onAddRoom(room);
        onSelectElement({ type: 'room', id: room.roomId });
        return;
      }

      // Handle doors & exits
      if (
        activeTool === 'shop_door' ||
        activeTool === 'main_entry' ||
        activeTool === 'emergency_exit'
      ) {
        const doorType: DoorType = activeTool;
        let defaultLabel = 'Shop Entry';
        if (doorType === 'main_entry') defaultLabel = 'Main Entry / Exit';
        if (doorType === 'emergency_exit') defaultLabel = 'Emergency Exit';

        const door: FloorDoor = {
          doorId: uid('door'),
          type: doorType,
          roomId: '',
          x: toNorm(cx, CANVAS_W),
          y: toNorm(cy, CANVAS_H),
          rotation: 0,
          label: defaultLabel,
          createdAt: new Date().toISOString(),
        };
        onAddDoor(door);
        onSelectElement({ type: 'door', id: door.doorId });
        return;
      }

      if (activeTool === 'camera') {
        const normX = toNorm(cx, CANVAS_W);
        const normY = toNorm(cy, CANVAS_H);

        const allRooms = Object.values(floorPlan.rooms);
        const containingRoom = allRooms.find(
          (r) => normX >= r.x && normX <= r.x + r.width && normY >= r.y && normY <= r.y + r.height
        );
        const camName = containingRoom ? `Cam - ${containingRoom.name}` : `Camera ${Object.keys(floorPlan.cameras).length + 1}`;

        const camera: FloorCameraMarker = {
          cameraId: uid('cam'),
          name: camName,
          roomId: containingRoom ? containingRoom.roomId : null,
          x: normX,
          y: normY,
          rotation: 0,
        };
        onAddCamera(camera);
        onSelectElement({ type: 'camera', id: camera.cameraId });
        return;
      }
    },
    [activeTool, scale, onAddRoom, onAddDoor, onAddCamera, onSelectElement]
  );

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedElement) {
        const tagName = (document.activeElement as HTMLElement)?.tagName;
        if (tagName === 'INPUT' || tagName === 'TEXTAREA') return;
        onDeleteSelected();
      }
    },
    [selectedElement, onDeleteSelected]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const rooms = Object.values(floorPlan.rooms);
  const doors = Object.values(floorPlan.doors);
  const cameras = Object.values(floorPlan.cameras);

  // Distinguish shops from corridors, stairs, elevators
  const shopsCount = rooms.filter((r) => r.type === 'room').length;
  const corridorsCount = rooms.filter((r) => r.type === 'corridor').length;
  const stairsCount = rooms.filter((r) => r.type === 'stairwell').length;
  const elevatorsCount = rooms.filter((r) => r.type === 'elevator').length;

  const cursorMap: Record<EditorTool, string> = {
    select: 'default',
    room: 'crosshair',
    corridor: 'crosshair',
    stairwell: 'crosshair',
    elevator: 'crosshair',
    shop_door: 'crosshair',
    main_entry: 'crosshair',
    emergency_exit: 'crosshair',
    camera: 'crosshair',
    delete: 'not-allowed',
  };

  return (
    <div
      className="w-full h-full min-h-0 flex flex-col overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-xs relative select-none"
      style={{ cursor: cursorMap[activeTool] }}
    >
      {/* Canvas stage center container */}
      <div
        ref={stageContainerRef}
        className="flex-1 min-h-0 w-full flex items-center justify-center overflow-hidden bg-slate-50/70 p-2 relative"
      >
        <Stage
          width={CANVAS_W * scale}
          height={CANVAS_H * scale}
          scaleX={scale}
          scaleY={scale}
          className="shadow-sm rounded border border-slate-200/80 bg-white"
          onClick={handleStageClick}
          onTap={handleStageClick}
        >
          {/* Background grid */}
          <Layer listening={false}>
            <Rect x={0} y={0} width={CANVAS_W} height={CANVAS_H} fill="#ffffff" />
            <GridLines w={CANVAS_W} h={CANVAS_H} />
          </Layer>

          {/* Floor plan elements */}
          <Layer>
            {/* Rooms, Corridors, Stairs, Elevators */}
            {rooms.map((room) => (
              <RoomShape
                key={room.roomId}
                room={room}
                isSelected={selectedElement?.type === 'room' && selectedElement.id === room.roomId}
                tool={activeTool}
                onSelect={() => {
                  if (activeTool === 'delete') {
                    onSelectElement({ type: 'room', id: room.roomId });
                    onDeleteSelected();
                  } else {
                    onSelectElement({ type: 'room', id: room.roomId });
                  }
                }}
                onChange={(updates) => onUpdateRoom(room.roomId, updates)}
              />
            ))}

            {/* Doors & Exits */}
            {doors.map((door) => (
              <DoorShape
                key={door.doorId}
                door={door}
                isSelected={selectedElement?.type === 'door' && selectedElement.id === door.doorId}
                tool={activeTool}
                onSelect={() => {
                  if (activeTool === 'delete') {
                    onSelectElement({ type: 'door', id: door.doorId });
                    onDeleteSelected();
                  } else {
                    onSelectElement({ type: 'door', id: door.doorId });
                  }
                }}
                onChange={(updates) => onUpdateDoor(door.doorId, updates)}
              />
            ))}

            {/* Cameras */}
            {cameras.map((camera) => (
              <CameraMarker
                key={camera.cameraId}
                camera={camera}
                isSelected={selectedElement?.type === 'camera' && selectedElement.id === camera.cameraId}
                tool={activeTool}
                onSelect={() => {
                  if (activeTool === 'delete') {
                    onSelectElement({ type: 'camera', id: camera.cameraId });
                    onDeleteSelected();
                  } else {
                    onSelectElement({ type: 'camera', id: camera.cameraId });
                  }
                }}
                onChange={(updates) => {
                  const newX = updates.x !== undefined ? updates.x : camera.x;
                  const newY = updates.y !== undefined ? updates.y : camera.y;
                  const allRooms = Object.values(floorPlan.rooms);
                  const containingRoom = allRooms.find(
                    (r) => newX >= r.x && newX <= r.x + r.width && newY >= r.y && newY <= r.y + r.height
                  );
                  onUpdateCamera(camera.cameraId, {
                    ...updates,
                    roomId: containingRoom ? containingRoom.roomId : null,
                  });
                }}
              />
            ))}
          </Layer>
        </Stage>
      </div>

      {/* Compact Hint bar at bottom */}
      <div className="h-7 shrink-0 px-3 bg-white border-t border-slate-200/80 text-[11px] text-slate-600 flex items-center justify-between select-none">
        <span className="font-medium text-slate-700 truncate pr-2">
          {activeTool === 'select' && 'Click element to select. Drag to move. Handles to resize.'}
          {activeTool === 'room' && 'Click canvas to place a retail shop.'}
          {activeTool === 'corridor' && 'Click canvas to place a corridor walkway.'}
          {activeTool === 'stairwell' && 'Click canvas to place a staircase / evacuation route.'}
          {activeTool === 'elevator' && 'Click canvas to place an elevator / lift.'}
          {activeTool === 'shop_door' && 'Click canvas to place a shop entry door.'}
          {activeTool === 'main_entry' && 'Click canvas to place a mall main entrance / exit.'}
          {activeTool === 'emergency_exit' && 'Click canvas to place an emergency fire exit.'}
          {activeTool === 'camera' && 'Click canvas to place a CCTV camera marker.'}
          {activeTool === 'delete' && 'Click element to delete immediately. Or press Del key.'}
        </span>
        <span className="text-slate-400 font-mono text-[10px] shrink-0">
          {shopsCount} Shops · {corridorsCount} Corridors {stairsCount > 0 ? `· ${stairsCount} Stairs ` : ''}· {doors.length} Exits/Doors · {cameras.length} Cameras
        </span>
      </div>
    </div>
  );
}
