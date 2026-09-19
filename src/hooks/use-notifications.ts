import { useState, useEffect, useCallback, useMemo } from 'react'
import { supabase } from '@/lib/supabase/client'
import {
  InAppNotification,
  fetchUserNotifications,
  markNotificationAsRead as apiMarkAsRead,
  markAllNotificationsAsRead as apiMarkAllAsRead,
} from '@/services/notifications'

export function useNotifications(userId: string | undefined) {
  const [notifications, setNotifications] = useState<InAppNotification[]>([])
  const [loading, setLoading] = useState(true)

  const loadNotifications = useCallback(async () => {
    if (!userId) {
      setNotifications([])
      setLoading(false)
      return
    }

    try {
      const list = await fetchUserNotifications(userId)
      setNotifications(list)
    } finally {
      setLoading(false)
    }
  }, [userId])

  useEffect(() => {
    loadNotifications()

    if (!userId) return

    // Realtime subscription
    const channel = supabase
      .channel(`user-notifications-${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        () => {
          loadNotifications()
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [userId, loadNotifications])

  const unreadCount = useMemo(() => {
    return notifications.filter((n) => !n.read).length
  }, [notifications])

  const markAsRead = async (id: string) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)))
    await apiMarkAsRead(id)
  }

  const markAllAsRead = async () => {
    if (!userId) return
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
    await apiMarkAllAsRead(userId)
  }

  return {
    notifications,
    unreadCount,
    loading,
    refresh: loadNotifications,
    markAsRead,
    markAllAsRead,
  }
}
