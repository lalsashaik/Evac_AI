import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { getFirebaseStatus, FirebaseClientStatus } from '@/lib/firebase';
import { 
  Server, 
  BrainCircuit, 
  Flame, 
  RefreshCw, 
  CheckCircle2, 
  XCircle, 
  AlertCircle,
  Clock
} from 'lucide-react';

interface HealthData {
  service?: string;
  status?: string;
  uptime?: number;
  environment?: string;
  timestamp?: string;
  opencv_version?: string;
  cameras_active?: number;
  firebase?: {
    initialized: boolean;
    message: string;
  };
}

interface ServiceState {
  status: 'checking' | 'online' | 'offline';
  data: HealthData | null;
  error?: string;
  latencyMs?: number;
}

export const ServiceStatus: React.FC = () => {
  const backendBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000';
  const aiServiceBaseUrl = import.meta.env.VITE_AI_SERVICE_URL || 'http://localhost:8000';

  const [backend, setBackend] = useState<ServiceState>({ status: 'checking', data: null });
  const [aiService, setAiService] = useState<ServiceState>({ status: 'checking', data: null });
  const [firebase, setFirebase] = useState<FirebaseClientStatus>(getFirebaseStatus());
  const [lastChecked, setLastChecked] = useState<Date>(new Date());

  const checkServices = async () => {
    // 1. Check Backend
    setBackend((prev) => ({ ...prev, status: 'checking' }));
    const backendStart = performance.now();
    try {
      const res = await fetch(`${backendBaseUrl}/health`, { method: 'GET' });
      const latency = Math.round(performance.now() - backendStart);
      if (res.ok) {
        const json = await res.json();
        setBackend({ status: 'online', data: json, latencyMs: latency });
      } else {
        setBackend({
          status: 'offline',
          data: null,
          error: `HTTP ${res.status}: ${res.statusText}`,
          latencyMs: latency,
        });
      }
    } catch (err: any) {
      setBackend({
        status: 'offline',
        data: null,
        error: 'Connection refused or backend not running',
      });
    }

    // 2. Check AI Service
    setAiService((prev) => ({ ...prev, status: 'checking' }));
    const aiStart = performance.now();
    try {
      const res = await fetch(`${aiServiceBaseUrl}/health`, { method: 'GET' });
      const latency = Math.round(performance.now() - aiStart);
      if (res.ok) {
        const json = await res.json();
        setAiService({ status: 'online', data: json, latencyMs: latency });
      } else {
        setAiService({
          status: 'offline',
          data: null,
          error: `HTTP ${res.status}: ${res.statusText}`,
          latencyMs: latency,
        });
      }
    } catch (err: any) {
      setAiService({
        status: 'offline',
        data: null,
        error: 'Connection refused or AI service not running',
      });
    }

    // 3. Check Firebase Client Status
    setFirebase(getFirebaseStatus());
    setLastChecked(new Date());
  };

  useEffect(() => {
    checkServices();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Server className="h-5 w-5 text-primary" />
            System Service Status
          </h2>
          <p className="text-sm text-muted-foreground">
            Real-time diagnostic health probes across EvacAI microservices
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground flex items-center gap-1">
            <Clock className="h-3.5 w-3.5" />
            Checked: {lastChecked.toLocaleTimeString()}
          </span>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={checkServices}
            className="flex items-center gap-1.5"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Recheck
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Backend Node.js Service Card */}
        <Card className="border-border shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-lg">
                  <Server className="h-5 w-5" />
                </div>
                <div>
                  <CardTitle className="text-base font-semibold">Backend Server</CardTitle>
                  <CardDescription className="text-xs">Node.js + Express (TS)</CardDescription>
                </div>
              </div>
              {backend.status === 'online' && (
                <Badge variant="success" className="gap-1">
                  <CheckCircle2 className="h-3 w-3" /> Online
                </Badge>
              )}
              {backend.status === 'offline' && (
                <Badge variant="destructive" className="gap-1">
                  <XCircle className="h-3 w-3" /> Offline
                </Badge>
              )}
              {backend.status === 'checking' && (
                <Badge variant="secondary" className="gap-1">
                  <RefreshCw className="h-3 w-3 animate-spin" /> Checking
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="text-xs text-muted-foreground bg-muted/50 p-2.5 rounded-md font-mono">
              Port: 4000 | Endpoint: /health
            </div>
            {backend.status === 'online' && backend.data && (
              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Service:</span>
                  <span className="font-medium text-foreground">{backend.data.service}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Uptime:</span>
                  <span className="font-medium text-foreground">{backend.data.uptime}s</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Latency:</span>
                  <span className="font-medium text-foreground">{backend.latencyMs} ms</span>
                </div>
                <div className="pt-2 border-t text-[11px] text-muted-foreground">
                  <span className="font-semibold">Firebase Admin:</span>{' '}
                  {backend.data.firebase?.initialized ? (
                    <span className="text-emerald-600 font-medium">Configured</span>
                  ) : (
                    <span className="text-amber-600 font-medium">Pending Credentials</span>
                  )}
                </div>
              </div>
            )}
            {backend.status === 'offline' && (
              <p className="text-xs text-destructive">
                {backend.error || 'Server not reachable. Start via: npm --prefix server run dev'}
              </p>
            )}
          </CardContent>
        </Card>

        {/* Python AI Microservice Card */}
        <Card className="border-border shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-lg">
                  <BrainCircuit className="h-5 w-5" />
                </div>
                <div>
                  <CardTitle className="text-base font-semibold">AI Vision Service</CardTitle>
                  <CardDescription className="text-xs">Python + FastAPI + OpenCV</CardDescription>
                </div>
              </div>
              {aiService.status === 'online' && (
                <Badge variant="success" className="gap-1">
                  <CheckCircle2 className="h-3 w-3" /> Online
                </Badge>
              )}
              {aiService.status === 'offline' && (
                <Badge variant="destructive" className="gap-1">
                  <XCircle className="h-3 w-3" /> Offline
                </Badge>
              )}
              {aiService.status === 'checking' && (
                <Badge variant="secondary" className="gap-1">
                  <RefreshCw className="h-3 w-3 animate-spin" /> Checking
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="text-xs text-muted-foreground bg-muted/50 p-2.5 rounded-md font-mono">
              Port: 8000 | Endpoint: /health
            </div>
            {aiService.status === 'online' && aiService.data && (
              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Service:</span>
                  <span className="font-medium text-foreground">{aiService.data.service}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">OpenCV:</span>
                  <span className="font-medium text-foreground">{aiService.data.opencv_version || 'Available'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Latency:</span>
                  <span className="font-medium text-foreground">{aiService.latencyMs} ms</span>
                </div>
                <div className="pt-2 border-t text-[11px] text-muted-foreground">
                  <span className="font-semibold">Detector:</span> Model placeholder ready (YOLO in M6)
                </div>
              </div>
            )}
            {aiService.status === 'offline' && (
              <p className="text-xs text-destructive">
                {aiService.error || 'AI service not reachable. Start via: uvicorn main:app in ai-service'}
              </p>
            )}
          </CardContent>
        </Card>

        {/* Firebase Platform Card */}
        <Card className="border-border shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-lg">
                  <Flame className="h-5 w-5" />
                </div>
                <div>
                  <CardTitle className="text-base font-semibold">Firebase Platform</CardTitle>
                  <CardDescription className="text-xs">Auth, RTDB & Storage</CardDescription>
                </div>
              </div>
              {firebase.isConfigured ? (
                <Badge variant="success" className="gap-1">
                  <CheckCircle2 className="h-3 w-3" /> Configured
                </Badge>
              ) : (
                <Badge variant="warning" className="gap-1">
                  <AlertCircle className="h-3 w-3" /> Pending Credentials
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="text-xs text-muted-foreground bg-muted/50 p-2.5 rounded-md font-mono">
              Status: {firebase.isConfigured ? 'Ready' : 'Awaiting Config'}
            </div>
            <div className="space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">SDK Module:</span>
                <span className="font-medium text-emerald-600">Integrated</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Auth & DB:</span>
                <span className="font-medium text-foreground">
                  {firebase.isConfigured ? 'Connected' : 'Stubbed'}
                </span>
              </div>
              <div className="pt-2 border-t text-[11px] text-muted-foreground">
                <span className="font-semibold">Notice:</span>{' '}
                {firebase.isConfigured 
                  ? `Active with ${firebase.projectId}` 
                  : 'Placeholders present. Configure credentials via client/.env'}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
