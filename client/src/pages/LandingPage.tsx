import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { ServiceStatus } from '@/components/ServiceStatus';
import { UserDropdown } from '@/components/layout/UserDropdown';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { 
  ShieldAlert, 
  Map, 
  Video, 
  Flame, 
  Cpu, 
  LogIn,
  ArrowRight,
  UserCheck,
  Building2,
  CheckCircle2,
  Lock,
  Layers
} from 'lucide-react';

export const LandingPage: React.FC = () => {
  const { user, role } = useAuth();

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-800 antialiased">
      {/* Top Header */}
      <header className="h-16 bg-white border-b border-slate-200/90 sticky top-0 z-50 px-4 sm:px-6 flex items-center justify-between shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-red-600 to-rose-500 text-white flex items-center justify-center shadow-xs">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <span className="text-xl font-bold tracking-tight text-slate-900">
            Evac<span className="text-red-600">AI</span>
          </span>
        </div>

        <div className="flex items-center gap-3">
          {user ? (
            <div className="flex items-center gap-3">
              <Link to={role === 'superadmin' ? '/superadmin' : '/management'}>
                <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white text-xs h-9 rounded-xl">
                  <UserCheck className="w-3.5 h-3.5 mr-1.5" />
                  Go to Dashboard
                </Button>
              </Link>
              <UserDropdown />
            </div>
          ) : (
            <Link to="/login">
              <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white text-xs h-9 px-4 rounded-xl shadow-xs">
                <LogIn className="w-3.5 h-3.5 mr-1.5" />
                Sign In
              </Button>
            </Link>
          )}
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-12">
        <div className="text-center max-w-3xl mx-auto space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-50 text-red-700 text-xs font-semibold border border-red-200">
            <Flame className="h-3.5 w-3.5 text-red-600" />
            AI-Powered Safety &amp; Emergency Evacuation System
          </div>
          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-slate-900 leading-tight">
            Intelligent Fire &amp; Smoke Detection, CCTV &amp; Floor Plan Platform
          </h1>
          <p className="text-base sm:text-lg text-slate-600 leading-relaxed max-w-2xl mx-auto">
            EvacAI integrates real-time computer vision, IoT camera hardware, 
            and interactive 2D floor plan safety zoning to safeguard shopping malls and large commercial facilities.
          </p>

          <div className="pt-3 flex justify-center gap-3">
            {user ? (
              <Link to={role === 'superadmin' ? '/superadmin' : '/management'}>
                <Button className="bg-blue-600 hover:bg-blue-700 text-white px-6 h-11 rounded-xl shadow-sm text-sm">
                  Access Your Dashboard
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </Link>
            ) : (
              <Link to="/login">
                <Button className="bg-blue-600 hover:bg-blue-700 text-white px-6 h-11 rounded-xl shadow-sm text-sm">
                  Sign In to Management Portal
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </Link>
            )}
          </div>
        </div>

        {/* Core Capabilities Showcase */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4">
          <Card className="bg-white border-slate-200 shadow-xs rounded-2xl">
            <CardHeader className="pb-3">
              <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center mb-2">
                <Map className="w-5 h-5" />
              </div>
              <CardTitle className="text-base font-bold text-slate-900">Interactive Floor Plan Editor</CardTitle>
              <CardDescription className="text-xs text-slate-500">
                Visual 2D canvas with React Konva
              </CardDescription>
            </CardHeader>
            <CardContent className="text-xs text-slate-600 space-y-2">
              <p>
                Create and customize building floor plans with drag-and-drop rooms, corridors, entry/exit doors, and camera markers.
              </p>
              <div className="pt-2 flex items-center gap-1.5 text-blue-600 font-semibold">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Resolution-independent normalized coordinates
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white border-slate-200 shadow-xs rounded-2xl">
            <CardHeader className="pb-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-2">
                <Cpu className="w-5 h-5" />
              </div>
              <CardTitle className="text-base font-bold text-slate-900">YOLOv8 Computer Vision</CardTitle>
              <CardDescription className="text-xs text-slate-500">
                Continuous frame inspection &amp; detection
              </CardDescription>
            </CardHeader>
            <CardContent className="text-xs text-slate-600 space-y-2">
              <p>
                Autonomous AI microservice running object detection on camera streams to immediately recognize fire and smoke events.
              </p>
              <div className="pt-2 flex items-center gap-1.5 text-emerald-600 font-semibold">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Cooldown window deduplication engine
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white border-slate-200 shadow-xs rounded-2xl">
            <CardHeader className="pb-3">
              <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center mb-2">
                <Lock className="w-5 h-5" />
              </div>
              <CardTitle className="text-base font-bold text-slate-900">Tenant Isolation &amp; RBAC</CardTitle>
              <CardDescription className="text-xs text-slate-500">
                Firebase Auth &amp; Custom Claims
              </CardDescription>
            </CardHeader>
            <CardContent className="text-xs text-slate-600 space-y-2">
              <p>
                Strict multi-tenant security guarantees that each mall management user can only access and modify their assigned mall data.
              </p>
              <div className="pt-2 flex items-center gap-1.5 text-purple-600 font-semibold">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Superadmin and Mall Management role boundaries
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Live Service Health Diagnostics */}
        <div className="pt-4">
          <ServiceStatus />
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white py-6 mt-12 text-center text-xs text-slate-500">
        <p className="font-semibold text-slate-700">EvacAI — Emergency Incident Management &amp; Safety Platform</p>
        <p className="mt-1 text-slate-400">All services running in local development mode.</p>
      </footer>
    </div>
  );
};
