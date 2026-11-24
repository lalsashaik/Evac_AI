import React from 'react';
import { ServiceStatus } from '@/components/ServiceStatus';
import { Badge } from '@/components/ui/badge';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { 
  ShieldAlert, 
  Layers, 
  Code2, 
  FileText, 
  Terminal, 
  CheckCircle, 
  Cpu, 
  Camera, 
  BellRing
} from 'lucide-react';

export const LandingPage: React.FC = () => {
  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950">
      {/* Top Navigation / Brand Bar */}
      <header className="border-b bg-card/80 backdrop-blur sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-600 text-white rounded-lg shadow-sm">
              <ShieldAlert className="h-6 w-6" />
            </div>
            <div>
              <span className="text-xl font-bold tracking-tight text-foreground">
                Evac<span className="text-red-600">AI</span>
              </span>
              <span className="ml-2 text-xs text-muted-foreground font-mono">v1.0.0</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs bg-muted/50 border-muted">
              Milestone 1: Project Foundation
            </Badge>
            <Badge variant="success" className="text-xs">
              M1 Scaffolding Complete
            </Badge>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-10">
        <div className="text-center max-w-3xl mx-auto space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-100 text-red-700 text-xs font-semibold dark:bg-red-950 dark:text-red-300">
            <ShieldAlert className="h-3.5 w-3.5" />
            College Major Project Prototype
          </div>
          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100">
            Intelligent Fire & Smoke Detection, CCTV & Evacuation Platform
          </h1>
          <p className="text-base sm:text-lg text-muted-foreground leading-relaxed">
            EvacAI integrates real-time computer vision, IoT microcontrollers (ESP32-CAM), 
            and interactive floor plan safety mapping to safeguard shopping malls and large facilities.
          </p>
        </div>

        {/* Live Service Health Probes */}
        <ServiceStatus />

        {/* System Architecture Overview Grid */}
        <div className="space-y-4 pt-4">
          <div>
            <h2 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
              <Layers className="h-5 w-5 text-primary" />
              EvacAI Architecture Stack
            </h2>
            <p className="text-sm text-muted-foreground">
              Approved 3-tier microservice foundation for Milestone 1
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2 text-primary">
                  <Code2 className="h-5 w-5" />
                  <CardTitle className="text-base">Frontend Web Application</CardTitle>
                </div>
                <CardDescription className="text-xs">React 18, Vite, TypeScript, Tailwind CSS, shadcn/ui</CardDescription>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground space-y-2">
                <p>
                  Interactive management interface featuring floor plan canvas, CCTV multi-stream feeds, 
                  incident acknowledgment, and role-based views.
                </p>
                <div className="pt-2 text-xs font-mono text-slate-700 dark:text-slate-300">
                  Directory: <code>client/</code>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2 text-primary">
                  <Terminal className="h-5 w-5" />
                  <CardTitle className="text-base">Core Backend API</CardTitle>
                </div>
                <CardDescription className="text-xs">Node.js, Express, TypeScript, Firebase Admin SDK</CardDescription>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground space-y-2">
                <p>
                  REST API orchestrating mall records, camera configurations, incident deduplication cooldowns, 
                  and secure administrative operations.
                </p>
                <div className="pt-2 text-xs font-mono text-slate-700 dark:text-slate-300">
                  Directory: <code>server/</code>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2 text-primary">
                  <Cpu className="h-5 w-5" />
                  <CardTitle className="text-base">AI Vision Engine</CardTitle>
                </div>
                <CardDescription className="text-xs">Python 3.13, FastAPI, OpenCV, Uvicorn, YOLOv8</CardDescription>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground space-y-2">
                <p>
                  Dedicated microservice pulling MJPEG frames from simulated video files and ESP32-CAMs, 
                  running real-time fire and smoke object detection.
                </p>
                <div className="pt-2 text-xs font-mono text-slate-700 dark:text-slate-300">
                  Directory: <code>ai-service/</code>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Milestone 1 Checklist & Future Milestones */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-emerald-600" />
                Milestone 1 Completed Deliverables
              </CardTitle>
              <CardDescription>Foundation scaffolding and validation</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-emerald-500 shrink-0" />
                  <span>Monorepo structure with <code>client/</code>, <code>server/</code>, <code>ai-service/</code></span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-emerald-500 shrink-0" />
                  <span>Vite React + TypeScript + Tailwind CSS + shadcn/ui configured</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-emerald-500 shrink-0" />
                  <span>Express Node.js TypeScript backend with <code>GET /health</code></span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-emerald-500 shrink-0" />
                  <span>FastAPI Python service with OpenCV integration & <code>GET /health</code></span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-emerald-500 shrink-0" />
                  <span>Centralized Firebase SDK modules (ready for credentials injection)</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-emerald-500 shrink-0" />
                  <span>Strict Git exclusions for secrets, credentials, and virtualenvs</span>
                </li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="h-4 w-4 text-primary" />
                Upcoming Milestones Roadmap
              </CardTitle>
              <CardDescription>Strictly deferred to subsequent phases</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2.5 text-sm text-muted-foreground">
                <div className="flex items-center justify-between p-2 rounded bg-muted/40 text-xs">
                  <span className="font-medium text-foreground">M2: Authentication & Role Guards</span>
                  <Badge variant="outline" className="text-[10px]">Next</Badge>
                </div>
                <div className="flex items-center justify-between p-2 rounded bg-muted/40 text-xs">
                  <span className="font-medium text-foreground">M3: Superadmin — Mall Management</span>
                  <Badge variant="outline" className="text-[10px]">Planned</Badge>
                </div>
                <div className="flex items-center justify-between p-2 rounded bg-muted/40 text-xs">
                  <span className="font-medium text-foreground">M4: Interactive Floor Plan Canvas Editor</span>
                  <Badge variant="outline" className="text-[10px]">Planned</Badge>
                </div>
                <div className="flex items-center justify-between p-2 rounded bg-muted/40 text-xs">
                  <span className="font-medium text-foreground">M5: Camera Management & CCTV Feeds</span>
                  <Badge variant="outline" className="text-[10px]">Planned</Badge>
                </div>
                <div className="flex items-center justify-between p-2 rounded bg-muted/40 text-xs">
                  <span className="font-medium text-foreground">M6: YOLO Fire & Smoke AI Detection</span>
                  <Badge variant="outline" className="text-[10px]">Planned</Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t bg-card py-6 mt-12 text-center text-xs text-muted-foreground">
        <p>EvacAI — College Major Project Prototype (Milestone 1)</p>
        <p className="mt-1 text-slate-400">All services running in local development mode.</p>
      </footer>
    </div>
  );
};
