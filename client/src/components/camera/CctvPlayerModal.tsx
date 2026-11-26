import React, { useState, useEffect, useRef } from 'react';
import { CameraRecord, CameraDetectionState } from '@/types/camera';
import {
  X,
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize2,
  Minimize2,
  Eye,
  EyeOff,
  Video,
  Radio,
  Wifi,
  WifiOff,
  AlertCircle,
  Clock,
  Layers,
  MapPin,
  RefreshCw,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

interface CctvPlayerModalProps {
  camera: CameraRecord | null;
  detectionState?: CameraDetectionState | null;
  isOpen: boolean;
  onClose: () => void;
  onNavigateToFloorPlan?: () => void;
}

export const CctvPlayerModal: React.FC<CctvPlayerModalProps> = ({
  camera,
  detectionState,
  isOpen,
  onClose,
  onNavigateToFloorPlan,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [isMuted, setIsMuted] = useState<boolean>(true);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [isHudVisible, setIsHudVisible] = useState<boolean>(true);
  const [streamStatus, setStreamStatus] = useState<'loading' | 'connected' | 'disconnected' | 'inactive'>('loading');
  const [streamError, setStreamError] = useState<string | null>(null);
  const [currentTimeStr, setCurrentTimeStr] = useState<string>('');

  // Ticking digital clock for CCTV overlay
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const pad = (n: number) => n.toString().padStart(2, '0');
      const yyyy = now.getFullYear();
      const mm = pad(now.getMonth() + 1);
      const dd = pad(now.getDate());
      const hh = pad(now.getHours());
      const min = pad(now.getMinutes());
      const ss = pad(now.getSeconds());
      setCurrentTimeStr(`${yyyy}-${mm}-${dd} ${hh}:${min}:${ss}`);
    };

    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  // Reset states when camera changes
  useEffect(() => {
    if (!camera) return;

    if (!camera.isActive) {
      setStreamStatus('inactive');
      setStreamError('This camera has been set to inactive by management.');
      return;
    }

    setStreamStatus('loading');
    setStreamError(null);
    setIsPlaying(true);
  }, [camera]);

  // Fullscreen change listener
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  if (!isOpen || !camera) return null;

  const isSimulated = camera.streamType === 'simulated';
  const isMjpeg = camera.streamType === 'mjpeg' || camera.streamType === 'esp32cam';

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
      setIsPlaying(false);
    } else {
      videoRef.current.play().catch(() => {});
      setIsPlaying(true);
    }
  };

  const toggleMute = () => {
    if (!videoRef.current) return;
    videoRef.current.muted = !isMuted;
    setIsMuted(!isMuted);
  };

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  const retryStream = () => {
    setStreamStatus('loading');
    setStreamError(null);
    if (videoRef.current) {
      videoRef.current.load();
      videoRef.current.play().catch(() => {});
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div
        ref={containerRef}
        className={`bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl flex flex-col overflow-hidden w-full transition-all ${
          isFullscreen ? 'h-full max-w-none rounded-none border-none' : 'max-w-4xl max-h-[92vh]'
        }`}
      >
        {/* Top Header Bar */}
        <div className="bg-slate-900/95 border-b border-slate-800 px-4 py-3 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/30 text-blue-400 flex items-center justify-center shrink-0">
              <Video className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm font-bold text-white truncate">{camera.name}</h3>
                <span className="text-[10px] font-mono text-slate-400 bg-slate-800 px-1.5 py-0.5 rounded border border-slate-700">
                  {camera.cameraId}
                </span>
                {/* Status Badge */}
                {streamStatus === 'connected' && (
                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    Connected
                  </span>
                )}
                {streamStatus === 'loading' && (
                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium bg-blue-500/15 text-blue-400 border border-blue-500/30">
                    <RefreshCw className="w-3 h-3 animate-spin" />
                    Connecting…
                  </span>
                )}
                {streamStatus === 'disconnected' && (
                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-500/15 text-rose-400 border border-rose-500/30">
                    <WifiOff className="w-3 h-3" />
                    Disconnected
                  </span>
                )}
                {streamStatus === 'inactive' && (
                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-500/15 text-amber-400 border border-amber-500/30">
                    Inactive
                  </span>
                )}
                {/* Real-time AI Hazard State Pill */}
                {detectionState?.isCurrentlyDetected ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-red-600 text-white shadow-sm animate-pulse">
                    🔥 {(detectionState.detectionType || 'FIRE').toUpperCase()} DETECTED
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                    🛡️ ALL CLEAR (NO FIRE)
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-400 flex items-center gap-2 mt-0.5">
                <span className="flex items-center gap-1">
                  <Layers className="w-3 h-3 text-slate-500" />
                  {camera.floorName || camera.floorId || 'Ground Floor'}
                </span>
                <span className="text-slate-600">·</span>
                <span className="flex items-center gap-1">
                  <MapPin className="w-3 h-3 text-slate-500" />
                  {camera.roomName || 'General Corridor / Area'}
                </span>
                <span className="text-slate-600">·</span>
                <span className="uppercase text-[10px] tracking-wider text-slate-400 font-medium">
                  {isSimulated ? 'Simulated CCTV Feed' : 'MJPEG Stream'}
                </span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {onNavigateToFloorPlan && (
              <Button
                variant="outline"
                size="sm"
                onClick={onNavigateToFloorPlan}
                className="bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700 hover:text-white text-xs h-7 px-2.5"
              >
                <Layers className="w-3 h-3 mr-1" />
                Floor Plan
              </Button>
            )}
            <button
              onClick={onClose}
              className="w-7 h-7 rounded-lg bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 flex items-center justify-center transition"
              title="Close modal"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Video / Stream Container */}
        <div className="relative flex-1 min-h-[300px] sm:min-h-[420px] bg-black flex items-center justify-center overflow-hidden select-none">
          {/* Simulated Video Player */}
          {isSimulated && (
            <video
              ref={videoRef}
              src={camera.streamUrl}
              autoPlay
              loop
              playsInline
              muted={isMuted}
              onLoadedData={() => {
                if (camera.isActive) {
                  setStreamStatus('connected');
                  setStreamError(null);
                }
              }}
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
              onError={(e) => {
                console.warn('[CctvPlayerModal] Video load error for', camera.streamUrl, e);
                setStreamStatus('disconnected');
                setStreamError(
                  `Could not load video source '${camera.streamUrl}'. Please verify file location or choose a bundled demo video.`
                );
              }}
              className="w-full h-full object-contain"
            />
          )}

          {/* MJPEG Stream Viewer (Prepared for ESP32-CAM) */}
          {isMjpeg && (
            <div className="w-full h-full flex flex-col items-center justify-center">
              <img
                src={camera.streamUrl}
                alt={camera.name}
                onLoad={() => {
                  if (camera.isActive) {
                    setStreamStatus('connected');
                    setStreamError(null);
                  }
                }}
                onError={() => {
                  setStreamStatus('disconnected');
                  setStreamError(
                    `Unable to connect to MJPEG stream at '${camera.streamUrl}'. Ensure the ESP32-CAM device is online on your local Wi-Fi network and broadcasting /stream.`
                  );
                }}
                className={`w-full h-full object-contain ${streamStatus === 'disconnected' ? 'hidden' : 'block'}`}
              />
            </div>
          )}

          {/* Offline / Inactive / Error Overlay */}
          {(streamStatus === 'disconnected' || streamStatus === 'inactive') && (
            <div className="absolute inset-0 bg-slate-950/90 flex flex-col items-center justify-center p-6 text-center z-20">
              <div className="w-12 h-12 rounded-full bg-rose-500/10 border border-rose-500/30 text-rose-400 flex items-center justify-center mb-3">
                <WifiOff className="w-6 h-6" />
              </div>
              <h4 className="text-sm font-bold text-white mb-1">
                {streamStatus === 'inactive' ? 'Surveillance Camera Inactive' : 'Camera Feed Offline'}
              </h4>
              <p className="text-xs text-slate-400 max-w-md mb-4 leading-relaxed">
                {streamError || 'No live frame detected from video source.'}
              </p>
              {streamStatus === 'disconnected' && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={retryStream}
                  className="bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700 hover:text-white text-xs"
                >
                  <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                  Retry Connection
                </Button>
              )}
            </div>
          )}

          {/* Authenticated CCTV Surveillance HUD Overlay */}
          {isHudVisible && streamStatus === 'connected' && (
            <div className="absolute inset-0 pointer-events-none p-4 flex flex-col justify-between z-10 font-mono text-[11px] text-white/90">
              {/* Top Row */}
              <div className="flex items-center justify-between drop-shadow-md">
                <div className="flex items-center gap-2 bg-black/60 px-2.5 py-1 rounded backdrop-blur-xs border border-white/10">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-600 animate-pulse" />
                  <span className="font-bold text-red-400 tracking-wider">● REC</span>
                  <span className="text-slate-400">|</span>
                  <span className="font-semibold text-white uppercase">{camera.name}</span>
                </div>
                <div className="bg-black/60 px-2.5 py-1 rounded backdrop-blur-xs border border-white/10 flex items-center gap-2">
                  <Clock className="w-3 h-3 text-slate-400" />
                  <span className="text-emerald-400 font-bold">{currentTimeStr}</span>
                </div>
              </div>

              {/* Crosshair / Viewfinder Corner Accents */}
              <div className="absolute inset-8 border border-white/10 rounded-sm pointer-events-none" />

              {/* Bottom Row */}
              <div className="flex items-end justify-between drop-shadow-md">
                <div className="bg-black/60 px-2.5 py-1 rounded backdrop-blur-xs border border-white/10 space-y-0.5">
                  <div className="text-[10px] text-slate-400 uppercase">
                    ZONE: <span className="text-white font-semibold">{camera.roomName || 'CORRIDOR / ATRIUM'}</span>
                  </div>
                  <div className="text-[9px] text-slate-400">
                    SOURCE: <span className="text-blue-400">{camera.streamType.toUpperCase()}</span>
                  </div>
                </div>

                <div className="bg-black/60 px-2.5 py-1 rounded backdrop-blur-xs border border-white/10 text-right space-y-0.5">
                  <div className="text-[10px] text-emerald-400 font-semibold">1080P · 25.0 FPS</div>
                  <div className={`text-[9px] flex items-center justify-end gap-1 font-mono ${detectionState?.isCurrentlyDetected ? 'text-red-400 font-bold' : 'text-emerald-300 font-semibold'}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${detectionState?.isCurrentlyDetected ? 'bg-red-500 animate-bounce' : 'bg-emerald-400'}`} />
                    <span>
                      {detectionState?.isCurrentlyDetected
                        ? `HAZARD: ${(detectionState.detectionType || 'FIRE').toUpperCase()}`
                        : 'STATUS: ALL CLEAR (NO FIRE)'}
                    </span>
                  </div>
                  <div className="text-[9px] text-slate-400">CH-01 · EVACAI CCTV</div>
                </div>
              </div>
            </div>
          )}

          {/* MJPEG Disclaimer Banner */}
          {isMjpeg && (
            <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 bg-purple-950/80 border border-purple-500/40 text-purple-200 px-3 py-1 rounded-full text-[10px] flex items-center gap-1.5 backdrop-blur-sm pointer-events-none">
              <Radio className="w-3 h-3 text-purple-400 animate-pulse" />
              <span>MJPEG Stream Mode (Prepared for ESP32-CAM)</span>
            </div>
          )}
        </div>

        {/* Bottom Control Bar */}
        <div className="bg-slate-900 border-t border-slate-800 px-4 py-2.5 flex items-center justify-between shrink-0 text-slate-300">
          <div className="flex items-center gap-2">
            {/* Play / Pause for simulated video */}
            {isSimulated && (
              <button
                onClick={togglePlay}
                disabled={streamStatus !== 'connected'}
                className="w-8 h-8 rounded-lg bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 flex items-center justify-center transition disabled:opacity-50"
                title={isPlaying ? 'Pause video' : 'Play video'}
              >
                {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
              </button>
            )}

            {/* Mute / Unmute */}
            {isSimulated && (
              <button
                onClick={toggleMute}
                disabled={streamStatus !== 'connected'}
                className="w-8 h-8 rounded-lg bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 flex items-center justify-center transition disabled:opacity-50"
                title={isMuted ? 'Unmute' : 'Mute'}
              >
                {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              </button>
            )}

            {/* Toggle CCTV HUD */}
            <button
              onClick={() => setIsHudVisible((v) => !v)}
              className="w-8 h-8 rounded-lg bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 flex items-center justify-center transition"
              title={isHudVisible ? 'Hide CCTV overlay' : 'Show CCTV overlay'}
            >
              {isHudVisible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>

          {/* Center Info: Stream URL snippet */}
          <div className="hidden sm:flex items-center gap-1 text-[11px] font-mono text-slate-400 bg-slate-950/60 px-3 py-1 rounded border border-slate-800 max-w-sm truncate">
            <span className="text-slate-500 font-sans">URL:</span>
            <span className="truncate" title={camera.streamUrl}>
              {camera.streamUrl}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {/* Fullscreen Toggle */}
            <button
              onClick={toggleFullscreen}
              className="w-8 h-8 rounded-lg bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 flex items-center justify-center transition"
              title={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
