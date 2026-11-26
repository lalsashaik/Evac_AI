import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { AppHeader } from '@/components/layout/AppHeader';
import { AppSidebar, SidebarItem } from '@/components/layout/AppSidebar';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import {
  LayoutDashboard,
  Building2,
  Video,
  ShieldCheck,
  CheckCircle2,
  ArrowRight,
  MapPin,
  Mail,
  Phone,
  User,
  Layers,
  Bell,
  AlertTriangle,
  Flame,
  Compass,
  Clock,
} from 'lucide-react';
import { FloorPlanEditor } from '@/pages/FloorPlanEditor';
import { CameraManagement } from '@/components/camera/CameraManagement';
import { MallSituation } from '@/pages/MallSituation';
import { IncidentManagement } from '@/components/incident/IncidentManagement';
import { NotificationRecord, IncidentRecord } from '@/types/incident';
import { formatDateTime } from '@/lib/utils';
import { database } from '@/lib/firebase';
import { ref, onValue, off } from 'firebase/database';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000';

function getOrdinalSuffix(n: number): string {
  if (n === 1) return 'st';
  if (n === 2) return 'nd';
  if (n === 3) return 'rd';
  return 'th';
}

function formatFloorCountLabel(totalFloors?: number): string {
  const count = Math.max(1, totalFloors || 1);
  if (count === 1) return 'Ground Floor only';
  if (count === 2) return 'Ground & 1st Floor (G+1)';
  const top = count - 1;
  return `Ground to ${top}${getOrdinalSuffix(top)} Floor (G+${top})`;
}

export const MallDashboard: React.FC = () => {
  const { user, profile, mallId, mallName: authMallName, mallInfo: authMallInfo, getToken } = useAuth();
  const [activeTab, setActiveTab] = useState<'overview' | 'situation' | 'floorplan' | 'cameras' | 'incidents'>('overview');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [selectedIncidentId, setSelectedIncidentId] = useState<string | null>(null);
  const [incomingToast, setIncomingToast] = useState<NotificationRecord | null>(null);
  const [mallInfo, setMallInfo] = useState<any>(authMallInfo || null);
  const [floorPlanSummary, setFloorPlanSummary] = useState<{
    shopCount: number;
    corridorCount: number;
    doorCount: number;
    cameraCount: number;
    floorName: string;
    hasPlan: boolean;
  }>({
    shopCount: 0,
    corridorCount: 0,
    doorCount: 0,
    cameraCount: 0,
    floorName: 'Ground Floor',
    hasPlan: false,
  });
  const [activeIncidents, setActiveIncidents] = useState<IncidentRecord[]>([]);
  const [recentAlerts, setRecentAlerts] = useState<IncidentRecord[]>([]);
  const [globalEmergencyStatus, setGlobalEmergencyStatus] = useState<'active' | 'normal'>('normal');

  // Real-time listener for global emergency status head: /emergency/status
  useEffect(() => {
    if (!database) return;
    const emergencyRef = ref(database, 'emergency/status');
    const unsub = onValue(emergencyRef, (snapshot) => {
      if (snapshot.exists()) {
        const val = snapshot.val();
        setGlobalEmergencyStatus(val === 'active' ? 'active' : 'normal');
      } else {
        setGlobalEmergencyStatus('normal');
      }
    });
    return () => off(emergencyRef);
  }, []);

  const sidebarItems: SidebarItem[] = [
    {
      id: 'overview',
      label: 'Overview',
      icon: <LayoutDashboard className="w-4 h-4" />,
    },
    {
      id: 'situation',
      label: 'Mall Situation',
      icon: <Compass className="w-4 h-4 text-blue-600" />,
    },
    {
      id: 'incidents',
      label: 'Incident Alerts',
      icon: <AlertTriangle className="w-4 h-4 text-red-500" />,
    },
    {
      id: 'floorplan',
      label: 'Floor Planning',
      icon: <Layers className="w-4 h-4" />,
    },
    {
      id: 'cameras',
      label: 'Surveillance Feeds',
      icon: <Video className="w-4 h-4" />,
    },
  ];

  // Sync authMallInfo if populated
  useEffect(() => {
    if (authMallInfo) {
      setMallInfo((prev: any) => prev || authMallInfo);
    }
  }, [authMallInfo]);

  // Load summary information for mall and floor plan
  useEffect(() => {
    if (!mallId) return;

    async function loadData() {
      try {
        const token = await getToken();
        if (!token) return;

        // Fetch mall info and floor plan summary in parallel
        const [mallRes, fpRes] = await Promise.all([
          fetch(`${API_BASE_URL}/api/malls/${mallId}/info`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
          fetch(`${API_BASE_URL}/api/malls/${mallId}/floorplan`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
        ]);

        if (mallRes.ok) {
          const mallJson = await mallRes.json();
          if (mallJson.success && mallJson.data) {
            setMallInfo(mallJson.data);
          }
        }

        if (fpRes.ok) {
          const fpJson = await fpRes.json();
          if (fpJson.success && fpJson.data) {
            const data = fpJson.data;
            const roomsList: any[] = Object.values(data.rooms || {});
            const shops = roomsList.filter((r) => r.type === 'room').length;
            const corridors = roomsList.filter((r) => r.type === 'corridor').length;
            const doors = Object.keys(data.doors || {}).length;
            const cameras = Object.keys(data.cameras || {}).length;
            setFloorPlanSummary({
              shopCount: shops,
              corridorCount: corridors,
              doorCount: doors,
              cameraCount: cameras,
              floorName: data.floorName || 'Ground Floor',
              hasPlan: true,
            });
          }
        }
      } catch (err) {
        console.warn('[MallDashboard] Note loading summary data:', err);
      }
    }

    loadData();
  }, [mallId, getToken]);

  // Real-time listener for incidents to reflect emergency alerts & latest notifications on Dashboard
  useEffect(() => {
    if (!mallId) return;

    if (database) {
      const incRef = ref(database, `malls/${mallId}/incidents`);
      const unsubscribe = onValue(
        incRef,
        (snapshot) => {
          if (!snapshot.exists()) {
            setActiveIncidents([]);
            setRecentAlerts([]);
            return;
          }
          const data = snapshot.val();
          const list: IncidentRecord[] = (Object.values(data || {}) as IncidentRecord[]).filter(
            (i: any) => Boolean(i && typeof i === 'object' && i.incidentId)
          );
          list.sort((a, b) => new Date(b.detectedAt || b.createdAt || 0).getTime() - new Date(a.detectedAt || a.createdAt || 0).getTime());

          const active = list.filter(
            (i) => i.status === 'DETECTED' || i.status === 'ACKNOWLEDGED' || i.status === 'INVESTIGATING'
          );
          setActiveIncidents(active);
          setRecentAlerts(list.slice(0, 4));
        },
        (err) => {
          console.warn('[MallDashboard] RTDB incidents listener error:', err);
        }
      );

      return () => {
        off(incRef);
      };
    } else {
      // REST fallback
      async function fetchIncidents() {
        try {
          const token = await getToken();
          if (!token) return;
          const res = await fetch(`${API_BASE_URL}/api/malls/${mallId}/incidents?limit=10`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (res.ok) {
            const json = await res.json();
            const list: IncidentRecord[] = json.data?.incidents || [];
            list.sort((a, b) => new Date(b.detectedAt).getTime() - new Date(a.detectedAt).getTime());
            const active = list.filter(
              (i) => i.status === 'DETECTED' || i.status === 'ACKNOWLEDGED' || i.status === 'INVESTIGATING'
            );
            setActiveIncidents(active);
            setRecentAlerts(list.slice(0, 4));
          }
        } catch (_) {}
      }
      fetchIncidents();
    }
  }, [mallId, getToken]);

  const activeMallInfo = mallInfo || authMallInfo;
  const displayName = profile?.displayName || user?.displayName || 'Mall Manager';
  const mallName = activeMallInfo?.name || profile?.mallName || authMallName || 'Assigned Shopping Mall';
  const effectiveFloors = activeMallInfo?.totalFloors !== undefined ? activeMallInfo.totalFloors : 1;
  const allowedFloorsLabel = formatFloorCountLabel(effectiveFloors);

  return (
    <div className="h-screen w-screen bg-slate-50 flex flex-col overflow-hidden antialiased text-slate-800">
      {/* Top Navigation Header: Logo + Title on left, Avatar + Display Name + Dropdown on right */}
      <AppHeader
        onSelectIncident={(incId) => {
          setSelectedIncidentId(incId);
          setActiveTab('incidents');
        }}
        onNewNotificationAlert={(notif) => {
          setIncomingToast(notif);
          setTimeout(() => {
            setIncomingToast((prev) => (prev?.notificationId === notif.notificationId ? null : prev));
          }, 8000);
        }}
      />

      {/* Main Container with Collapsible Fixed Sidebar */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Collapsible Sidebar */}
        <AppSidebar
          items={sidebarItems}
          activeId={activeTab}
          onSelect={(id) => setActiveTab(id as 'overview' | 'situation' | 'floorplan' | 'cameras' | 'incidents')}
          isCollapsed={isSidebarCollapsed}
          onToggleCollapse={() => setIsSidebarCollapsed((prev) => !prev)}
        />

        {/* Content Pane */}
        <main
          className={`flex-1 h-full min-h-0 ${
            activeTab === 'floorplan'
              ? 'p-2.5 overflow-hidden flex flex-col'
              : activeTab === 'overview'
              ? 'p-3.5 sm:p-4 overflow-hidden flex flex-col justify-between gap-3'
              : 'p-3.5 sm:p-4 overflow-y-auto flex flex-col'
          }`}
        >
          {/* OVERVIEW TAB — Fitted to Screen with No Scroll */}
          {activeTab === 'overview' && (
            <div className="h-full flex flex-col justify-between overflow-hidden gap-3 animate-in fade-in duration-200">
              {/* 1. Welcome Message & Quick Controls Header */}
              <div className="bg-white rounded-xl p-3.5 sm:px-5 border border-slate-200/90 shadow-xs flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 border border-blue-100 flex items-center justify-center shrink-0">
                    <Building2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h1 className="text-base sm:text-lg font-bold tracking-tight text-slate-900 leading-tight">
                      Welcome back, {displayName}
                    </h1>
                    <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-slate-700">{mallName}</span>
                      <span className="text-slate-300">·</span>
                      <span className="inline-flex items-center gap-1 text-blue-700 font-medium bg-blue-50 px-2 py-0.5 rounded-full text-[11px]">
                        Allowed Levels: {allowedFloorsLabel}
                      </span>
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    size="sm"
                    onClick={() => setActiveTab('floorplan')}
                    className="bg-blue-600 hover:bg-blue-700 text-white shadow-xs text-xs h-8 px-3"
                  >
                    <Layers className="w-3.5 h-3.5 mr-1.5" />
                    Open Floor Planning
                  </Button>
                </div>
              </div>

              {/* 2. Top Metric Cards: Assigned Property (No ID), Active Layout, Placed Cameras, Emergency Alert */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 shrink-0">
                {/* Card 1: Assigned Property (Mall Name, NOT ID) */}
                <Card className="bg-white border-slate-200/90 shadow-xs">
                  <CardContent className="p-3.5 flex items-center justify-between">
                    <div className="min-w-0 pr-2">
                      <p className="text-[11px] font-medium text-slate-500">Assigned Property</p>
                      <p className="text-base font-bold text-slate-900 mt-0.5 truncate" title={mallName}>
                        {mallName}
                      </p>
                      <p className="text-[11px] text-slate-400 mt-0.5 truncate">
                        {mallInfo?.address || 'Authorized Commercial Facility'}
                      </p>
                    </div>
                    <div className="w-9 h-9 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                      <Building2 className="w-4 h-4" />
                    </div>
                  </CardContent>
                </Card>

                {/* Card 2: Active Layout */}
                <Card className="bg-white border-slate-200/90 shadow-xs">
                  <CardContent className="p-3.5 flex items-center justify-between">
                    <div className="min-w-0 pr-2">
                      <p className="text-[11px] font-medium text-slate-500">Active Layout</p>
                      <p className="text-base font-bold text-slate-900 mt-0.5 truncate">
                        {floorPlanSummary.floorName}
                      </p>
                      <p className="text-[11px] text-emerald-600 font-medium mt-0.5 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" />
                        {floorPlanSummary.hasPlan ? `Configured (${allowedFloorsLabel})` : 'Pending Setup'}
                      </p>
                    </div>
                    <div className="w-9 h-9 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                      <Layers className="w-4 h-4" />
                    </div>
                  </CardContent>
                </Card>

                {/* Card 3: Placed Cameras */}
                <Card
                  onClick={() => setActiveTab('cameras')}
                  className="bg-white border-slate-200/90 shadow-xs hover:border-purple-300 hover:shadow-sm transition-all cursor-pointer group"
                >
                  <CardContent className="p-3.5 flex items-center justify-between">
                    <div className="min-w-0 pr-2">
                      <p className="text-[11px] font-medium text-slate-500 group-hover:text-purple-600 transition-colors">
                        Surveillance Cameras
                      </p>
                      <p className="text-base font-bold text-slate-900 mt-0.5 truncate">
                        {floorPlanSummary.cameraCount} Cameras
                      </p>
                      <p className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                        Manage CCTV Feeds →
                      </p>
                    </div>
                    <div className="w-9 h-9 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center shrink-0 group-hover:bg-purple-100 transition-colors">
                      <Video className="w-4 h-4" />
                    </div>
                  </CardContent>
                </Card>

                {/* Card 4: Emergency Alert Card (Dynamic Red Card on Active Hazard or Global Emergency) */}
                {activeIncidents.length > 0 || globalEmergencyStatus === 'active' ? (
                  <Card
                    onClick={() => setActiveTab('incidents')}
                    className="bg-red-600 border-red-700 text-white shadow-md hover:bg-red-700 transition-all cursor-pointer animate-pulse group"
                  >
                    <CardContent className="p-3.5 flex items-center justify-between">
                      <div className="min-w-0 pr-2">
                        <div className="flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-white animate-ping" />
                          <p className="text-[11px] font-bold uppercase tracking-wider text-red-100">
                            Emergency Alert Active
                          </p>
                        </div>
                        <p className="text-base font-extrabold text-white mt-0.5 truncate">
                          {activeIncidents.length > 0
                            ? `${activeIncidents.length} Active Hazard${activeIncidents.length > 1 ? 's' : ''}`
                            : 'Active Hazard Alert'}
                        </p>
                        <p className="text-[11px] text-red-100 mt-0.5 truncate font-medium">
                          {activeIncidents[0]
                            ? `${(activeIncidents[0].detectionType || 'HAZARD').toUpperCase()} at ${activeIncidents[0].cameraName || 'Facility'} →`
                            : 'Facility emergency active →'}
                        </p>
                      </div>
                      <div className="w-9 h-9 rounded-lg bg-white/20 text-white flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                        <Flame className="w-5 h-5 animate-bounce" />
                      </div>
                    </CardContent>
                  </Card>
                ) : (
                  <Card
                    onClick={() => setActiveTab('incidents')}
                    className="bg-white border-slate-200/90 shadow-xs hover:border-slate-300 transition-all cursor-pointer"
                  >
                    <CardContent className="p-3.5 flex items-center justify-between">
                      <div className="min-w-0 pr-2">
                        <p className="text-[11px] font-medium text-slate-500">Emergency Alert</p>
                        <p className="text-base font-bold text-emerald-700 mt-0.5 truncate">
                          No Active Alerts
                        </p>
                        <p className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                          Normal Operational Mode
                        </p>
                      </div>
                      <div className="w-9 h-9 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                        <ShieldCheck className="w-4 h-4" />
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>

              {/* 3. Bottom Panels: Floor Map, Facility Information, Notifications */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 flex-1 min-h-0 overflow-hidden">
                {/* Panel 1: Floor Map & Architecture */}
                <Card className="bg-white border-slate-200/90 shadow-xs flex flex-col justify-between overflow-hidden">
                  <CardHeader className="p-3.5 pb-2 border-b border-slate-100 shrink-0">
                    <CardTitle className="text-xs font-bold text-slate-900 flex items-center gap-2 uppercase tracking-wider">
                      <Compass className="w-3.5 h-3.5 text-blue-600" />
                      Floor Map &amp; Architecture
                    </CardTitle>
                    <CardDescription className="text-[11px] text-slate-500">
                      Interactive building evacuation blueprint
                    </CardDescription>
                  </CardHeader>

                  <CardContent className="p-3.5 flex-1 min-h-0 flex flex-col justify-between">
                    <div className="space-y-2">
                      <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200/80 text-xs">
                        <div className="font-semibold text-slate-800">
                          {floorPlanSummary.hasPlan ? floorPlanSummary.floorName : 'Floor Plan Setup'}
                        </div>
                        <div className="text-[11px] text-slate-500 mt-1">
                          {floorPlanSummary.hasPlan
                            ? `${floorPlanSummary.shopCount} Shops · ${floorPlanSummary.corridorCount} Corridors · ${floorPlanSummary.doorCount} Exits · ${floorPlanSummary.cameraCount} Cameras`
                            : 'No elements placed yet. Open the floor planning canvas to begin.'}
                        </div>
                      </div>

                      <div className="text-[11px] text-slate-500 space-y-1">
                        <div className="flex items-center justify-between">
                          <span>Allowed Building Levels:</span>
                          <span className="font-semibold text-slate-700">{allowedFloorsLabel}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span>Corridor Walkways:</span>
                          <span className="font-semibold text-emerald-700">{floorPlanSummary.corridorCount} Pathways</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span>Emergency Exits:</span>
                          <span className="font-semibold text-red-600">{floorPlanSummary.doorCount} Exits / Doors</span>
                        </div>
                      </div>
                    </div>

                    <Button
                      size="sm"
                      onClick={() => setActiveTab('floorplan')}
                      className="w-full bg-blue-600 hover:bg-blue-700 text-white text-xs h-8 mt-2"
                    >
                      Launch Floor Planning Canvas
                      <ArrowRight className="w-3 h-3 ml-1.5" />
                    </Button>
                  </CardContent>
                </Card>

                {/* Panel 2: Facility Information */}
                <Card className="bg-white border-slate-200/90 shadow-xs flex flex-col overflow-hidden">
                  <CardHeader className="p-3.5 pb-2 border-b border-slate-100 shrink-0">
                    <CardTitle className="text-xs font-bold text-slate-900 flex items-center gap-2 uppercase tracking-wider">
                      <Building2 className="w-3.5 h-3.5 text-blue-600" />
                      Facility Information
                    </CardTitle>
                    <CardDescription className="text-[11px] text-slate-500">
                      Official commercial property details
                    </CardDescription>
                  </CardHeader>

                  <CardContent className="p-3.5 flex-1 min-h-0 overflow-y-auto space-y-2 text-xs">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">Mall Property</span>
                      <span className="font-bold text-slate-800 text-xs block">{mallName}</span>
                    </div>

                    {mallInfo?.address && (
                      <div>
                        <span className="text-[10px] uppercase font-bold text-slate-400 block">Address</span>
                        <span className="text-slate-700 block truncate">{mallInfo.address}</span>
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <span className="text-[10px] uppercase font-bold text-slate-400 block">Manager</span>
                        <span className="text-slate-700 block truncate">{displayName}</span>
                      </div>
                      <div>
                        <span className="text-[10px] uppercase font-bold text-slate-400 block">Structure</span>
                        <span className="text-slate-700 font-semibold block">{allowedFloorsLabel}</span>
                      </div>
                    </div>

                    {mallInfo?.contactEmail && (
                      <div>
                        <span className="text-[10px] uppercase font-bold text-slate-400 block">Official Contact</span>
                        <span className="text-slate-700 font-mono text-[11px] block truncate">{mallInfo.contactEmail}</span>
                      </div>
                    )}

                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
                      <span className="text-slate-400">System Status:</span>
                      <span className="font-semibold text-emerald-700 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                        Operational
                      </span>
                    </div>
                  </CardContent>
                </Card>

                {/* Panel 3: Notifications & Latest 4 Alerts */}
                <Card className="bg-white border-slate-200/90 shadow-xs flex flex-col overflow-hidden">
                  <CardHeader className="p-3.5 pb-2 border-b border-slate-100 shrink-0 flex flex-row items-center justify-between">
                    <div>
                      <CardTitle className="text-xs font-bold text-slate-900 flex items-center gap-2 uppercase tracking-wider">
                        <Bell className="w-3.5 h-3.5 text-blue-600" />
                        Notifications &amp; Alerts
                      </CardTitle>
                      <CardDescription className="text-[11px] text-slate-500">
                        {recentAlerts.length > 0 ? `Latest ${recentAlerts.length} hazard alerts` : 'Real-time operational system status'}
                      </CardDescription>
                    </div>
                    {recentAlerts.length > 0 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setActiveTab('incidents')}
                        className="text-[11px] text-blue-600 hover:text-blue-800 hover:bg-blue-50 h-7 px-2"
                      >
                        View All →
                      </Button>
                    )}
                  </CardHeader>

                  <CardContent className="p-3.5 flex-1 min-h-0 overflow-y-auto space-y-2 text-xs">
                    {recentAlerts.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-6 text-slate-400 text-center">
                        <ShieldCheck className="w-8 h-8 text-emerald-400 mb-1.5" />
                        <p className="text-xs font-semibold text-slate-700">No Active Alerts</p>
                        <p className="text-[11px] text-slate-400 mt-0.5">All surveillance zones report clear status.</p>
                      </div>
                    ) : (
                      recentAlerts.map((alert) => {
                        const isHazard = alert.detectionType?.toLowerCase().includes('fire') || alert.detectionType?.toLowerCase().includes('smoke');
                        const isUnresolved = alert.status === 'DETECTED' || alert.status === 'INVESTIGATING';

                        return (
                          <div
                            key={alert.incidentId}
                            onClick={() => {
                              setSelectedIncidentId(alert.incidentId);
                              setActiveTab('incidents');
                            }}
                            className={`p-2.5 rounded-lg border text-left transition-all cursor-pointer flex items-start gap-2.5 group ${
                              isHazard && isUnresolved
                                ? 'bg-red-50/80 border-red-200 hover:bg-red-100/90 hover:border-red-300'
                                : 'bg-slate-50 border-slate-200 hover:bg-blue-50/70 hover:border-blue-200'
                            }`}
                          >
                            <div
                              className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                                isHazard && isUnresolved
                                  ? 'bg-red-600 text-white animate-pulse'
                                  : 'bg-slate-200 text-slate-700 group-hover:bg-blue-600 group-hover:text-white'
                              }`}
                            >
                              {isHazard ? (
                                <Flame className="w-3.5 h-3.5" />
                              ) : (
                                <AlertTriangle className="w-3.5 h-3.5" />
                              )}
                            </div>

                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-1">
                                <span
                                  className={`font-bold text-xs truncate ${
                                    isHazard && isUnresolved ? 'text-red-900' : 'text-slate-900 group-hover:text-blue-700'
                                  }`}
                                >
                                  {alert.detectionType?.toUpperCase()} Alert
                                </span>
                                <span
                                  className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full shrink-0 ${
                                    alert.status === 'DETECTED'
                                      ? 'bg-red-600 text-white'
                                      : alert.status === 'RESOLVED'
                                      ? 'bg-emerald-100 text-emerald-800'
                                      : 'bg-amber-100 text-amber-800'
                                  }`}
                                >
                                  {alert.status}
                                </span>
                              </div>

                              <p className="text-[11px] text-slate-600 truncate mt-0.5">
                                Camera: <span className="font-semibold text-slate-800">{alert.cameraName || 'CCTV'}</span>{alert.roomName ? ` · ${alert.roomName}` : ''}
                              </p>

                              <p className="text-[10px] text-slate-400 mt-0.5 flex items-center gap-1 font-mono">
                                <Clock className="w-2.5 h-2.5 text-slate-400" />
                                {formatDateTime(alert.detectedAt)}
                              </p>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          )}

          {/* MALL SITUATION BLUEPRINT TAB */}
          {activeTab === 'situation' && (
            <div className="flex-1 min-h-0 animate-in fade-in duration-200">
              {!mallId ? (
                <div className="flex flex-col items-center justify-center py-24 text-slate-400 gap-3">
                  <Building2 className="w-12 h-12 text-slate-300" />
                  <p className="text-sm font-medium text-slate-600">No shopping mall assigned to this account.</p>
                  <p className="text-xs text-slate-400">Please contact your platform administrator.</p>
                </div>
              ) : (
                <MallSituation
                  totalFloors={effectiveFloors}
                  onNavigateToCameras={() => setActiveTab('cameras')}
                  onNavigateToFloorPlan={() => setActiveTab('floorplan')}
                />
              )}
            </div>
          )}

          {/* FLOOR PLAN TAB */}
          {activeTab === 'floorplan' && (
            <div className="h-full flex flex-col animate-in fade-in duration-200">
              {!mallId ? (
                <div className="flex flex-col items-center justify-center py-24 text-slate-400 gap-3">
                  <Building2 className="w-12 h-12 text-slate-300" />
                  <p className="text-sm font-medium text-slate-600">No shopping mall assigned to this account.</p>
                  <p className="text-xs text-slate-400">Please contact your platform administrator.</p>
                </div>
              ) : (
                <FloorPlanEditor totalFloors={effectiveFloors} />
              )}
            </div>
          )}

          {/* INCIDENTS & HAZARDS TAB (M7) */}
          {activeTab === 'incidents' && (
            <div className="flex-1 min-h-0 animate-in fade-in duration-200">
              {!mallId ? (
                <div className="flex flex-col items-center justify-center py-24 text-slate-400 gap-3">
                  <Building2 className="w-12 h-12 text-slate-300" />
                  <p className="text-sm font-medium text-slate-600">No shopping mall assigned to this account.</p>
                  <p className="text-xs text-slate-400">Please contact your platform administrator.</p>
                </div>
              ) : (
                <IncidentManagement
                  mallId={mallId}
                  getToken={getToken}
                  selectedIncidentId={selectedIncidentId}
                  onClearSelectedIncident={() => setSelectedIncidentId(null)}
                />
              )}
            </div>
          )}

          {/* CAMERAS & SURVEILLANCE TAB */}
          {activeTab === 'cameras' && (
            <div className="flex-1 min-h-0 animate-in fade-in duration-200">
              {!mallId ? (
                <div className="flex flex-col items-center justify-center py-24 text-slate-400 gap-3">
                  <Building2 className="w-12 h-12 text-slate-300" />
                  <p className="text-sm font-medium text-slate-600">No shopping mall assigned to this account.</p>
                  <p className="text-xs text-slate-400">Please contact your platform administrator.</p>
                </div>
              ) : (
                <CameraManagement
                  totalFloors={effectiveFloors}
                  onNavigateToFloorPlan={() => setActiveTab('floorplan')}
                  onNavigateToSituation={() => setActiveTab('situation')}
                />
              )}
            </div>
          )}
        </main>
      </div>

      {/* Floating Emergency Toast Alert (M7) */}
      {incomingToast && (
        <div className="fixed top-20 right-6 z-50 max-w-md w-full bg-red-600 text-white rounded-xl shadow-2xl p-4 flex items-start gap-3 border-2 border-white/20 animate-in slide-in-from-top-4 duration-200 cursor-pointer hover:bg-red-700 transition-colors">
          <div className="w-9 h-9 rounded-lg bg-white/20 flex items-center justify-center shrink-0">
            <Flame className="w-5 h-5 text-white animate-bounce" />
          </div>
          <div
            className="flex-1 min-w-0"
            onClick={() => {
              if (incomingToast.incidentId) {
                setSelectedIncidentId(incomingToast.incidentId);
              }
              setActiveTab('incidents');
              setIncomingToast(null);
            }}
          >
            <div className="flex items-center gap-2">
              <span className="font-bold text-xs uppercase tracking-wider bg-white/25 px-2 py-0.5 rounded">
                Emergency Alert
              </span>
              <span className="text-[10px] text-white/80">Just now</span>
            </div>
            <p className="text-sm font-semibold mt-1 leading-snug">{incomingToast.message}</p>
            <p className="text-xs text-white/80 mt-1 flex items-center gap-1 underline">
              Click to inspect hazard & evidence &rarr;
            </p>
          </div>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setIncomingToast(null);
            }}
            className="text-white/70 hover:text-white p-1"
          >
            &times;
          </button>
        </div>
      )}
    </div>
  );
};
