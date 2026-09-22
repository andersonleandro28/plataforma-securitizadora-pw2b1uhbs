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
    // 1. Tentar inserção direta via PostgREST
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

    if (!error && data) {
      return data as InAppNotification
    }

    // Se houve erro de RLS/permissão (ex: 42501 ou 403) ou outro erro de inserção, acionar fallback RPC
    const isPermissionError =
      error?.code === '42501' ||
      error?.message?.toLowerCase().includes('violates row-level security') ||
      error?.message?.toLowerCase().includes('permission denied') ||
      (error as any)?.status === 403

    if (error) {
      console.warn('Erro ao inserir notificação direta, tentando RPC send_notification_admin:', {
        code: error.code,
        message: error.message,
        isPermissionError,
      })
    }

    // 2. Fallback via RPC SECURITY DEFINER
    const { data: rpcData, error: rpcError } = await (supabase.rpc as any)(
      'send_notification_admin',
      {
        p_user_id: userId,
        p_title: title,
        p_message: message,
        p_type: type,
        p_link: link || null,
        p_metadata: metadata || {},
      },
    )

    if (rpcError) {
      console.error('Erro no fallback RPC send_notification_admin:', rpcError)
      return null
    }

    return rpcData as InAppNotification
  } catch (err) {
    console.error('Exceção ao enviar notificação:', err)
    // Tentativa extrema de fallback no catch
    try {
      const { data: fallbackData } = await (supabase.rpc as any)('send_notification_admin', {
        p_user_id: userId,
        p_title: title,
        p_message: message,
        p_type: type,
        p_link: link || null,
        p_metadata: metadata || {},
      })
      if (fallbackData) return fallbackData as InAppNotification
    } catch (fallbackErr) {
      console.error('Falha no fallback final de notificação:', fallbackErr)
    }
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
