import { supabase } from '@/lib/supabase/client'

/**
 * Interface e tipos para o sistema de notificações in-app.
 */
export interface InAppNotification {
  id: string
  user_id: string
  title: string
  message: string
  type: 'info' | 'success' | 'warning' | 'error' | 'redemption'
  read: boolean
  link?: string | null
  metadata?: Record<string, any> | null
  created_at: string
}

export interface CreateNotificationParams {
  userId: string
  title: string
  message: string
  type?: 'info' | 'success' | 'warning' | 'error' | 'redemption'
  link?: string
  metadata?: Record<string, any>
}

/**
 * Envia uma notificação in-app para um usuário específico.
 */
export async function sendNotification({
  userId,
  title,
  message,
  type = 'info',
  link,
  metadata = {},
}: CreateNotificationParams): Promise<InAppNotification | null> {
  try {
    const { data, error } = await supabase
      .from('notifications')
      .insert({
        user_id: userId,
        title,
        message,
        type,
        link: link || null,
        metadata,
      })
      .select()
      .single()

    if (error) {
      console.error('Erro ao criar notificação:', error)
      return null
    }

    return data as InAppNotification
  } catch (err) {
    console.error('Exceção ao enviar notificação:', err)
    return null
  }
}

/**
 * Busca as notificações do usuário atual.
 */
export async function fetchUserNotifications(
  userId: string,
  limit = 30,
): Promise<InAppNotification[]> {
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) {
    console.error('Erro ao buscar notificações:', error)
    return []
  }

  return (data || []) as InAppNotification[]
}

/**
 * Marca uma notificação como lida.
 */
export async function markNotificationAsRead(id: string): Promise<boolean> {
  const { error } = await supabase.from('notifications').update({ read: true }).eq('id', id)

  if (error) {
    console.error('Erro ao marcar notificação como lida:', error)
    return false
  }

  return true
}

/**
 * Marca todas as notificações do usuário como lidas.
 */
export async function markAllNotificationsAsRead(userId: string): Promise<boolean> {
  const { error } = await supabase
    .from('notifications')
    .update({ read: true })
    .eq('user_id', userId)
    .eq('read', false)

  if (error) {
    console.error('Erro ao marcar todas as notificações como lidas:', error)
    return false
  }

  return true
}
