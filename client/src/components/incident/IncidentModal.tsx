import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Flame,
  AlertTriangle,
  CheckCircle,
  Eye,
  ShieldAlert,
  Clock,
  MapPin,
  Camera,
  Layers,
  FileCheck2,
  FileX2,
  Loader2,
  AlertOctagon,
  Mail,
  History,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { formatDateTime } from '@/lib/utils';
import { IncidentRecord, IncidentStatus, TimescaleObservation } from '@/types/incident';

interface IncidentModalProps {
  incident: IncidentRecord | null;
  mallId: string | null;
  getToken: () => Promise<string | null>;
  onClose: () => void;
  onStatusUpdated?: (updated: IncidentRecord) => void;
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000';

function getStatusBadge(status: IncidentStatus) {
  switch (status) {
    case 'DETECTED':
      return <Badge className="bg-red-600 text-white font-bold animate-pulse">DETECTED</Badge>;
    case 'ACKNOWLEDGED':
      return <Badge className="bg-amber-500 text-white font-semibold">ACKNOWLEDGED</Badge>;
    case 'INVESTIGATING':
      return <Badge className="bg-blue-600 text-white font-semibold">INVESTIGATING</Badge>;
    case 'RESOLVED':
      return <Badge className="bg-emerald-600 text-white font-semibold">RESOLVED</Badge>;
    case 'FALSE_ALARM':
      return <Badge className="bg-slate-500 text-white font-semibold">FALSE ALARM</Badge>;
    default:
      return <Badge>{status}</Badge>;
  }
}

export const IncidentModal: React.FC<IncidentModalProps> = ({
  incident,
  mallId,
  getToken,
  onClose,
  onStatusUpdated,
}) => {
  const [evidenceBlobUrl, setEvidenceBlobUrl] = useState<string | null>(null);
  const [evidenceLoading, setEvidenceLoading] = useState(false);
  const [evidenceError, setEvidenceError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [resolutionNote, setResolutionNote] = useState('');
  const [showNoteInput, setShowNoteInput] = useState<IncidentStatus | null>(null);
  const [emailLoading, setEmailLoading] = useState(false);
  const [emailFeedback, setEmailFeedback] = useState<string | null>(null);

  const handleSendEmail = async () => {
    if (!incident || !mallId) return;
    setEmailLoading(true);
    setEmailFeedback(null);
    try {
      const token = await getToken();
      if (!token) throw new Error('Authentication required');

      const res = await fetch(`${API_BASE_URL}/api/malls/${mallId}/incidents/${incident.incidentId}/email`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message || 'Failed to dispatch email');
      }

      setEmailFeedback(`Email dispatched to ${data.data?.recipient}`);
      if (onStatusUpdated) {
        onStatusUpdated({ ...incident, emailNotificationSent: true });
      }
    } catch (err: any) {
      setEmailFeedback(`Failed: ${err.message}`);
    } finally {
      setEmailLoading(false);
    }
  };

  // Extract and sort all timescale observation snapshots
  const allSnaps = useMemo(() => {
    if (!incident) return [];
    const obsMap = incident.observations;
    let list: TimescaleObservation[] = [];

    if (obsMap) {
      list = Array.isArray(obsMap) ? obsMap : Object.values(obsMap);
      list.sort((a, b) => new Date(a.observedAt).getTime() - new Date(b.observedAt).getTime());
    }

    // Ensure final concluding safe frame is in allSnaps if recorded on incident
    if (incident.finalEvidenceFileName && !list.some((s) => s.evidenceFileName === incident.finalEvidenceFileName)) {
      list.push({
        observationId: 'obs_concluded',
        incidentId: incident.incidentId,
        observationIndex: list.length + 1,
        observedAt: incident.resolvedAt || new Date().toISOString(),
        timeFormatted: new Date(incident.resolvedAt || new Date()).toLocaleTimeString(),
        confidence: 0,
        detectionType: 'normal',
        evidenceId: 'concluded',
        evidenceFileName: incident.finalEvidenceFileName,
        evidenceRelativePath: (incident as any).finalEvidenceRelativePath || `incidents/${incident.mallId}/${incident.finalEvidenceFileName}`,
        evidenceAvailable: true,
        note: incident.resolutionNote || 'Final Concluding Snapshot: Fire extinguished. Normal conditions restored.',
      });
    }

    if (list.length === 0 && (incident.evidenceAvailable || incident.evidenceFileName)) {
      list = [
        {
          observationId: 'obs_1',
          incidentId: incident.incidentId,
          observationIndex: 1,
          observedAt: incident.detectedAt || incident.createdAt || new Date().toISOString(),
          timeFormatted: new Date(incident.detectedAt || incident.createdAt || Date.now()).toLocaleTimeString(),
          confidence: incident.confidence || 0,
          detectionType: incident.detectionType || 'hazard',
          evidenceId: incident.evidenceId,
          evidenceFileName: incident.evidenceFileName,
          evidenceRelativePath: incident.evidenceRelativePath,
          evidenceAvailable: incident.evidenceAvailable,
        },
      ];
    }

    return list;
  }, [incident]);

  const [selectedSnapIndex, setSelectedSnapIndex] = useState<number>(0);

  // Sync selected index when incident changes
  useEffect(() => {
    if (allSnaps.length > 0) {
      setSelectedSnapIndex(0);
    }
  }, [incident?.incidentId]);

  const activeSnap = allSnaps[selectedSnapIndex] || allSnaps[0] || null;

  // Fetch authenticated snapshot image
  useEffect(() => {
    if (!incident || !mallId) return;

    let activeBlob: string | null = null;
    let isCancelled = false;

    const targetFileName = activeSnap?.evidenceFileName || incident.evidenceFileName;
    const hasEvidence = activeSnap ? activeSnap.evidenceAvailable : incident.evidenceAvailable;

    if (hasEvidence && targetFileName) {
      setEvidenceLoading(true);
      setEvidenceError(null);

      async function fetchSnapshot() {
        try {
          const token = await getToken();
          if (!token) throw new Error('Authentication required');

          const url = `${API_BASE_URL}/api/malls/${mallId}/incidents/${incident?.incidentId}/evidence?file=${encodeURIComponent(targetFileName || '')}`;
          const res = await fetch(url, {
            headers: { Authorization: `Bearer ${token}` },
          });

          if (!res.ok) {
            throw new Error(`Failed to load evidence (HTTP ${res.status})`);
          }

          const blob = await res.blob();
          if (!isCancelled) {
            activeBlob = URL.createObjectURL(blob);
            setEvidenceBlobUrl(activeBlob);
            setEvidenceLoading(false);
          }
        } catch (err: any) {
          if (!isCancelled) {
            console.warn('[IncidentModal] Evidence fetch error:', err.message);
            setEvidenceError(err.message || 'Evidence snapshot unavailable');
            setEvidenceLoading(false);
          }
        }
      }

      fetchSnapshot();
    } else {
      setEvidenceBlobUrl(null);
      setEvidenceLoading(false);
      setEvidenceError(null);
    }

    return () => {
      isCancelled = true;
      if (activeBlob) {
        URL.revokeObjectURL(activeBlob);
      }
    };
  }, [incident, mallId, getToken, activeSnap]);

  if (!incident) return null;

  const isFire = (incident.detectionType || '').toLowerCase().includes('fire');

  const handleUpdateStatus = async (targetStatus: IncidentStatus, note?: string) => {
    if (!mallId || !incident) return;
    setActionLoading(true);

    try {
      const token = await getToken();
      if (!token) return;

      const res = await fetch(`${API_BASE_URL}/api/malls/${mallId}/incidents/${incident.incidentId}/status`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          status: targetStatus,
          resolutionNote: note || resolutionNote || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        alert(data.error?.message || 'Failed to update incident status.');
        return;
      }

      setShowNoteInput(null);
      setResolutionNote('');
      if (onStatusUpdated && data.data) {
        onStatusUpdated(data.data);
      }
    } catch (err: any) {
      alert(`Status update error: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 overflow-y-auto animate-in fade-in duration-150">
      <div className="relative bg-white rounded-2xl shadow-2xl max-w-3xl w-full border border-slate-200 overflow-hidden flex flex-col my-auto max-h-[92vh]">
        {/* Modal Header */}
        <div
          className={`px-6 py-4 flex items-center justify-between border-b ${
            isFire ? 'bg-red-50 border-red-100' : 'bg-amber-50 border-amber-100'
          }`}
        >
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                isFire ? 'bg-red-600 text-white' : 'bg-amber-600 text-white'
              }`}
            >
              {isFire ? <Flame className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-slate-900">
                  {(incident.detectionType || 'HAZARD').toUpperCase()} Incident
                </h3>
                {getStatusBadge(incident.status)}
              </div>
              <p className="text-xs text-slate-500 font-mono">ID: {incident.incidentId}</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-6 overflow-y-auto space-y-6">
          {/* 1. Interactive Timeline & Timescale Observation Snapshots Track */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <History className="w-4 h-4 text-blue-600" />
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                  Incident Timeline &amp; Observation Snaps ({allSnaps.length})
                </h4>
              </div>
              <span className="text-[11px] text-slate-500 font-medium">
                Click any timeline snap to inspect frame
              </span>
            </div>

            {/* Horizontal Snapshot Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
              {allSnaps.map((snap, idx) => {
                const isSelected = idx === selectedSnapIndex;
                const isNormal = snap.detectionType.toLowerCase() === 'normal' || snap.note?.toLowerCase().includes('conclud') || snap.note?.toLowerCase().includes('extinguish');
                const isInitial = idx === 0;

                return (
                  <button
                    key={snap.observationId || idx}
                    type="button"
                    onClick={() => setSelectedSnapIndex(idx)}
                    className={`text-left p-2.5 rounded-lg border transition-all cursor-pointer relative ${
                      isSelected
                        ? 'bg-white border-blue-500 shadow-sm ring-2 ring-blue-500/30'
                        : 'bg-white/80 border-slate-200 hover:border-slate-300 hover:bg-white'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1 mb-1">
                      <span
                        className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${
                          isNormal
                            ? 'bg-emerald-100 text-emerald-800'
                            : isInitial
                            ? 'bg-red-100 text-red-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {isNormal
                          ? '✓ Concluded / Safe'
                          : isInitial
                          ? '🚨 Initial Breakout'
                          : `⏱️ 15m Snap #${snap.observationIndex || idx + 1}`}
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono">
                        {snap.timeFormatted || formatDateTime(snap.observedAt)}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-xs mt-1.5">
                      <span className="text-slate-600 font-medium text-[11px] truncate max-w-[120px]">
                        {isNormal ? 'Safe / No Fire' : snap.detectionType.toUpperCase()}
                      </span>
                      <span
                        className={`font-bold text-[11px] ${
                          isNormal ? 'text-emerald-600' : 'text-red-600'
                        }`}
                      >
                        {isNormal ? 'All Clear' : `${Math.round(snap.confidence * 100)}%`}
                      </span>
                    </div>

                    {snap.note && (
                      <p className="text-[10px] text-slate-400 mt-1 truncate italic">
                        {snap.note}
                      </p>
                    )}

                    {isSelected && (
                      <div className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px] shadow-xs">
                        ✓
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 2. Selected Snapshot Frame Viewer */}
          <div>
            <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
                <Camera className="w-4 h-4 text-slate-600" />
                Snapshot Frame #{selectedSnapIndex + 1} of {allSnaps.length}
                {activeSnap && (activeSnap.detectionType.toLowerCase() === 'normal' || activeSnap.note?.toLowerCase().includes('conclud')) && (
                  <span className="ml-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                    ✓ Final Concluding Frame (Normal Conditions Restored)
                  </span>
                )}
              </h4>

              {allSnaps.length > 1 && (
                <div className="flex items-center gap-1 text-xs">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-6 w-6 p-0 text-slate-600"
                    disabled={selectedSnapIndex === 0}
                    onClick={() => setSelectedSnapIndex((prev) => Math.max(0, prev - 1))}
                    title="Previous Snap"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </Button>
                  <span className="text-slate-500 font-mono text-[11px] px-1">
                    {selectedSnapIndex + 1} / {allSnaps.length}
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-6 w-6 p-0 text-slate-600"
                    disabled={selectedSnapIndex === allSnaps.length - 1}
                    onClick={() => setSelectedSnapIndex((prev) => Math.min(allSnaps.length - 1, prev + 1))}
                    title="Next Snap"
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                  </Button>
                </div>
              )}
            </div>

            {incident.evidenceAvailable || activeSnap?.evidenceAvailable ? (
              <div className="rounded-xl overflow-hidden border border-slate-200 bg-slate-950 flex flex-col items-center justify-center min-h-[260px] relative">
                {evidenceLoading && (
                  <div className="py-12 flex flex-col items-center gap-2 text-slate-400">
                    <Loader2 className="w-7 h-7 animate-spin text-red-500" />
                    <span className="text-xs">Loading secure evidence snapshot from local storage...</span>
                  </div>
                )}

                {!evidenceLoading && evidenceBlobUrl && (
                  <div className="relative w-full group">
                    <img
                      src={evidenceBlobUrl}
                      alt="Hazard detection evidence frame"
                      className="w-full h-auto max-h-[380px] object-contain mx-auto"
                    />
                    <div className="absolute top-2 right-2 bg-emerald-600/90 text-white text-[11px] font-semibold px-2.5 py-1 rounded-full shadow-md backdrop-blur-xs flex items-center gap-1">
                      <FileCheck2 className="w-3.5 h-3.5" />
                      {activeSnap?.detectionType === 'normal'
                        ? 'Safe Frame Verified'
                        : selectedSnapIndex === 0
                        ? 'Breakout Frame Verified'
                        : `15m Observation Frame #${activeSnap?.observationIndex || selectedSnapIndex + 1}`}
                    </div>
                  </div>
                )}

                {!evidenceLoading && evidenceError && (
                  <div className="p-6 text-center text-slate-400">
                    <FileX2 className="w-8 h-8 text-amber-500 mx-auto mb-1" />
                    <p className="text-xs text-slate-300 font-medium">Could not retrieve local evidence file</p>
                    <p className="text-[11px] text-slate-500">{evidenceError}</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="p-6 rounded-xl border border-dashed border-slate-300 bg-slate-50 text-center text-slate-500">
                <FileX2 className="w-8 h-8 text-slate-400 mx-auto mb-1" />
                <p className="text-sm font-medium text-slate-700">No Snapshot Evidence Stored</p>
                <p className="text-xs text-slate-500 mt-0.5">
                  The detection event was registered without an accompanying local evidence frame file.
                </p>
              </div>
            )}
          </div>

          {/* Incident Metadata Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5">
              <span className="text-xs text-slate-500 font-medium flex items-center gap-1.5">
                <Camera className="w-3.5 h-3.5 text-slate-400" /> Camera & Location
              </span>
              <p className="text-sm font-semibold text-slate-900">{incident.cameraName}</p>
              <p className="text-xs text-slate-600">
                Camera ID: <span className="font-mono text-slate-800">{incident.cameraId}</span>
              </p>
              {incident.roomName && (
                <p className="text-xs text-slate-600 flex items-center gap-1 mt-1">
                  <MapPin className="w-3.5 h-3.5 text-red-500 shrink-0" />
                  Room: <span className="font-semibold text-slate-800">{incident.roomName}</span>
                </p>
              )}
              <p className="text-xs text-slate-600 flex items-center gap-1">
                <Layers className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                Floor: <span className="text-slate-800">{incident.floorId}</span>
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5">
              <span className="text-xs text-slate-500 font-medium flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-slate-400" /> Detection Confidence & Timing
              </span>
              <div className="flex items-baseline gap-2">
                <span className="text-lg font-bold text-red-600">
                  {Math.round((incident.confidence || 0) * 100)}%
                </span>
                <span className="text-xs text-slate-500">score: {incident.confidence ?? 0}</span>
              </div>
              <p className="text-xs text-slate-600">
                Detected At: <span className="font-medium text-slate-800 font-mono">{formatDateTime(incident.detectedAt)}</span>
              </p>
              <div className="pt-1 border-t border-slate-200/60 flex items-center justify-between">
                <p className="text-xs text-slate-600">
                  Email:{' '}
                  <span className={incident.emailNotificationSent ? 'text-emerald-600 font-semibold' : 'text-slate-500'}>
                    {incident.emailNotificationSent ? 'Dispatched' : 'Pending / Skipped'}
                  </span>
                </p>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 px-2 text-[11px] text-blue-600 hover:text-blue-800 hover:bg-blue-50"
                  onClick={handleSendEmail}
                  disabled={emailLoading}
                >
                  {emailLoading ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Mail className="w-3 h-3 mr-1" />}
                  {incident.emailNotificationSent ? 'Resend' : 'Send Alert Email'}
                </Button>
              </div>
              {emailFeedback && (
                <p className="text-[11px] text-blue-600 font-medium">{emailFeedback}</p>
              )}
            </div>
          </div>

          {/* Audit / Lifecycle Attribution Details */}
          {(incident.acknowledgedAt || incident.investigatedAt || incident.resolvedAt) && (
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-700 space-y-1">
              <h5 className="font-bold text-slate-900 mb-1">Lifecycle Audit Trail</h5>
              {incident.acknowledgedAt && (
                <p>
                  &bull; Acknowledged at <span className="font-semibold">{incident.acknowledgedAt}</span>
                  {incident.acknowledgedBy && ` by UID: ${incident.acknowledgedBy}`}
                </p>
              )}
              {incident.investigatedAt && (
                <p>
                  &bull; Investigating initiated at <span className="font-semibold">{incident.investigatedAt}</span>
                  {incident.investigatedBy && ` by UID: ${incident.investigatedBy}`}
                </p>
              )}
              {incident.resolvedAt && (
                <p>
                  &bull; Resolved at <span className="font-semibold">{incident.resolvedAt}</span>
                  {incident.resolvedBy && ` by UID: ${incident.resolvedBy}`}
                  {incident.resolutionNote && (
                    <span className="block mt-0.5 text-slate-600 italic">Note: "{incident.resolutionNote}"</span>
                  )}
                </p>
              )}
            </div>
          )}

          {/* Resolution Note Prompt */}
          {showNoteInput && (
            <div className="p-4 rounded-xl bg-blue-50 border border-blue-200 space-y-3 animate-in fade-in">
              <h5 className="font-semibold text-blue-900 text-sm">
                {showNoteInput === 'RESOLVED' ? 'Resolve Incident Note' : 'False Alarm Note'}
              </h5>
              <textarea
                value={resolutionNote}
                onChange={(e) => setResolutionNote(e.target.value)}
                placeholder="Enter details on emergency response, cause of alarm, or verification findings..."
                className="w-full text-xs p-2.5 rounded-lg border border-slate-300 bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                rows={2}
              />
              <div className="flex items-center justify-end gap-2">
                <Button variant="outline" size="sm" onClick={() => setShowNoteInput(null)}>
                  Cancel
                </Button>
                <Button
                  size="sm"
                  className={showNoteInput === 'RESOLVED' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-slate-700'}
                  onClick={() => handleUpdateStatus(showNoteInput, resolutionNote)}
                  disabled={actionLoading}
                >
                  {actionLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : null}
                  Confirm {showNoteInput === 'RESOLVED' ? 'Resolution' : 'False Alarm'}
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer Lifecycle Actions */}
        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs text-slate-500">
            Current Status: <span className="font-bold text-slate-800">{incident.status}</span>
          </div>

          <div className="flex items-center gap-2">
            {/* Status transitions based on current state */}
            {incident.status === 'DETECTED' && !showNoteInput && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-slate-600 hover:text-slate-900"
                  onClick={() => setShowNoteInput('FALSE_ALARM')}
                  disabled={actionLoading}
                >
                  Mark False Alarm
                </Button>
                <Button
                  size="sm"
                  className="bg-amber-600 hover:bg-amber-700 text-white"
                  onClick={() => handleUpdateStatus('ACKNOWLEDGED')}
                  disabled={actionLoading}
                >
                  {actionLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : null}
                  Acknowledge Incident
                </Button>
              </>
            )}

            {incident.status === 'ACKNOWLEDGED' && !showNoteInput && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-slate-600 hover:text-slate-900"
                  onClick={() => setShowNoteInput('FALSE_ALARM')}
                  disabled={actionLoading}
                >
                  Mark False Alarm
                </Button>
                <Button
                  size="sm"
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                  onClick={() => handleUpdateStatus('INVESTIGATING')}
                  disabled={actionLoading}
                >
                  {actionLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : null}
                  Start Investigation
                </Button>
              </>
            )}

            {incident.status === 'INVESTIGATING' && !showNoteInput && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-slate-600 hover:text-slate-900"
                  onClick={() => setShowNoteInput('FALSE_ALARM')}
                  disabled={actionLoading}
                >
                  Mark False Alarm
                </Button>
                <Button
                  size="sm"
                  className="bg-emerald-600 hover:bg-emerald-700 text-white"
                  onClick={() => setShowNoteInput('RESOLVED')}
                  disabled={actionLoading}
                >
                  Resolve Incident
                </Button>
              </>
            )}

            <Button variant="outline" size="sm" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
