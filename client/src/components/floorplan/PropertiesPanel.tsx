import React from 'react';
import {
  FloorRoom,
  FloorDoor,
  FloorCameraMarker,
  SelectedElement,
  RoomType,
  DoorType,
  ROOM_STYLES,
} from '@/types/floorplan';
import { Trash2, Info, Play, Video } from 'lucide-react';

interface PropertiesPanelProps {
  selectedElement: SelectedElement;
  rooms: Record<string, FloorRoom>;
  doors: Record<string, FloorDoor>;
  cameras: Record<string, FloorCameraMarker>;
  onUpdateRoom: (roomId: string, updates: Partial<FloorRoom>) => void;
  onUpdateDoor: (doorId: string, updates: Partial<FloorDoor>) => void;
  onUpdateCamera: (cameraId: string, updates: Partial<FloorCameraMarker>) => void;
  onDeleteSelected: () => void;
  onViewCameraFeed?: (camera: FloorCameraMarker) => void;
}

const ROOM_TYPE_OPTIONS: { value: RoomType; label: string }[] = [
  { value: 'room', label: 'Shop / Retail Store' },
  { value: 'corridor', label: 'Corridor / Walkway' },
  { value: 'common_area', label: 'Common Area / Atrium' },
  { value: 'stairwell', label: 'Stairs / Evacuation Route' },
  { value: 'elevator', label: 'Elevator / Lift' },
  { value: 'restroom', label: 'Restrooms' },
];

const DOOR_TYPE_OPTIONS: { value: DoorType; label: string }[] = [
  { value: 'shop_door', label: 'Shop Entry / Door' },
  { value: 'main_entry', label: 'Mall Main Entry / Exit' },
  { value: 'emergency_exit', label: 'Emergency Fire Exit' },
];

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <label className="block text-[11px] text-slate-600 mb-0.5 font-semibold">{children}</label>;
}

function TextInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-xs text-slate-900 focus:outline-none focus:bg-white focus:ring-1 focus:ring-blue-500 focus:border-blue-500 placeholder:text-slate-400 transition"
    />
  );
}

function NumberInput({
  value,
  onChange,
  min,
  max,
  step,
  label,
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  label?: string;
}) {
  return (
    <div>
      {label && <FieldLabel>{label}</FieldLabel>}
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        step={step ?? 0.01}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-xs text-slate-900 focus:outline-none focus:bg-white focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition"
      />
    </div>
  );
}

function SelectInput<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as T)}
      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-xs text-slate-900 focus:outline-none focus:bg-white focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition"
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">{children}</h4>;
}

function Divider() {
  return <hr className="border-slate-100 my-2.5" />;
}

// ─── Room Properties ──────────────────────────────────────────────────────────

function RoomProperties({
  room,
  onUpdate,
  onDelete,
}: {
  room: FloorRoom;
  onUpdate: (u: Partial<FloorRoom>) => void;
  onDelete: () => void;
}) {
  const handleTypeChange = (type: RoomType) => {
    const style = ROOM_STYLES[type] || ROOM_STYLES.room;
    onUpdate({
      type,
      fill: style.fill,
      stroke: style.stroke,
    });
  };

  return (
    <div className="space-y-2.5">
      <SectionTitle>Space Details</SectionTitle>
      <div>
        <FieldLabel>Label / Name</FieldLabel>
        <TextInput value={room.name} onChange={(v) => onUpdate({ name: v })} placeholder="e.g. Zara, Corridor B, North Stairs" />
      </div>
      <div>
        <FieldLabel>Element Category</FieldLabel>
        <SelectInput value={room.type} options={ROOM_TYPE_OPTIONS} onChange={handleTypeChange} />
      </div>
      <Divider />
      <SectionTitle>Dimensions (Normalized)</SectionTitle>
      <div className="grid grid-cols-2 gap-2">
        <NumberInput label="Width" value={parseFloat(room.width.toFixed(3))} min={0.01} max={1} step={0.01} onChange={(v) => onUpdate({ width: v })} />
        <NumberInput label="Height" value={parseFloat(room.height.toFixed(3))} min={0.01} max={1} step={0.01} onChange={(v) => onUpdate({ height: v })} />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <NumberInput label="Pos X" value={parseFloat(room.x.toFixed(3))} min={0} max={1} step={0.01} onChange={(v) => onUpdate({ x: v })} />
        <NumberInput label="Pos Y" value={parseFloat(room.y.toFixed(3))} min={0} max={1} step={0.01} onChange={(v) => onUpdate({ y: v })} />
      </div>
      <Divider />
      <button
        onClick={onDelete}
        className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-semibold bg-red-50 border border-red-200 text-red-600 hover:bg-red-100 transition-colors"
      >
        <Trash2 className="w-3.5 h-3.5" />
        Delete Space
      </button>
    </div>
  );
}

// ─── Door Properties ──────────────────────────────────────────────────────────

function DoorProperties({
  door,
  onUpdate,
  onDelete,
}: {
  door: FloorDoor;
  onUpdate: (u: Partial<FloorDoor>) => void;
  onDelete: () => void;
}) {
  return (
    <div className="space-y-2.5">
      <SectionTitle>Door / Exit Marker</SectionTitle>
      <div>
        <FieldLabel>Label</FieldLabel>
        <TextInput value={door.label || ''} onChange={(v) => onUpdate({ label: v })} placeholder="e.g. Main Entrance, Fire Exit 2" />
      </div>
      <div>
        <FieldLabel>Door Function</FieldLabel>
        <SelectInput
          value={
            door.type === 'entry' ? 'main_entry' : door.type === 'exit' ? 'emergency_exit' : door.type === 'internal' ? 'shop_door' : door.type
          }
          options={DOOR_TYPE_OPTIONS}
          onChange={(type) => onUpdate({ type })}
        />
      </div>
      <Divider />
      <SectionTitle>Position</SectionTitle>
      <div className="grid grid-cols-2 gap-2">
        <NumberInput label="X" value={parseFloat(door.x.toFixed(3))} min={0} max={1} step={0.01} onChange={(v) => onUpdate({ x: v })} />
        <NumberInput label="Y" value={parseFloat(door.y.toFixed(3))} min={0} max={1} step={0.01} onChange={(v) => onUpdate({ y: v })} />
      </div>
      <Divider />
      <button
        onClick={onDelete}
        className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-semibold bg-red-50 border border-red-200 text-red-600 hover:bg-red-100 transition-colors"
      >
        <Trash2 className="w-3.5 h-3.5" />
        Delete Door
      </button>
    </div>
  );
}

// ─── Camera Properties ────────────────────────────────────────────────────────

function CameraProperties({
  camera,
  rooms,
  onUpdate,
  onDelete,
  onViewFeed,
}: {
  camera: FloorCameraMarker;
  rooms: Record<string, FloorRoom>;
  onUpdate: (u: Partial<FloorCameraMarker>) => void;
  onDelete: () => void;
  onViewFeed?: (camera: FloorCameraMarker) => void;
}) {
  const roomList = Object.values(rooms);
  const containingRoom = camera.roomId && rooms[camera.roomId]
    ? rooms[camera.roomId]
    : roomList.find((r) => camera.x >= r.x && camera.x <= r.x + r.width && camera.y >= r.y && camera.y <= r.y + r.height);

  return (
    <div className="space-y-2.5">
      <SectionTitle>Camera Marker</SectionTitle>
      <div>
        <FieldLabel>Camera Name</FieldLabel>
        <TextInput value={camera.name} onChange={(v) => onUpdate({ name: v })} placeholder="e.g. Cam-North-Atrium" />
      </div>

      <div>
        <FieldLabel>Assigned Room / Space</FieldLabel>
        <select
          value={containingRoom ? containingRoom.roomId : ''}
          onChange={(e) => {
            const targetRoomId = e.target.value;
            if (targetRoomId && rooms[targetRoomId]) {
              const r = rooms[targetRoomId];
              onUpdate({
                roomId: targetRoomId,
                name: camera.name === 'Camera' ? `Cam - ${r.name}` : camera.name,
                x: parseFloat((r.x + r.width / 2).toFixed(3)),
                y: parseFloat((r.y + r.height / 2).toFixed(3)),
              });
            } else {
              onUpdate({ roomId: null });
            }
          }}
          className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-xs text-slate-900 focus:outline-none focus:bg-white focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition"
        >
          <option value="">{containingRoom ? `${containingRoom.name} (Auto-detected)` : 'Corridor / Unassigned'}</option>
          {roomList.map((r) => (
            <option key={r.roomId} value={r.roomId}>
              {r.name} ({r.type})
            </option>
          ))}
        </select>
        {containingRoom ? (
          <p className="text-[10px] text-emerald-700 font-medium mt-1 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
            <span>Located inside: <strong className="text-slate-900">{containingRoom.name}</strong></span>
          </p>
        ) : (
          <p className="text-[10px] text-slate-400 mt-1">Open walkway / unassigned space</p>
        )}
      </div>

      <div>
        <FieldLabel>Device Identifier</FieldLabel>
        <p className="text-[10px] font-mono text-slate-600 bg-slate-50 border border-slate-200 rounded px-2 py-1 break-all">
          {camera.cameraId}
        </p>
      </div>

      {onViewFeed && (
        <button
          type="button"
          onClick={() => onViewFeed(camera)}
          className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold bg-blue-600 text-white hover:bg-blue-700 shadow-xs transition-colors"
        >
          <Play className="w-3.5 h-3.5" />
          Open CCTV Live Feed
        </button>
      )}

      <Divider />
      <SectionTitle>Coordinates</SectionTitle>
      <div className="grid grid-cols-2 gap-2">
        <NumberInput label="X" value={parseFloat(camera.x.toFixed(3))} min={0} max={1} step={0.001} onChange={(v) => onUpdate({ x: v })} />
        <NumberInput label="Y" value={parseFloat(camera.y.toFixed(3))} min={0} max={1} step={0.001} onChange={(v) => onUpdate({ y: v })} />
      </div>
      <div className="p-2 rounded bg-blue-50 border border-blue-200 text-[10px] text-blue-700 flex items-start gap-1">
        <Info className="w-3 h-3 shrink-0 mt-0.5" />
        <span>Hardware node registered on current floor plan.</span>
      </div>
      <Divider />
      <button
        onClick={onDelete}
        className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-semibold bg-red-50 border border-red-200 text-red-600 hover:bg-red-100 transition-colors"
      >
        <Trash2 className="w-3.5 h-3.5" />
        Remove Camera
      </button>
    </div>
  );
}

// ─── Main PropertiesPanel ─────────────────────────────────────────────────────

export function PropertiesPanel({
  selectedElement,
  rooms,
  doors,
  cameras,
  onUpdateRoom,
  onUpdateDoor,
  onUpdateCamera,
  onDeleteSelected,
  onViewCameraFeed,
}: PropertiesPanelProps) {
  const roomsList = Object.values(rooms);
  const shopsCount = roomsList.filter((r) => r.type === 'room').length;
  const corridorsCount = roomsList.filter((r) => r.type === 'corridor').length;
  const stairsCount = roomsList.filter((r) => r.type === 'stairwell').length;
  const doorsCount = Object.keys(doors).length;
  const camerasCount = Object.keys(cameras).length;

  return (
    <div className="h-full flex flex-col overflow-hidden bg-white select-none">
      {/* Header */}
      <div className="px-3.5 py-2.5 border-b border-slate-100 shrink-0 flex items-center justify-between">
        <h3 className="text-xs font-bold text-slate-800 tracking-wide uppercase">Properties</h3>
        {selectedElement && (
          <span className="text-[10px] font-mono text-slate-500 capitalize bg-slate-100 px-1.5 py-0.5 rounded font-medium">
            {selectedElement.type}
          </span>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 overflow-y-auto p-3">
        {!selectedElement ? (
          <div className="flex flex-col items-center justify-center h-full text-center p-4 text-slate-400">
            <div className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center mb-2.5 text-slate-400">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.232 5.232l3.536 3.536M9 11l6 6M3 21h4l11.5-11.5a2.121 2.121 0 00-3-3L3 17v4z" />
              </svg>
            </div>
            <p className="text-xs font-semibold text-slate-700">No element selected</p>
            <p className="text-[11px] text-slate-400 mt-1 max-w-[170px]">
              Click any shop, corridor, stair, door, or camera to configure properties.
            </p>
          </div>
        ) : selectedElement.type === 'room' && rooms[selectedElement.id] ? (
          <RoomProperties
            room={rooms[selectedElement.id]}
            onUpdate={(u) => onUpdateRoom(selectedElement.id, u)}
            onDelete={onDeleteSelected}
          />
        ) : selectedElement.type === 'door' && doors[selectedElement.id] ? (
          <DoorProperties
            door={doors[selectedElement.id]}
            onUpdate={(u) => onUpdateDoor(selectedElement.id, u)}
            onDelete={onDeleteSelected}
          />
        ) : selectedElement.type === 'camera' && cameras[selectedElement.id] ? (
          <CameraProperties
            camera={cameras[selectedElement.id]}
            rooms={rooms}
            onUpdate={(u) => onUpdateCamera(selectedElement.id, u)}
            onDelete={onDeleteSelected}
            onViewFeed={onViewCameraFeed}
          />
        ) : null}
      </div>

      {/* Bottom Summary Footer: Does NOT count corridors as rooms */}
      <div className="p-2 border-t border-slate-100 bg-slate-50/80 text-[10px] text-slate-500 shrink-0 flex items-center justify-between">
        <span className="font-medium text-slate-600">Active Floor Objects</span>
        <span className="font-mono text-slate-600 font-semibold truncate pl-1">
          {shopsCount}S · {corridorsCount}C {stairsCount > 0 ? `· ${stairsCount}St ` : ''}· {doorsCount}D · {camerasCount}Cam
        </span>
      </div>
    </div>
  );
}
