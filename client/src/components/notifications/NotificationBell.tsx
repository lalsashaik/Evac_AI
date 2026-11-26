import React, { useState, useEffect, useRef } from 'react';
import { Bell, Flame, AlertTriangle, CheckCheck, ExternalLink, X } from 'lucide-react';
import { database } from '@/lib/firebase';
import { ref, onValue, off } from 'firebase/database';
import { NotificationRecord } from '@/types/incident';

interface NotificationBellProps {
  mallId: string | null;
  getToken: () => Promise<string | null>;
  onSelectIncident?: (incidentId: string) => void;
  onNewNotificationAlert?: (notification: NotificationRecord) => void;
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000';

function formatTimeAgo(isoString: string): string {
  try {
    const diffMs = Date.now() - new Date(isoString).getTime();
    const diffSec = Math.floor(diffMs / 1000);
    if (diffSec < 45) return 'Just now';
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h ago`;
    return new Date(isoString).toLocaleDateString([], { month: 'short', day: 'numeric' });
  } catch {
    return 'Recently';
  }
}

export const NotificationBell: React.FC<NotificationBellProps> = ({
  mallId,
  getToken,
  onSelectIncident,
  onNewNotificationAlert,
}) => {
  const [notifications, setNotifications] = useState<NotificationRecord[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Initial load tracking to prevent initial flood of toasts
  const isInitializedRef = useRef(false);
  const seenIdsRef = useRef<Set<string>>(new Set());

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Set up Firebase Realtime Database onValue listener
  useEffect(() => {
    if (!mallId) return;

    let isSubscribed = true;

    // Check if live Firebase Realtime Database client instance is available
    if (database) {
      const notifsRef = ref(database, `malls/${mallId}/notifications`);

      const unsubscribe = onValue(
        notifsRef,
        (snapshot) => {
          if (!isSubscribed) return;

          const data = snapshot.val() as Record<string, NotificationRecord> | null;
          const list = data ? Object.values(data) : [];

          // Sort most recent first
          list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

          if (!isInitializedRef.current) {
            // First load: seed seen IDs without triggering toasts
            list.forEach((n) => seenIdsRef.current.add(n.notificationId));
            isInitializedRef.current = true;
          } else {
            // Subsequent real-time events: alert for genuinely newly arrived notifications
            for (const n of list) {
              if (!seenIdsRef.current.has(n.notificationId)) {
                seenIdsRef.current.add(n.notificationId);
                if (onNewNotificationAlert) {
                  onNewNotificationAlert(n);
                }
              }
            }
          }

          setNotifications(list);
        },
        (error) => {
          console.warn('[NotificationBell] Firebase listener error, falling back to REST:', error.message);
        }
      );

      return () => {
        isSubscribed = false;
        unsubscribe();
      };
    } else {
      // Fallback REST fetch if Firebase Web client credentials are not configured
      async function fetchNotifications() {
        if (!mallId) return;
        try {
          const token = await getToken();
          if (!token) return;

          const res = await fetch(`${API_BASE_URL}/api/malls/${mallId}/notifications`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (!res.ok) return;

          const data = await res.json();
          const list: NotificationRecord[] = data.data?.notifications || [];

          if (!isInitializedRef.current) {
            list.forEach((n) => seenIdsRef.current.add(n.notificationId));
            isInitializedRef.current = true;
          } else {
            for (const n of list) {
              if (!seenIdsRef.current.has(n.notificationId)) {
                seenIdsRef.current.add(n.notificationId);
                if (onNewNotificationAlert) {
                  onNewNotificationAlert(n);
                }
              }
            }
          }
          if (isSubscribed) {
            setNotifications(list);
          }
        } catch (_) {}
      }

      fetchNotifications();
      const interval = setInterval(fetchNotifications, 5000);
      return () => {
        isSubscribed = false;
        clearInterval(interval);
      };
    }
  }, [mallId, getToken, onNewNotificationAlert]);

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const handleMarkAsRead = async (notificationId: string, event?: React.MouseEvent) => {
    if (event) event.stopPropagation();
    if (!mallId) return;

    try {
      const token = await getToken();
      if (!token) return;

      // Optimistic update
      setNotifications((prev) =>
        prev.map((n) => (n.notificationId === notificationId ? { ...n, isRead: true } : n))
      );

      await fetch(`${API_BASE_URL}/api/malls/${mallId}/notifications/${notificationId}/read`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch (err) {
      console.error('[NotificationBell] Error marking notification as read:', err);
    }
  };

  const handleMarkAllRead = async () => {
    if (!mallId || unreadCount === 0) return;
    setLoading(true);
    const unread = notifications.filter((n) => !n.isRead);

    // Optimistic
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));

    try {
      const token = await getToken();
      if (!token) return;

      await Promise.all(
        unread.map((n) =>
          fetch(`${API_BASE_URL}/api/malls/${mallId}/notifications/${n.notificationId}/read`, {
            method: 'PATCH',
            headers: { Authorization: `Bearer ${token}` },
          })
        )
      );
    } catch (err) {
      console.error('[NotificationBell] Error marking all read:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectNotification = (n: NotificationRecord) => {
    if (!n.isRead) {
      handleMarkAsRead(n.notificationId);
    }
    setIsOpen(false);
    if (onSelectIncident && n.incidentId) {
      onSelectIncident(n.incidentId);
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Button */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="relative p-2 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors focus:outline-hidden focus:ring-2 focus:ring-red-500"
        aria-label="Open notifications"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold text-white bg-red-600 rounded-full ring-2 ring-white animate-pulse">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Notifications Dropdown Panel */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-xl shadow-xl border border-slate-200 z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
          {/* Header */}
          <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-slate-800 text-sm">Notifications</span>
              {unreadCount > 0 && (
                <span className="text-xs bg-red-100 text-red-700 font-semibold px-2 py-0.5 rounded-full">
                  {unreadCount} unread
                </span>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={handleMarkAllRead}
                disabled={loading}
                className="text-xs text-slate-600 hover:text-slate-900 font-medium flex items-center gap-1 hover:underline disabled:opacity-50"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                Mark all read
              </button>
            )}
          </div>

          {/* List */}
          <div className="max-h-96 overflow-y-auto divide-y divide-slate-100">
            {notifications.length === 0 ? (
              <div className="py-8 text-center px-4">
                <Bell className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="text-sm font-medium text-slate-600">No notifications yet</p>
                <p className="text-xs text-slate-400 mt-1">Hazard alerts will appear here in real time</p>
              </div>
            ) : (
              notifications.map((n) => {
                const isFire = n.message.toLowerCase().includes('fire');
                return (
                  <div
                    key={n.notificationId}
                    onClick={() => handleSelectNotification(n)}
                    className={`p-3.5 cursor-pointer hover:bg-slate-50 transition-colors flex items-start gap-3 ${
                      !n.isRead ? 'bg-red-50/40' : ''
                    }`}
                  >
                    <div
                      className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                        isFire
                          ? 'bg-red-100 text-red-600'
                          : 'bg-amber-100 text-amber-700'
                      }`}
                    >
                      {isFire ? <Flame className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
                    </div>

                    <div className="flex-1 min-w-0">
                      <p
                        className={`text-xs text-slate-800 leading-snug line-clamp-2 ${
                          !n.isRead ? 'font-semibold text-slate-900' : ''
                        }`}
                      >
                        {n.message}
                      </p>
                      <div className="flex items-center justify-between mt-1 text-[11px] text-slate-400">
                        <span>{formatTimeAgo(n.createdAt)}</span>
                        {n.incidentId && (
                          <span className="flex items-center gap-0.5 text-blue-600 hover:underline">
                            View Incident <ExternalLink className="w-2.5 h-2.5" />
                          </span>
                        )}
                      </div>
                    </div>

                    {!n.isRead && (
                      <span className="w-2 h-2 rounded-full bg-red-600 shrink-0 mt-2" title="Unread" />
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};
