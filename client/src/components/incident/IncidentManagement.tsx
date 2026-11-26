import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  AlertTriangle,
  Flame,
  Camera,
  Layers,
  MapPin,
  Clock,
  Eye,
  Filter,
  RefreshCw,
  FileCheck2,
  FileX2,
  Loader2,
  Building2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { IncidentRecord, IncidentStatus } from '@/types/incident';
import { IncidentModal } from './IncidentModal';
import { formatDateTime } from '@/lib/utils';
import { database } from '@/lib/firebase';
import { ref, onValue, off } from 'firebase/database';

interface IncidentManagementProps {
  mallId: string | null;
  getToken: () => Promise<string | null>;
  selectedIncidentId?: string | null;
  onClearSelectedIncident?: () => void;
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000';

function getStatusBadge(status?: IncidentStatus | string) {
  const norm = (status || 'DETECTED').toUpperCase();
  switch (norm) {
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
      return <Badge>{norm}</Badge>;
  }
}

export const IncidentManagement: React.FC<IncidentManagementProps> = ({
  mallId,
  getToken,
  selectedIncidentId,
  onClearSelectedIncident,
}) => {
  const [incidents, setIncidents] = useState<IncidentRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [activeModalIncident, setActiveModalIncident] = useState<IncidentRecord | null>(null);
  const [rtdbConnected, setRtdbConnected] = useState(false);

  // REST fetch (used on mount, manual refresh, or fallback)
  const fetchIncidents = useCallback(async () => {
    if (!mallId) return;
    setLoading(true);
    setFetchError(null);

    try {
      const token = await getToken();
      if (!token) {
        setLoading(false);
        return;
      }

      const baseUrl = API_BASE_URL.startsWith('http') ? API_BASE_URL : window.location.origin;
      const url = new URL(`${baseUrl}/api/malls/${mallId}/incidents`);
      if (statusFilter !== 'ALL') {
        url.searchParams.set('status', statusFilter);
      }
      url.searchParams.set('limit', '100');

      const res = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error?.message || `Failed to fetch incidents (HTTP ${res.status})`);
      }

      const data = await res.json();
      const list: IncidentRecord[] = (data.data?.incidents || []).filter(
        (i: any) => Boolean(i && typeof i === 'object' && i.incidentId)
      );

      setIncidents(list);
    } catch (err: any) {
      console.error('[IncidentManagement] Error loading incidents:', err);
      setFetchError(err.message || 'Error connecting to incident service');
    } finally {
      setLoading(false);
    }
  }, [mallId, statusFilter, getToken]);

  // 1. Initial REST fetch on mount or statusFilter change
  useEffect(() => {
    fetchIncidents();
  }, [fetchIncidents]);

  // 2. Real-time Firebase RTDB listener for instant incident stream
  useEffect(() => {
    if (!mallId) return;

    if (database) {
      setRtdbConnected(true);
      const incidentsRef = ref(database, `malls/${mallId}/incidents`);

      const unsubscribe = onValue(
        incidentsRef,
        (snapshot) => {
          if (!snapshot.exists()) {
            return;
          }
          const data = snapshot.val() as Record<string, IncidentRecord> | null;
          let list: IncidentRecord[] = data
            ? Object.values(data).filter((i: any) => Boolean(i && typeof i === 'object' && i.incidentId))
            : [];

          // Apply status filter client-side
          if (statusFilter !== 'ALL') {
            list = list.filter(
              (inc) => (inc.status || '').toUpperCase() === statusFilter.toUpperCase()
            );
          }

          // Sort most recent first
          list.sort((a, b) => {
            const timeA = new Date(a.detectedAt || a.createdAt || 0).getTime();
            const timeB = new Date(b.detectedAt || b.createdAt || 0).getTime();
            return timeB - timeA;
          });

          setIncidents(list);

          // Real-time update activeModalIncident if currently open
          setActiveModalIncident((prev) => {
            if (!prev) return null;
            return list.find((i) => i.incidentId === prev.incidentId) || prev;
          });
        },
        (error) => {
          console.warn('[IncidentManagement] RTDB listener error:', error.message);
          setRtdbConnected(false);
        }
      );

      return () => {
        off(incidentsRef);
      };
    } else {
      setRtdbConnected(false);
    }
  }, [mallId, statusFilter]);

  // Handle selectedIncidentId change from notification clicks or direct links
  useEffect(() => {
    if (!selectedIncidentId || !mallId) return;

    const found = incidents.find((i) => i.incidentId === selectedIncidentId);
    if (found) {
      setActiveModalIncident(found);
      return;
    }

    // If not in current list (e.g. filtered or paginated), fetch directly
    let isCancelled = false;
    async function loadSelected() {
      try {
        const token = await getToken();
        if (!token) return;

        const baseUrl = API_BASE_URL.startsWith('http') ? API_BASE_URL : window.location.origin;
        const res = await fetch(`${baseUrl}/api/malls/${mallId}/incidents/${selectedIncidentId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (res.ok) {
          const json = await res.json();
          if (json.success && json.data && !isCancelled) {
            setActiveModalIncident(json.data);
          }
        }
      } catch (err) {
        console.warn('[IncidentManagement] Could not load selected incident:', err);
      }
    }

    loadSelected();
    return () => {
      isCancelled = true;
    };
  }, [selectedIncidentId, incidents, mallId, getToken]);

  const handleStatusUpdated = (updated: IncidentRecord) => {
    setIncidents((prev) =>
      prev.map((i) => (i.incidentId === updated.incidentId ? updated : i))
    );
    setActiveModalIncident(updated);
  };

  const handleCloseModal = () => {
    setActiveModalIncident(null);
    if (onClearSelectedIncident) {
      onClearSelectedIncident();
    }
  };

  const statuses: { label: string; value: string }[] = [
    { label: 'All Incidents', value: 'ALL' },
    { label: 'Detected', value: 'DETECTED' },
    { label: 'Acknowledged', value: 'ACKNOWLEDGED' },
    { label: 'Investigating', value: 'INVESTIGATING' },
    { label: 'Resolved', value: 'RESOLVED' },
    { label: 'False Alarm', value: 'FALSE_ALARM' },
  ];

  if (!mallId) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-slate-400 gap-3">
        <Building2 className="w-12 h-12 text-slate-300" />
        <p className="text-sm font-medium text-slate-600">No shopping mall assigned to this account.</p>
        <p className="text-xs text-slate-400">Please contact your platform administrator.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12 w-full">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">
            Incident Pipeline & Hazard Events
          </h2>
          <p className="text-sm text-slate-500">
            Real-time fire and smoke detections reported by the AI vision pipeline.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {rtdbConnected && (
            <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-1 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Live
            </span>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={fetchIncidents}
            disabled={loading}
            className="text-slate-600 gap-1.5 hover:bg-slate-100"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Error Banner if any */}
      {fetchError && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center justify-between">
          <span>{fetchError}</span>
          <Button size="sm" variant="outline" onClick={fetchIncidents} className="h-6 text-[11px] px-2">
            Try Again
          </Button>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 border-b border-slate-200">
        {statuses.map((s) => (
          <button
            key={s.value}
            type="button"
            onClick={() => setStatusFilter(s.value)}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap ${
              statusFilter === s.value
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* Incidents Table / Cards */}
      <Card className="border border-slate-200 shadow-xs overflow-hidden">
        <CardContent className="p-0">
          {loading && incidents.length === 0 ? (
            <div className="py-20 flex flex-col items-center justify-center text-slate-400 gap-2">
              <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
              <p className="text-xs font-medium text-slate-500">Loading incident pipeline...</p>
            </div>
          ) : incidents.length === 0 ? (
            <div className="py-16 text-center px-4">
              <AlertTriangle className="w-10 h-10 text-slate-300 mx-auto mb-2" />
              <h3 className="text-base font-semibold text-slate-800">No Incidents Found</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                {statusFilter === 'ALL'
                  ? 'No fire or smoke incidents have been recorded yet.'
                  : `No incidents matching status "${statusFilter}".`}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-slate-500 text-xs uppercase font-semibold border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4">Hazard</th>
                    <th className="py-3 px-4">Camera & Location</th>
                    <th className="py-3 px-4">Confidence</th>
                    <th className="py-3 px-4">Detected At</th>
                    <th className="py-3 px-4">Evidence</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {incidents.map((inc) => {
                    const isFire = (inc.detectionType || '').toLowerCase().includes('fire');
                    return (
                      <tr
                        key={inc.incidentId}
                        onClick={() => setActiveModalIncident(inc)}
                        className="hover:bg-slate-50/80 cursor-pointer transition-colors"
                      >
                        {/* Hazard */}
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <div
                              className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                                isFire ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-700'
                              }`}
                            >
                              {isFire ? <Flame className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
                            </div>
                            <div>
                              <span className="font-bold text-slate-900 block text-xs uppercase">
                                {inc.detectionType || 'HAZARD'}
                              </span>
                              <span className="font-mono text-[10px] text-slate-400">
                                {inc.incidentId}
                              </span>
                            </div>
                          </div>
                        </td>

                        {/* Camera & Location */}
                        <td className="py-3 px-4">
                          <div className="text-xs font-semibold text-slate-800">{inc.cameraName || 'CCTV Camera'}</div>
                          <div className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                            {inc.roomName ? (
                              <>
                                <MapPin className="w-3 h-3 text-red-500" />
                                {inc.roomName}
                              </>
                            ) : (
                              `Floor ${inc.floorId || '1'}`
                            )}
                          </div>
                        </td>

                        {/* Confidence */}
                        <td className="py-3 px-4">
                          <span className="text-xs font-bold text-red-600">
                            {Math.round((inc.confidence || 0) * 100)}%
                          </span>
                        </td>

                        {/* Detected Time */}
                        <td className="py-3 px-4">
                          <div className="text-xs text-slate-800 font-medium font-mono whitespace-nowrap">
                            {formatDateTime(inc.detectedAt || inc.createdAt)}
                          </div>
                        </td>

                        {/* Evidence & Timeline Snaps */}
                        <td className="py-3 px-4">
                          {(() => {
                            const rawObs = inc.observations;
                            const obsCount = rawObs
                              ? (Array.isArray(rawObs)
                                  ? rawObs.length
                                  : typeof rawObs === 'object'
                                  ? Object.keys(rawObs).length
                                  : 0)
                              : inc.evidenceAvailable || inc.evidenceFileName
                              ? 1
                              : 0;

                            if (obsCount > 0) {
                              return (
                                <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-blue-700 bg-blue-50 px-2.5 py-0.5 rounded-full border border-blue-200">
                                  <Camera className="w-3.5 h-3.5 text-blue-600" />
                                  <span>{obsCount} Snap{obsCount > 1 ? 's' : ''} (Timeline)</span>
                                </span>
                              );
                            }
                            return (
                              <span className="inline-flex items-center gap-1 text-[11px] text-slate-400">
                                <FileX2 className="w-3 h-3" /> None
                              </span>
                            );
                          })()}
                        </td>

                        {/* Status */}
                        <td className="py-3 px-4">{getStatusBadge(inc.status)}</td>

                        {/* Actions */}
                        <td className="py-3 px-4 text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveModalIncident(inc);
                            }}
                            className="text-xs text-blue-600 hover:text-blue-800 hover:bg-blue-50 gap-1"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            Inspect
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Incident Detail & Evidence Modal */}
      {activeModalIncident && (
        <IncidentModal
          incident={activeModalIncident}
          mallId={mallId}
          getToken={getToken}
          onClose={handleCloseModal}
          onStatusUpdated={handleStatusUpdated}
        />
      )}
    </div>
  );
};
