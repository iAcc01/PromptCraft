import { create } from 'zustand'
import { supabase } from '../lib/supabase'
import type { User, Session } from '@supabase/supabase-js'

interface Profile {
  id: string
  email: string
  display_name: string
  avatar_url: string | null
}

interface AuthState {
  user: User | null
  session: Session | null
  profile: Profile | null
  loading: boolean
  authError: string | null

  initialize: () => Promise<void>
  signUp: (email: string, password: string, displayName?: string) => Promise<{ success: boolean; error?: string }>
  signIn: (email: string, password: string) => Promise<{ success: boolean; error?: string }>
  signOut: () => Promise<void>
  fetchProfile: () => Promise<void>
  updateProfile: (updates: Partial<Pick<Profile, 'display_name' | 'avatar_url'>>) => Promise<void>
  clearError: () => void
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  session: null,
  profile: null,
  loading: true,
  authError: null,

  initialize: async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (session) {
        set({ user: session.user, session, loading: false })
        await get().fetchProfile()
      } else {
        set({ loading: false })
      }

      // Listen for auth state changes
      supabase.auth.onAuthStateChange(async (event, session) => {
        set({ user: session?.user ?? null, session })
        if (session?.user) {
          await get().fetchProfile()
        } else {
          set({ profile: null })
        }
      })
    } catch (error) {
      console.error('Auth initialization error:', error)
      set({ loading: false })
    }
  },

  signUp: async (email, password, displayName) => {
    set({ authError: null })
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            display_name: displayName || email.split('@')[0]
          }
        }
      })

      if (error) {
        const msg = translateAuthError(error.message)
        set({ authError: msg })
        return { success: false, error: msg }
      }

      if (data.user) {
        set({ user: data.user, session: data.session })
        return { success: true }
      }

      return { success: true }
    } catch (err: any) {
      const msg = err.message || '注册失败，请稍后重试'
      set({ authError: msg })
      return { success: false, error: msg }
    }
  },

  signIn: async (email, password) => {
    set({ authError: null })
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      })

      if (error) {
        const msg = translateAuthError(error.message)
        set({ authError: msg })
        return { success: false, error: msg }
      }

      set({ user: data.user, session: data.session })
      await get().fetchProfile()
      return { success: true }
    } catch (err: any) {
      const msg = err.message || '登录失败，请稍后重试'
      set({ authError: msg })
      return { success: false, error: msg }
    }
  },

  signOut: async () => {
    await supabase.auth.signOut()
    set({ user: null, session: null, profile: null })
  },

  fetchProfile: async () => {
    const { user } = get()
    if (!user) return

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()

      if (error) {
        console.error('Error fetching profile:', error)
        return
      }

      set({ profile: data })
    } catch (err) {
      console.error('Error fetching profile:', err)
    }
  },

  updateProfile: async (updates) => {
    const { user } = get()
    if (!user) return

    const { error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', user.id)

    if (!error) {
      await get().fetchProfile()
    }
  },

  clearError: () => set({ authError: null })
}))

function translateAuthError(message: string): string {
  const map: Record<string, string> = {
    'Invalid login credentials': '邮箱或密码错误',
    'Email not confirmed': '请先验证您的邮箱',
    'User already registered': '该邮箱已注册',
    'Password should be at least 6 characters': '密码至少需要 6 个字符',
    'Unable to validate email address: invalid format': '邮箱格式不正确',
    'Email rate limit exceeded': '操作过于频繁，请稍后重试',
    'For security purposes, you can only request this after': '操作过于频繁，请稍后重试',
  }

  for (const [key, value] of Object.entries(map)) {
    if (message.includes(key)) return value
  }
  return message
}
