import React, { useState, useEffect } from 'react';
import { CameraRecord, CameraStreamType } from '@/types/camera';
import { FloorRoom } from '@/types/floorplan';
import {
  X,
  Video,
  Radio,
  Layers,
  MapPin,
  Check,
  AlertCircle,
  HelpCircle,
  Sliders,
  Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface CameraFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (cameraData: Partial<CameraRecord>) => Promise<void>;
  initialData?: CameraRecord | null;
  availableFloors?: { id: string; name: string; number: number }[];
  roomsByFloor?: Record<string, FloorRoom[]>;
}

export const CameraFormModal: React.FC<CameraFormModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialData,
  availableFloors = [{ id: 'floor_1', name: 'Ground Floor', number: 1 }],
  roomsByFloor = {},
}) => {
  const isEditing = Boolean(initialData);

  const [name, setName] = useState('');
  const [floorId, setFloorId] = useState('floor_1');
  const [roomId, setRoomId] = useState<string>('');
  const [streamType, setStreamType] = useState<CameraStreamType>('simulated');
  const [streamUrl, setStreamUrl] = useState('');
  const [isActive, setIsActive] = useState<boolean>(true);
  const [xCoord, setXCoord] = useState<number>(0.5);
  const [yCoord, setYCoord] = useState<number>(0.5);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Initialize form state
  useEffect(() => {
    if (initialData) {
      setName(initialData.name || '');
      setFloorId(initialData.floorId || 'floor_1');
      setRoomId(initialData.roomId || '');
      setStreamType(initialData.streamType || 'simulated');
      setStreamUrl(initialData.streamUrl || '');
      setIsActive(initialData.isActive !== undefined ? initialData.isActive : true);
      setXCoord(initialData.x !== undefined && initialData.x !== null ? initialData.x : 0.5);
      setYCoord(initialData.y !== undefined && initialData.y !== null ? initialData.y : 0.5);
    } else {
      // Default for new camera
      setName('');
      setFloorId(availableFloors[0]?.id || 'floor_1');
      setRoomId('');
      setStreamType('simulated');
      setStreamUrl('');
      setIsActive(true);
      setXCoord(0.5);
      setYCoord(0.5);
    }
    setErrorMessage(null);
  }, [initialData, isOpen, availableFloors]);

  if (!isOpen) return null;

  const currentFloorRooms = roomsByFloor[floorId] || [];

  // When room is selected, auto-center coordinates on that room if not already placed
  const handleRoomChange = (newRoomId: string) => {
    setRoomId(newRoomId);
    if (newRoomId) {
      const room = currentFloorRooms.find((r) => r.roomId === newRoomId);
      if (room) {
        setXCoord(parseFloat((room.x + room.width / 2).toFixed(3)));
        setYCoord(parseFloat((room.y + room.height / 2).toFixed(3)));
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!name.trim()) {
      setErrorMessage('Please enter a camera name.');
      return;
    }

    const effectiveUrl = streamUrl.trim();
    if (!effectiveUrl) {
      setErrorMessage('Please provide a valid stream URL or video source.');
      return;
    }

    setIsSubmitting(true);
    try {
      await onSave({
        name: name.trim(),
        floorId,
        roomId: roomId || null,
        streamType,
        streamUrl: effectiveUrl,
        isActive,
        x: Number(xCoord),
        y: Number(yCoord),
        rotation: initialData?.rotation ?? 0,
      });
      onClose();
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to save camera.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xl w-full max-w-lg overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-100 text-blue-600 flex items-center justify-center shrink-0">
              <Video className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                {isEditing ? 'Edit CCTV Camera' : 'Register New CCTV Camera'}
              </h3>
              <p className="text-xs text-slate-500">
                {isEditing ? 'Update camera details and surveillance feed' : 'Add surveillance node to mall floor grid'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 flex items-center justify-center transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 min-h-0 overflow-y-auto p-5 space-y-4 text-xs">
          {errorMessage && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Camera Name */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Camera Name <span className="text-red-500">*</span>
            </label>
            <Input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. North Atrium Entrance Cam"
              className="text-xs h-9 bg-slate-50 focus:bg-white"
              required
            />
          </div>

          {/* Floor & Room Association */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Assigned Floor <span className="text-red-500">*</span>
              </label>
              <select
                value={floorId}
                onChange={(e) => {
                  setFloorId(e.target.value);
                  setRoomId('');
                }}
                className="w-full h-9 rounded-md border border-slate-200 bg-slate-50 px-3 py-1 text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 transition"
              >
                {availableFloors.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Room / Area Location
              </label>
              <select
                value={roomId}
                onChange={(e) => handleRoomChange(e.target.value)}
                className="w-full h-9 rounded-md border border-slate-200 bg-slate-50 px-3 py-1 text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 transition"
              >
                <option value="">Unassigned / Corridor Area</option>
                {currentFloorRooms.map((r) => (
                  <option key={r.roomId} value={r.roomId}>
                    {r.name} ({r.type})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Camera Source Type Selection */}
          {/* Camera Source Type Selection */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Video Source Type <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => setStreamType('simulated')}
                className={`p-3 rounded-xl border text-left transition flex flex-col justify-between ${
                  streamType === 'simulated'
                    ? 'border-blue-500 bg-blue-50/70 text-blue-900 ring-1 ring-blue-500 shadow-xs'
                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-xs flex items-center gap-1.5">
                    <Video className="w-3.5 h-3.5 text-blue-600" />
                    Pre-recorded Video
                  </span>
                  {streamType === 'simulated' && <Check className="w-3.5 h-3.5 text-blue-600" />}
                </div>
                <p className="text-[10px] text-slate-500 leading-tight">
                  Direct URL or local video file path (MP4/WebM) to simulate CCTV feed.
                </p>
              </button>

              <button
                type="button"
                onClick={() => setStreamType('esp32cam')}
                className={`p-3 rounded-xl border text-left transition flex flex-col justify-between ${
                  streamType === 'mjpeg' || streamType === 'esp32cam'
                    ? 'border-purple-500 bg-purple-50/70 text-purple-900 ring-1 ring-purple-500 shadow-xs'
                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-xs flex items-center gap-1.5">
                    <Radio className="w-3.5 h-3.5 text-purple-600" />
                    ESP32-CAM Stream
                  </span>
                  {(streamType === 'mjpeg' || streamType === 'esp32cam') && (
                    <Check className="w-3.5 h-3.5 text-purple-600" />
                  )}
                </div>
                <p className="text-[10px] text-slate-500 leading-tight">
                  Live HTTP MJPEG stream endpoint from ESP32-CAM Wi-Fi hardware.
                </p>
              </button>
            </div>
          </div>

          {/* Source URL Input */}
          <div className="space-y-2 bg-slate-50 p-3.5 rounded-xl border border-slate-200/80">
            <label className="block text-xs font-semibold text-slate-700">
              {streamType === 'simulated' ? 'Pre-recorded Video URL / Local Path' : 'ESP32-CAM Stream Link'} <span className="text-red-500">*</span>
            </label>
            <Input
              type="text"
              value={streamUrl}
              onChange={(e) => setStreamUrl(e.target.value)}
              placeholder={
                streamType === 'simulated'
                  ? 'e.g. https://domain.com/video.mp4 or D:/videos/fire.mp4'
                  : 'http://192.168.1.50:81/stream'
              }
              className="text-xs h-9 bg-white font-mono"
              required
            />
            <p className="text-[10px] text-slate-500">
              {streamType === 'simulated'
                ? 'Provide a valid video URL (HTTP/HTTPS) or an accessible local file path.'
                : 'Provide the live HTTP stream link exposed by the ESP32-CAM module.'}
            </p>
          </div>

          {/* Floor Plan Coordinates */}
          <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200/80 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-xs text-slate-700 flex items-center gap-1.5">
                <Sliders className="w-3.5 h-3.5 text-slate-500" />
                Floor Plan Placement Coordinates
              </span>
              <span className="text-[10px] font-mono text-slate-400">Normalized (0.00 – 1.00)</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] text-slate-500 mb-0.5">X Position</label>
                <Input
                  type="number"
                  min={0}
                  max={1}
                  step={0.01}
                  value={xCoord}
                  onChange={(e) => setXCoord(parseFloat(e.target.value) || 0)}
                  className="text-xs h-8 bg-white font-mono"
                />
              </div>
              <div>
                <label className="block text-[11px] text-slate-500 mb-0.5">Y Position</label>
                <Input
                  type="number"
                  min={0}
                  max={1}
                  step={0.01}
                  value={yCoord}
                  onChange={(e) => setYCoord(parseFloat(e.target.value) || 0)}
                  className="text-xs h-8 bg-white font-mono"
                />
              </div>
            </div>
            <p className="text-[10px] text-slate-400">
              Coordinates position the camera marker on the interactive floor plan editor canvas.
            </p>
          </div>

          {/* Active State Toggle */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200">
            <div>
              <span className="font-semibold text-xs text-slate-800 block">Surveillance Status</span>
              <span className="text-[11px] text-slate-500 block">
                {isActive ? 'Camera is active and monitored' : 'Camera is disabled / offline'}
              </span>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>

          {/* Submit Actions */}
          <div className="pt-2 flex items-center justify-end gap-2.5 border-t border-slate-100">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              disabled={isSubmitting}
              className="text-xs h-9"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={isSubmitting}
              className="bg-blue-600 hover:bg-blue-700 text-white text-xs h-9 px-4"
            >
              {isSubmitting ? 'Saving…' : isEditing ? 'Update Camera' : 'Create Camera'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
