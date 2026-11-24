import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { AppHeader } from '@/components/layout/AppHeader';
import { AppSidebar, SidebarItem } from '@/components/layout/AppSidebar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Building2,
  Users,
  ShieldCheck,
  Plus,
  Search,
  Edit2,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  MapPin,
  Phone,
  Mail,
  User,
  Power,
  Layers,
  ArrowRight,
  LayoutDashboard
} from 'lucide-react';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000';

interface MallItem {
  mallId: string;
  name: string;
  address?: string;
  contactEmail?: string;
  contactPhone?: string;
  contactPerson?: string;
  createdAt: string;
  updatedAt?: string;
  createdBy: string;
  isActive: boolean;
  totalFloors?: number;
  managementUid?: string | null;
  managementEmail?: string | null;
  managementName?: string | null;
}

interface ManagementUserItem {
  uid: string;
  email: string;
  displayName: string;
  role: string;
  mallId: string | null;
  mallName: string;
  isActive: boolean;
  createdAt: string;
}

interface PlatformStats {
  totalMalls: number;
  activeMalls: number;
  totalManagementAccounts: number;
}

function formatFloorsBadge(totalFloors?: number): string {
  const count = Math.max(1, totalFloors || 1);
  if (count === 1) return 'Ground Floor only';
  if (count === 2) return 'Ground & 1st Floor (G+1)';
  const top = count - 1;
  const suffix = top === 1 ? 'st' : top === 2 ? 'nd' : top === 3 ? 'rd' : 'th';
  return `Ground to ${top}${suffix} Floor (G+${top})`;
}

export const SuperadminDashboard: React.FC = () => {
  const { user, profile, getToken } = useAuth();
  const displayName = profile?.displayName || user?.displayName || 'Administrator';

  // Navigation tab: 'overview' | 'malls' | 'accounts'
  const [activeTab, setActiveTab] = useState<'overview' | 'malls' | 'accounts'>('overview');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  // State data
  const [stats, setStats] = useState<PlatformStats>({ totalMalls: 0, activeMalls: 0, totalManagementAccounts: 0 });
  const [malls, setMalls] = useState<MallItem[]>([]);
  const [accounts, setAccounts] = useState<ManagementUserItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Modals state
  const [isCreateMallOpen, setIsCreateMallOpen] = useState(false);
  const [isEditMallOpen, setIsEditMallOpen] = useState(false);
  const [isViewMallOpen, setIsViewMallOpen] = useState(false);
  const [isCreateAccountOpen, setIsCreateAccountOpen] = useState(false);
  const [isConfirmDeactivateOpen, setIsConfirmDeactivateOpen] = useState(false);

  // Selected items for editing / viewing / deactivating
  const [selectedMall, setSelectedMall] = useState<MallItem | null>(null);

  // Form states
  const [mallFormData, setMallFormData] = useState({
    name: '',
    address: '',
    contactPerson: '',
    contactPhone: '',
    contactEmail: '',
    totalFloors: 1,
  });

  const [editMallFormData, setEditMallFormData] = useState({
    name: '',
    address: '',
    contactPerson: '',
    contactPhone: '',
    contactEmail: '',
    totalFloors: 1,
    isActive: true,
  });

  const [accountFormData, setAccountFormData] = useState({
    displayName: '',
    email: '',
    password: '',
    mallId: '',
  });
  const [showPassword, setShowPassword] = useState(false);

  // UI status feedback
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [successBanner, setSuccessBanner] = useState<string | null>(null);

  const triggerSuccess = (msg: string) => {
    setSuccessBanner(msg);
    setTimeout(() => setSuccessBanner(null), 4000);
  };

  // Fetch all data
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const token = await getToken();
      if (!token) return;

      const headers = { Authorization: `Bearer ${token}` };

      const [statsRes, mallsRes, usersRes] = await Promise.all([
        fetch(`${API_BASE_URL}/api/admin/stats`, { headers }),
        fetch(`${API_BASE_URL}/api/admin/malls`, { headers }),
        fetch(`${API_BASE_URL}/api/admin/management-users`, { headers }),
      ]);

      if (statsRes.ok) {
        const statsJson = await statsRes.json();
        if (statsJson.success) setStats(statsJson.data);
      }

      if (mallsRes.ok) {
        const mallsJson = await mallsRes.json();
        if (mallsJson.success) setMalls(mallsJson.data.malls || []);
      }

      if (usersRes.ok) {
        const usersJson = await usersRes.json();
        if (usersJson.success) setAccounts(usersJson.data.users || []);
      }
    } catch (err: any) {
      console.error('[SuperadminDashboard] Error fetching data:', err);
    } finally {
      setLoading(false);
    }
  }, [getToken]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Handle Create Mall Submit
  const handleCreateMallSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!mallFormData.name.trim()) {
      setFormError('Mall name is required.');
      return;
    }

    setFormSubmitting(true);
    try {
      const token = await getToken();
      const res = await fetch(`${API_BASE_URL}/api/admin/malls`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(mallFormData),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        setFormError(json.error?.message || 'Failed to create mall.');
        return;
      }

      triggerSuccess(`Mall '${json.data.name}' registered successfully! ID: ${json.data.mallId}`);
      setIsCreateMallOpen(false);
      setMallFormData({ name: '', address: '', contactPerson: '', contactPhone: '', contactEmail: '', totalFloors: 1 });
      await fetchData();
    } catch (err: any) {
      setFormError(err.message || 'An unexpected error occurred.');
    } finally {
      setFormSubmitting(false);
    }
  };

  // Open Edit Modal
  const openEditModal = (mall: MallItem) => {
    setSelectedMall(mall);
    setEditMallFormData({
      name: mall.name || '',
      address: mall.address || '',
      contactPerson: mall.contactPerson || '',
      contactPhone: mall.contactPhone || '',
      contactEmail: mall.contactEmail || '',
      totalFloors: mall.totalFloors !== undefined ? mall.totalFloors : 1,
      isActive: mall.isActive !== false,
    });
    setFormError(null);
    setIsEditMallOpen(true);
  };

  // Handle Edit Mall Submit
  const handleEditMallSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMall) return;
    setFormError(null);

    if (!editMallFormData.name.trim()) {
      setFormError('Mall name cannot be empty.');
      return;
    }

    setFormSubmitting(true);
    try {
      const token = await getToken();
      const res = await fetch(`${API_BASE_URL}/api/admin/malls/${selectedMall.mallId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(editMallFormData),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        setFormError(json.error?.message || 'Failed to update mall.');
        return;
      }

      triggerSuccess(`Mall '${selectedMall.name}' updated successfully.`);
      setIsEditMallOpen(false);
      setSelectedMall(null);
      await fetchData();
    } catch (err: any) {
      setFormError(err.message || 'An unexpected error occurred.');
    } finally {
      setFormSubmitting(false);
    }
  };

  // Prompt Deactivate / Activate
  const promptToggleStatus = (mall: MallItem) => {
    setSelectedMall(mall);
    setIsConfirmDeactivateOpen(true);
  };

  const handleConfirmToggleStatus = async () => {
    if (!selectedMall) return;
    setFormSubmitting(true);
    try {
      const token = await getToken();
      const newStatus = !selectedMall.isActive;

      const res = await fetch(`${API_BASE_URL}/api/admin/malls/${selectedMall.mallId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ isActive: newStatus }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        setFormError(json.error?.message || 'Failed to update mall status.');
        return;
      }

      triggerSuccess(
        `Mall '${selectedMall.name}' is now ${newStatus ? 'activated' : 'deactivated'}.`
      );
      setIsConfirmDeactivateOpen(false);
      setSelectedMall(null);
      await fetchData();
    } catch (err: any) {
      setFormError(err.message || 'Failed to update status.');
    } finally {
      setFormSubmitting(false);
    }
  };

  // Handle Create Management Account Submit
  const handleCreateAccountSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!accountFormData.displayName.trim()) {
      setFormError('Manager name is required.');
      return;
    }
    if (!accountFormData.email.trim() || !accountFormData.email.includes('@')) {
      setFormError('A valid email address is required.');
      return;
    }
    if (!accountFormData.password || accountFormData.password.length < 6) {
      setFormError('Password must be at least 6 characters.');
      return;
    }
    if (!accountFormData.mallId) {
      setFormError('Please select a shopping mall to assign to this manager.');
      return;
    }

    setFormSubmitting(true);
    try {
      const token = await getToken();
      const res = await fetch(`${API_BASE_URL}/api/admin/management-users`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(accountFormData),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        setFormError(json.error?.message || 'Failed to create management account.');
        return;
      }

      triggerSuccess(`Account created for '${json.data.displayName}' assigned to mall '${json.data.mallName}'.`);
      setIsCreateAccountOpen(false);
      setAccountFormData({ displayName: '', email: '', password: '', mallId: '' });
      await fetchData();
    } catch (err: any) {
      setFormError(err.message || 'An unexpected error occurred.');
    } finally {
      setFormSubmitting(false);
    }
  };

  // Filtered lists for search
  const filteredMalls = malls.filter((m) => {
    const q = searchQuery.toLowerCase();
    return (
      m.name.toLowerCase().includes(q) ||
      m.mallId.toLowerCase().includes(q) ||
      (m.address && m.address.toLowerCase().includes(q))
    );
  });

  const filteredAccounts = accounts.filter((a) => {
    const q = searchQuery.toLowerCase();
    return (
      a.displayName.toLowerCase().includes(q) ||
      a.email.toLowerCase().includes(q) ||
      a.mallName.toLowerCase().includes(q) ||
      (a.mallId && a.mallId.toLowerCase().includes(q))
    );
  });

  const sidebarItems: SidebarItem[] = [
    {
      id: 'overview',
      label: 'Platform Overview',
      icon: <LayoutDashboard className="w-4 h-4" />,
    },
    {
      id: 'malls',
      label: 'Shopping Malls Directory',
      icon: <Building2 className="w-4 h-4" />,
    },
    {
      id: 'accounts',
      label: 'Mall Management Accounts',
      icon: <Users className="w-4 h-4" />,
    },
  ];

  return (
    <div className="h-screen w-screen bg-slate-50 flex flex-col overflow-hidden antialiased text-slate-800">
      {/* Top Header: Logo + EvacAI on left; Avatar + Name + Dropdown on right */}
      <AppHeader />

      {/* Main Container with Fixed Full-Height Collapsible Sidebar */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Collapsible Sidebar */}
        <AppSidebar
          items={sidebarItems}
          activeId={activeTab}
          onSelect={(id) => {
            setActiveTab(id as 'overview' | 'malls' | 'accounts');
            setSearchQuery('');
          }}
          isCollapsed={isSidebarCollapsed}
          onToggleCollapse={() => setIsSidebarCollapsed((prev) => !prev)}
        />

        {/* Content Pane */}
        <main className="flex-1 h-full min-h-0 bg-slate-50 p-4 sm:p-5 flex flex-col overflow-hidden">
          {/* Success Banner */}
          {successBanner && (
            <div className="p-3.5 sm:p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl text-xs sm:text-sm flex items-center justify-between shadow-xs animate-in fade-in duration-200 shrink-0 mb-3">
              <div className="flex items-center gap-2.5">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                <span className="font-medium">{successBanner}</span>
              </div>
              <button
                onClick={() => setSuccessBanner(null)}
                className="text-emerald-700 hover:text-emerald-900 text-xs font-semibold px-2 py-1 rounded"
              >
                Dismiss
              </button>
            </div>
          )}

          {/* TAB 1: OVERVIEW */}
          {activeTab === 'overview' && (
            <div className="flex-1 min-h-0 overflow-y-auto space-y-5 pr-1 animate-in fade-in duration-200">
              {/* Welcome Header for Superadmin (Only on Overview, no Add Mall / Add Account buttons) */}
              <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200/90 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4 shrink-0">
                <div>
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-50 text-red-700 text-xs font-semibold mb-2">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    Super Administrator Portal
                  </div>
                  <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                    Welcome back, {displayName}
                  </h1>
                  <p className="text-xs text-slate-500 mt-1">
                    Platform-wide control center for shopping malls, facility operations, and tenant management credentials.
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={fetchData}
                    disabled={loading}
                    className="border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs h-9"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 mr-1.5 text-slate-400 ${loading ? 'animate-spin' : ''}`} />
                    Refresh
                  </Button>
                </div>
              </div>
              {/* Stat Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                <Card className="bg-white border-slate-200/90 shadow-xs">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                        Total Registered Malls
                      </CardTitle>
                      <Building2 className="w-5 h-5 text-red-600" />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-extrabold text-slate-900">{stats.totalMalls}</div>
                    <p className="text-xs text-slate-500 mt-1 flex items-center gap-1.5 font-medium">
                      <span className="w-2 h-2 rounded-full bg-emerald-500" />
                      {stats.activeMalls} operational, {stats.totalMalls - stats.activeMalls} inactive
                    </p>
                  </CardContent>
                </Card>

                <Card className="bg-white border-slate-200/90 shadow-xs">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                        Management Accounts
                      </CardTitle>
                      <Users className="w-5 h-5 text-blue-600" />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-extrabold text-slate-900">{stats.totalManagementAccounts}</div>
                    <p className="text-xs text-slate-500 mt-1 font-medium">
                      Tenant-isolated administrator credentials
                    </p>
                  </CardContent>
                </Card>

                <Card className="bg-white border-slate-200/90 shadow-xs">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                        Platform System Status
                      </CardTitle>
                      <ShieldCheck className="w-5 h-5 text-emerald-600" />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="text-lg font-bold text-emerald-600 flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                      System Operational
                    </div>
                    <p className="text-xs text-slate-500 mt-1 font-medium">
                      Facility &amp; Account Provisioning Active
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* Quick Actions & Recent Malls Preview */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Actions Card */}
                <Card className="bg-white border-slate-200/90 shadow-xs lg:col-span-1">
                  <CardHeader className="pb-3 border-b border-slate-100">
                    <CardTitle className="text-sm font-bold text-slate-900">Administrative Shortcuts</CardTitle>
                    <CardDescription className="text-xs text-slate-500">
                      Fast access to primary management tasks
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3 p-5">
                    <Button
                      onClick={() => { setFormError(null); setIsCreateMallOpen(true); }}
                      className="w-full justify-start bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 h-10 text-xs font-semibold"
                    >
                      <Building2 className="w-4 h-4 mr-2 text-red-600" />
                      Register New Shopping Mall
                    </Button>

                    <Button
                      onClick={() => { setFormError(null); setIsCreateAccountOpen(true); }}
                      className="w-full justify-start bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 h-10 text-xs font-semibold"
                    >
                      <Users className="w-4 h-4 mr-2 text-blue-600" />
                      Create Manager Login Credentials
                    </Button>

                    <Button
                      onClick={() => setActiveTab('malls')}
                      className="w-full justify-start bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 h-10 text-xs font-semibold"
                    >
                      <Layers className="w-4 h-4 mr-2 text-purple-600" />
                      Browse All Malls Directory
                    </Button>
                  </CardContent>
                </Card>

                {/* Recent Malls Card */}
                <Card className="bg-white border-slate-200/90 shadow-xs lg:col-span-2">
                  <CardHeader className="flex flex-row items-center justify-between pb-3 border-b border-slate-100">
                    <div>
                      <CardTitle className="text-sm font-bold text-slate-900">Recently Registered Properties</CardTitle>
                      <CardDescription className="text-xs text-slate-500">
                        Latest shopping mall accounts added to the platform
                      </CardDescription>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setActiveTab('malls')}
                      className="text-xs text-blue-600 hover:text-blue-700 font-semibold"
                    >
                      View All ({malls.length})
                      <ArrowRight className="w-3.5 h-3.5 ml-1" />
                    </Button>
                  </CardHeader>
                  <CardContent className="p-5">
                    {malls.length === 0 ? (
                      <div className="text-center py-8 text-slate-400 text-xs">
                        No malls registered yet. Click &quot;New Mall&quot; to register your first facility.
                      </div>
                    ) : (
                      <div className="space-y-2.5">
                        {malls.slice(0, 4).map((mall) => (
                          <div
                            key={mall.mallId}
                            className="p-3 bg-slate-50/70 border border-slate-200 rounded-xl flex items-center justify-between text-xs hover:border-slate-300 transition"
                          >
                            <div className="flex items-center gap-3">
                              <div className="p-2 rounded-lg bg-red-50 text-red-600 border border-red-100">
                                <Building2 className="w-4 h-4" />
                              </div>
                              <div>
                                <div className="font-semibold text-slate-900 flex items-center gap-2">
                                  {mall.name}
                                  <span className="font-mono text-[10px] text-slate-500 bg-white px-1.5 py-0.5 rounded border border-slate-200">
                                    {mall.mallId}
                                  </span>
                                </div>
                                <div className="text-slate-500 text-[11px] mt-0.5">
                                  {mall.address || 'Address not specified'}
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-2.5">
                              <Badge
                                variant="outline"
                                className={
                                  mall.isActive !== false
                                    ? 'bg-emerald-50 border-emerald-200 text-emerald-700 text-[10px] font-semibold'
                                    : 'bg-amber-50 border-amber-200 text-amber-700 text-[10px] font-semibold'
                                }
                              >
                                {mall.isActive !== false ? 'Active' : 'Inactive'}
                              </Badge>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => { setSelectedMall(mall); setIsViewMallOpen(true); }}
                                className="h-7 text-xs text-slate-600 hover:text-slate-900 border-slate-200"
                              >
                                Details
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          )}

          {/* TAB 2: MALLS MANAGEMENT */}
          {activeTab === 'malls' && (
            <div className="flex-1 min-h-0 flex flex-col overflow-hidden gap-3.5 animate-in fade-in duration-200">
              {/* Fixed Title Card for Malls */}
              <div className="bg-white p-4 sm:px-6 rounded-2xl border border-slate-200/90 shadow-xs flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shrink-0">
                <div>
                  <h1 className="text-xl font-bold tracking-tight text-slate-900">
                    Shopping Malls Directory
                  </h1>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Manage all registered mall facilities across the platform ({stats.totalMalls} total).
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={fetchData}
                    disabled={loading}
                    className="border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs h-9"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 mr-1.5 text-slate-400 ${loading ? 'animate-spin' : ''}`} />
                    Refresh
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => { setFormError(null); setIsCreateMallOpen(true); }}
                    className="bg-red-600 hover:bg-red-700 text-white text-xs h-9 shadow-xs"
                  >
                    <Plus className="w-3.5 h-3.5 mr-1.5" />
                    New Mall
                  </Button>
                </div>
              </div>

              {/* Fixed Search Toolbar */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-slate-200/90 shadow-xs shrink-0">
                <div className="relative w-full sm:w-80">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <Input
                    placeholder="Search malls by name, ID, or city..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 bg-slate-50 border-slate-200 text-xs text-slate-900 h-9 focus-visible:ring-blue-500"
                  />
                </div>

                <div className="text-xs text-slate-500 font-medium">
                  Showing {filteredMalls.length} of {malls.length} malls
                </div>
              </div>

              {/* Scrollable Malls Grid Area */}
              <div className="flex-1 min-h-0 overflow-y-auto pr-1">
              {filteredMalls.length === 0 ? (
                <Card className="bg-white border-slate-200/90 p-12 text-center text-slate-500 shadow-xs rounded-2xl">
                  <Building2 className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                  <p className="font-semibold text-slate-800">No shopping malls found</p>
                  <p className="text-xs mt-1 text-slate-400">
                    {searchQuery ? 'Try adjusting your search query.' : 'Get started by creating your first mall.'}
                  </p>
                </Card>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {filteredMalls.map((mall) => (
                    <Card key={mall.mallId} className="bg-white border-slate-200/90 shadow-xs flex flex-col justify-between rounded-2xl">
                      <CardHeader className="pb-3 border-b border-slate-100">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2.5">
                            <div className="p-2 rounded-xl bg-red-50 text-red-600 border border-red-100 shrink-0">
                              <Building2 className="w-5 h-5" />
                            </div>
                            <div>
                              <CardTitle className="text-base font-bold text-slate-900">{mall.name}</CardTitle>
                              <CardDescription className="text-xs font-mono text-slate-400 mt-0.5">
                                {mall.mallId}
                              </CardDescription>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            <Badge
                              variant="outline"
                              className="bg-blue-50 border-blue-200 text-blue-700 text-xs font-semibold"
                            >
                              {formatFloorsBadge(mall.totalFloors)}
                            </Badge>
                            <Badge
                              variant="outline"
                              className={
                                mall.isActive !== false
                                  ? 'bg-emerald-50 border-emerald-200 text-emerald-700 text-xs font-semibold'
                                  : 'bg-amber-50 border-amber-200 text-amber-700 text-xs font-semibold'
                              }
                            >
                              {mall.isActive !== false ? 'Active' : 'Inactive'}
                            </Badge>
                          </div>
                        </div>
                      </CardHeader>

                      <CardContent className="space-y-2.5 text-xs text-slate-600 p-5 flex-1">
                        {mall.address && (
                          <div className="flex items-center gap-2">
                            <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span className="truncate">{mall.address}</span>
                          </div>
                        )}
                        {mall.contactPerson && (
                          <div className="flex items-center gap-2">
                            <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span className="truncate">{mall.contactPerson}</span>
                          </div>
                        )}
                        {mall.contactEmail && (
                          <div className="flex items-center gap-2">
                            <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span className="truncate font-mono">{mall.contactEmail}</span>
                          </div>
                        )}
                        {mall.contactPhone && (
                          <div className="flex items-center gap-2">
                            <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span className="truncate">{mall.contactPhone}</span>
                          </div>
                        )}

                        <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
                          <span>Manager: {mall.managementName || mall.managementEmail || 'Not assigned'}</span>
                          <span>Registered {new Date(mall.createdAt).toLocaleDateString()}</span>
                        </div>
                      </CardContent>

                      <div className="p-3 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2 rounded-b-2xl">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => { setSelectedMall(mall); setIsViewMallOpen(true); }}
                          className="border-slate-200 bg-white hover:bg-slate-50 text-xs text-slate-700 h-8"
                        >
                          <Eye className="w-3.5 h-3.5 mr-1 text-slate-400" />
                          View
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openEditModal(mall)}
                          className="border-slate-200 bg-white hover:bg-slate-50 text-xs text-slate-700 h-8"
                        >
                          <Edit2 className="w-3.5 h-3.5 mr-1 text-slate-400" />
                          Edit
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => promptToggleStatus(mall)}
                          className={`text-xs h-8 ${
                            mall.isActive !== false
                              ? 'border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100'
                              : 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                          }`}
                        >
                          <Power className="w-3.5 h-3.5 mr-1" />
                          {mall.isActive !== false ? 'Deactivate' : 'Activate'}
                        </Button>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
              </div>
            </div>
          )}

          {/* TAB 3: MANAGEMENT ACCOUNTS */}
          {activeTab === 'accounts' && (
            <div className="flex-1 min-h-0 flex flex-col overflow-hidden gap-3.5 animate-in fade-in duration-200">
              {/* Fixed Title Card for Accounts */}
              <div className="bg-white p-4 sm:px-6 rounded-2xl border border-slate-200/90 shadow-xs flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shrink-0">
                <div>
                  <h1 className="text-xl font-bold tracking-tight text-slate-900">
                    Mall Management Accounts
                  </h1>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Control authorized management logins and assigned property permissions ({stats.totalManagementAccounts} total).
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={fetchData}
                    disabled={loading}
                    className="border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs h-9"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 mr-1.5 text-slate-400 ${loading ? 'animate-spin' : ''}`} />
                    Refresh
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => { setFormError(null); setIsCreateAccountOpen(true); }}
                    className="bg-blue-600 hover:bg-blue-700 text-white text-xs h-9 shadow-xs"
                  >
                    <Plus className="w-3.5 h-3.5 mr-1.5" />
                    New Account
                  </Button>
                </div>
              </div>

              {/* Fixed Search Toolbar */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-slate-200/90 shadow-xs shrink-0">
                <div className="relative w-full sm:w-80">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <Input
                    placeholder="Search accounts by name, email, or mall..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 bg-slate-50 border-slate-200 text-xs text-slate-900 h-9 focus-visible:ring-blue-500"
                  />
                </div>

                <div className="text-xs text-slate-500 font-medium">
                  Showing {filteredAccounts.length} of {accounts.length} management accounts
                </div>
              </div>

              {/* Scrollable Accounts Table Container */}
              <div className="flex-1 min-h-0 bg-white border border-slate-200/90 rounded-2xl overflow-hidden shadow-xs flex flex-col">
                {filteredAccounts.length === 0 ? (
                  <div className="p-12 text-center text-slate-500 flex flex-col items-center justify-center flex-1">
                    <Users className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                    <p className="font-semibold text-slate-800">No mall management accounts found</p>
                    <p className="text-xs mt-1 text-slate-400">
                      {searchQuery ? 'No accounts match the search term.' : 'Click "New Account" to create credentials for a mall manager.'}
                    </p>
                  </div>
                ) : (
                  <div className="flex-1 min-h-0 overflow-auto">
                    <table className="w-full text-left text-xs text-slate-700">
                      <thead className="sticky top-0 z-10 bg-slate-50/95 backdrop-blur-xs border-b border-slate-200/90 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                        <tr>
                          <th className="px-5 py-3.5">Account Name</th>
                          <th className="px-5 py-3.5">Email Address</th>
                          <th className="px-5 py-3.5">Assigned Mall</th>
                          <th className="px-5 py-3.5">Role / Claim</th>
                          <th className="px-5 py-3.5">Status</th>
                          <th className="px-5 py-3.5">Created</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {filteredAccounts.map((acc) => (
                          <tr key={acc.uid} className="hover:bg-slate-50 transition">
                            <td className="px-5 py-4 font-semibold text-slate-900 flex items-center gap-2.5">
                              <div className="w-8 h-8 rounded-full bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-700 font-bold text-xs shrink-0">
                                {acc.displayName.charAt(0).toUpperCase()}
                              </div>
                              {acc.displayName}
                            </td>
                            <td className="px-5 py-4 font-mono text-slate-600">{acc.email}</td>
                            <td className="px-5 py-4">
                              <div>
                                <span className="font-semibold text-slate-900">{acc.mallName}</span>
                                <span className="font-mono text-[10px] text-slate-400 block mt-0.5">
                                  {acc.mallId}
                                </span>
                              </div>
                            </td>
                            <td className="px-5 py-4">
                              <Badge variant="outline" className="bg-blue-50 border-blue-200 text-blue-700 font-mono text-[10px] font-semibold">
                                mall_management
                              </Badge>
                            </td>
                            <td className="px-5 py-4">
                              <Badge
                                variant="outline"
                                className={
                                  acc.isActive !== false
                                    ? 'bg-emerald-50 border-emerald-200 text-emerald-700 text-[10px] font-semibold'
                                    : 'bg-red-50 border-red-200 text-red-700 text-[10px] font-semibold'
                                }
                              >
                                {acc.isActive !== false ? 'Active' : 'Disabled'}
                              </Badge>
                            </td>
                            <td className="px-5 py-4 text-slate-400 text-[11px]">
                              {new Date(acc.createdAt).toLocaleDateString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}
        </main>
      </div>

      {/* MODAL 1: CREATE MALL */}
      <Dialog open={isCreateMallOpen} onOpenChange={setIsCreateMallOpen}>
        <DialogContent onClose={() => setIsCreateMallOpen(false)}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="w-5 h-5 text-red-600" />
              Register New Shopping Mall
            </DialogTitle>
            <DialogDescription>
              Create a shopping mall facility record. A unique ID will be automatically generated.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateMallSubmit} className="space-y-4">
            {formError && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
                <span>{formError}</span>
              </div>
            )}

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700">Mall Name *</label>
              <Input
                placeholder="e.g. Phoenix Grand Mall"
                value={mallFormData.name}
                onChange={(e) => setMallFormData({ ...mallFormData, name: e.target.value })}
                required
                className="bg-slate-50 border-slate-200 text-xs text-slate-900"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700">Location / Address</label>
              <Input
                placeholder="e.g. 100 Main Road, Sector 4"
                value={mallFormData.address}
                onChange={(e) => setMallFormData({ ...mallFormData, address: e.target.value })}
                className="bg-slate-50 border-slate-200 text-xs text-slate-900"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">Contact Person</label>
                <Input
                  placeholder="e.g. John Doe"
                  value={mallFormData.contactPerson}
                  onChange={(e) => setMallFormData({ ...mallFormData, contactPerson: e.target.value })}
                  className="bg-slate-50 border-slate-200 text-xs text-slate-900"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">Contact Phone</label>
                <Input
                  placeholder="e.g. +91-9876543210"
                  value={mallFormData.contactPhone}
                  onChange={(e) => setMallFormData({ ...mallFormData, contactPhone: e.target.value })}
                  className="bg-slate-50 border-slate-200 text-xs text-slate-900"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700">Contact Email</label>
              <Input
                type="email"
                placeholder="e.g. info@phoenixgrand.com"
                value={mallFormData.contactEmail}
                onChange={(e) => setMallFormData({ ...mallFormData, contactEmail: e.target.value })}
                className="bg-slate-50 border-slate-200 text-xs text-slate-900"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700">Number of Floors *</label>
              <Input
                type="number"
                min={1}
                max={10}
                value={mallFormData.totalFloors}
                onChange={(e) => setMallFormData({ ...mallFormData, totalFloors: Math.max(1, Math.min(10, parseInt(e.target.value) || 1)) })}
                required
                className="bg-slate-50 border-slate-200 text-xs text-slate-900"
              />
              <p className="text-[11px] text-slate-400">Total building floors configurable by mall management (e.g. Ground Floor, 1st Floor, etc.).</p>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setIsCreateMallOpen(false)}
                className="text-xs text-slate-500 hover:text-slate-800"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={formSubmitting}
                className="bg-red-600 hover:bg-red-700 text-white text-xs h-9 shadow-xs"
              >
                {formSubmitting ? 'Registering...' : 'Register Mall'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* MODAL 2: EDIT MALL */}
      <Dialog open={isEditMallOpen} onOpenChange={setIsEditMallOpen}>
        <DialogContent onClose={() => setIsEditMallOpen(false)}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit2 className="w-5 h-5 text-blue-600" />
              Edit Mall Details
            </DialogTitle>
            <DialogDescription>
              Update mall profile. Unique ID and existing floor plan data are strictly preserved.
            </DialogDescription>
          </DialogHeader>

          {selectedMall && (
            <form onSubmit={handleEditMallSubmit} className="space-y-4">
              {formError && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
                  <span>{formError}</span>
                </div>
              )}

              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono">
                <span className="text-slate-400 block text-[10px]">Permanent Mall Identifier</span>
                <span className="text-slate-800 font-semibold">{selectedMall.mallId}</span>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">Mall Name *</label>
                <Input
                  value={editMallFormData.name}
                  onChange={(e) => setEditMallFormData({ ...editMallFormData, name: e.target.value })}
                  required
                  className="bg-slate-50 border-slate-200 text-xs text-slate-900"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">Location / Address</label>
                <Input
                  value={editMallFormData.address}
                  onChange={(e) => setEditMallFormData({ ...editMallFormData, address: e.target.value })}
                  className="bg-slate-50 border-slate-200 text-xs text-slate-900"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">Contact Person</label>
                  <Input
                    value={editMallFormData.contactPerson}
                    onChange={(e) => setEditMallFormData({ ...editMallFormData, contactPerson: e.target.value })}
                    className="bg-slate-50 border-slate-200 text-xs text-slate-900"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">Contact Phone</label>
                  <Input
                    value={editMallFormData.contactPhone}
                    onChange={(e) => setEditMallFormData({ ...editMallFormData, contactPhone: e.target.value })}
                    className="bg-slate-50 border-slate-200 text-xs text-slate-900"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">Contact Email</label>
                <Input
                  type="email"
                  value={editMallFormData.contactEmail}
                  onChange={(e) => setEditMallFormData({ ...editMallFormData, contactEmail: e.target.value })}
                  className="bg-slate-50 border-slate-200 text-xs text-slate-900"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">Number of Floors *</label>
                <Input
                  type="number"
                  min={1}
                  max={10}
                  value={editMallFormData.totalFloors}
                  onChange={(e) => setEditMallFormData({ ...editMallFormData, totalFloors: Math.max(1, Math.min(10, parseInt(e.target.value) || 1)) })}
                  required
                  className="bg-slate-50 border-slate-200 text-xs text-slate-900"
                />
                <p className="text-[11px] text-slate-400">Adjusting the floor count allows mall management to add/edit corresponding floors.</p>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="isActiveToggle"
                  checked={editMallFormData.isActive}
                  onChange={(e) => setEditMallFormData({ ...editMallFormData, isActive: e.target.checked })}
                  className="rounded border-slate-300 text-red-600 focus:ring-red-500 w-4 h-4 cursor-pointer"
                />
                <label htmlFor="isActiveToggle" className="text-xs text-slate-700 font-semibold cursor-pointer">
                  Mall is operational and active
                </label>
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setIsEditMallOpen(false)}
                  className="text-xs text-slate-500 hover:text-slate-800"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={formSubmitting}
                  className="bg-blue-600 hover:bg-blue-700 text-white text-xs h-9 shadow-xs"
                >
                  {formSubmitting ? 'Saving...' : 'Save Changes'}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* MODAL 3: VIEW MALL DETAILS */}
      <Dialog open={isViewMallOpen} onOpenChange={setIsViewMallOpen}>
        <DialogContent onClose={() => setIsViewMallOpen(false)}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="w-5 h-5 text-red-600" />
              {selectedMall?.name || 'Mall Details'}
            </DialogTitle>
            <DialogDescription>
              Facility metadata and assigned management information
            </DialogDescription>
          </DialogHeader>

          {selectedMall && (
            <div className="space-y-3 text-xs">
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                <div>
                  <span className="text-slate-400 block text-[10px]">Mall Identifier (mallId)</span>
                  <span className="font-mono text-slate-900 text-sm font-semibold">{selectedMall.mallId}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">Location</span>
                  <span className="text-slate-700 font-medium">{selectedMall.address || 'Not specified'}</span>
                </div>
                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-200">
                  <div>
                    <span className="text-slate-400 block text-[10px]">Contact Person</span>
                    <span className="text-slate-700">{selectedMall.contactPerson || '—'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">Contact Phone</span>
                    <span className="text-slate-700">{selectedMall.contactPhone || '—'}</span>
                  </div>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">Contact Email</span>
                  <span className="text-slate-700 font-mono">{selectedMall.contactEmail || '—'}</span>
                </div>
              </div>

              {/* Management User Info */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5">
                <span className="font-bold text-slate-800 block text-xs">Assigned Management User</span>
                {selectedMall.managementEmail ? (
                  <div className="space-y-1 text-slate-600">
                    <div>Name: <span className="text-slate-900 font-semibold">{selectedMall.managementName || 'Manager'}</span></div>
                    <div>Email: <span className="font-mono text-slate-800">{selectedMall.managementEmail}</span></div>
                    <div>UID: <span className="font-mono text-[10px] text-slate-400">{selectedMall.managementUid}</span></div>
                  </div>
                ) : (
                  <p className="text-slate-400 text-xs">No management account assigned to this mall yet.</p>
                )}
              </div>

              <div className="flex items-center justify-between text-slate-500 pt-1">
                <span>Account Status:</span>
                <Badge
                  variant="outline"
                  className={
                    selectedMall.isActive !== false
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                      : 'bg-amber-50 border-amber-200 text-amber-700'
                  }
                >
                  {selectedMall.isActive !== false ? 'Active' : 'Inactive'}
                </Badge>
              </div>

              <DialogFooter>
                <Button
                  onClick={() => setIsViewMallOpen(false)}
                  className="bg-slate-800 hover:bg-slate-900 text-white text-xs h-8"
                >
                  Close
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* MODAL 4: CREATE MANAGEMENT ACCOUNT */}
      <Dialog open={isCreateAccountOpen} onOpenChange={setIsCreateAccountOpen}>
        <DialogContent onClose={() => setIsCreateAccountOpen(false)}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="w-5 h-5 text-blue-600" />
              Create Mall Management Account
            </DialogTitle>
            <DialogDescription>
              Provision a manager login scoped exclusively to a specific shopping mall.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateAccountSubmit} className="space-y-4">
            {formError && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
                <span>{formError}</span>
              </div>
            )}

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700">Full Name *</label>
              <Input
                placeholder="e.g. Ramesh Kumar"
                value={accountFormData.displayName}
                onChange={(e) => setAccountFormData({ ...accountFormData, displayName: e.target.value })}
                required
                className="bg-slate-50 border-slate-200 text-xs text-slate-900"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700">Login Email *</label>
              <Input
                type="email"
                placeholder="e.g. manager@phoenixmall.com"
                value={accountFormData.email}
                onChange={(e) => setAccountFormData({ ...accountFormData, email: e.target.value })}
                required
                className="bg-slate-50 border-slate-200 text-xs text-slate-900"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700">Temporary Password * (min 6 chars)</label>
              <div className="relative">
                <Input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Min 6 characters"
                  value={accountFormData.password}
                  onChange={(e) => setAccountFormData({ ...accountFormData, password: e.target.value })}
                  required
                  className="bg-slate-50 border-slate-200 text-xs text-slate-900 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700">Assign to Shopping Mall *</label>
              <select
                value={accountFormData.mallId}
                onChange={(e) => setAccountFormData({ ...accountFormData, mallId: e.target.value })}
                required
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              >
                <option value="">-- Select a shopping mall --</option>
                {malls
                  .filter((m) => m.isActive !== false)
                  .map((m) => (
                    <option key={m.mallId} value={m.mallId}>
                      {m.name} ({m.mallId})
                    </option>
                  ))}
              </select>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setIsCreateAccountOpen(false)}
                className="text-xs text-slate-500 hover:text-slate-800"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={formSubmitting}
                className="bg-blue-600 hover:bg-blue-700 text-white text-xs h-9 shadow-xs"
              >
                {formSubmitting ? 'Creating...' : 'Create Account'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* MODAL 5: CONFIRM DEACTIVATE / ACTIVATE */}
      <Dialog open={isConfirmDeactivateOpen} onOpenChange={setIsConfirmDeactivateOpen}>
        <DialogContent onClose={() => setIsConfirmDeactivateOpen(false)}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Power className="w-5 h-5 text-amber-600" />
              {selectedMall?.isActive !== false ? 'Deactivate Shopping Mall' : 'Activate Shopping Mall'}
            </DialogTitle>
            <DialogDescription>
              {selectedMall?.isActive !== false
                ? `Are you sure you want to deactivate '${selectedMall?.name}'? Its management users will not be able to log in.`
                : `Are you sure you want to activate '${selectedMall?.name}'? Access will be restored for its management users.`}
            </DialogDescription>
          </DialogHeader>

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setIsConfirmDeactivateOpen(false)}
              className="text-xs text-slate-500 hover:text-slate-800"
            >
              Cancel
            </Button>
            <Button
              onClick={handleConfirmToggleStatus}
              disabled={formSubmitting}
              className={`text-xs h-9 shadow-xs ${
                selectedMall?.isActive !== false
                  ? 'bg-amber-600 hover:bg-amber-700 text-white'
                  : 'bg-emerald-600 hover:bg-emerald-700 text-white'
              }`}
            >
              {formSubmitting
                ? 'Updating...'
                : selectedMall?.isActive !== false
                ? 'Confirm Deactivation'
                : 'Confirm Activation'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
