import { supabase } from '@core/supabase.js'

export async function getMyFriends() {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')
  const { data, error } = await supabase
    .from('friendships')
    .select(`
      id, status, created_at,
      requester:requester_id (id, username, full_name, avatar_url),
      receiver:receiver_id (id, username, full_name, avatar_url)
    `)
    .or(`requester_id.eq.${user.id},receiver_id.eq.${user.id}`)
  if (error) throw error
  return { userId: user.id, friends: data }
}

export async function acceptFriend(friendshipId) {
  const { error } = await supabase
    .from('friendships')
    .update({ status: 'accepted' })
    .eq('id', friendshipId)
  if (error) throw error
}

export async function rejectFriend(friendshipId) {
  const { error } = await supabase
    .from('friendships')
    .delete()
    .eq('id', friendshipId)
  if (error) throw error
}

export async function removeFriend(friendshipId) {
  const { error } = await supabase
    .from('friendships')
    .delete()
    .eq('id', friendshipId)
  if (error) throw error
}
