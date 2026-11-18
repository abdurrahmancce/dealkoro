import React from 'react';
import { Bell, CheckCheck } from 'lucide-react';
import type { Language, NotificationItem } from '../types/dealkoro';
import { t } from '../i18n/translations';

interface NotificationsScreenProps {
  language: Language;
  notifications: NotificationItem[];
  onMarkAllRead: () => void;
  onOpenNotification: (item: NotificationItem) => void;
}

export function NotificationsScreen({
  language,
  notifications,
  onMarkAllRead,
  onOpenNotification,
}: NotificationsScreenProps) {
  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold text-slate-900">
          {t(language, 'notifications')}
        </h1>
        {notifications.some((n) => !n.isRead) && (
          <button
            type="button"
            onClick={onMarkAllRead}
            className="min-h-[40px] px-3 py-1.5 text-xs font-semibold text-blue-600 hover:bg-blue-50 rounded-xl inline-flex items-center gap-1.5 transition-colors"
          >
            <CheckCheck className="w-4 h-4" />
            <span>Mark all read</span>
          </button>
        )}
      </div>

      {notifications.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center">
          <Bell className="w-8 h-8 text-slate-300 mx-auto mb-2" />
          <p className="text-sm text-slate-500">No notifications yet.</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {notifications.map((notif) => (
            <button
              key={notif.id}
              type="button"
              onClick={() => onOpenNotification(notif)}
              className={`w-full text-left border rounded-2xl p-4 flex items-center justify-between gap-3 transition-colors ${
                notif.isRead
                  ? 'bg-slate-100/70 border-slate-200 hover:bg-slate-100'
                  : 'bg-white border-blue-200 hover:border-blue-300'
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-full bg-blue-50 text-blue-700 font-bold text-sm flex items-center justify-center shrink-0">
                  {notif.actorName.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-bold text-slate-900 truncate">
                    {notif.actorName}
                  </div>
                  <div className="text-xs text-slate-600 line-clamp-2">
                    {notif.message}
                  </div>
                </div>
              </div>

              {!notif.isRead && (
                <span className="text-xs font-bold text-blue-600 shrink-0">New</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
