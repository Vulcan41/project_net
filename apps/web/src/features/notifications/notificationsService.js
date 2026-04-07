import { supabase } from '@core/supabase.js'

export async function getMyNotifications() {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')
  const { data, error } = await supabase
    .from('notifications')
    .select(`
      id, type, read, created_at,
      link_url, link_title, link_description, link_image, link_site,
      message_type, friendship_id, project_id,
      sender:sender_id (id, username, full_name, avatar_url)
    `)
    .eq('receiver_id', user.id)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data
}

export async function markAsRead(notificationId) {
  const { error } = await supabase
    .from('notifications')
    .update({ read: true })
    .eq('id', notificationId)
  if (error) throw error
}

export async function markAllAsRead() {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')
  const { error } = await supabase
    .from('notifications')
    .update({ read: true })
    .eq('receiver_id', user.id)
    .eq('read', false)
  if (error) throw error
}
