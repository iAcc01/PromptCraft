import { create } from 'zustand'
import { v4 as uuidv4 } from 'uuid'
import { Prompt, PromptVersion, DebugRecord, ViewMode, SortBy, ActiveView, RightPanelTab } from '../types'
import { supabase } from '../lib/supabase'
import { useAuthStore } from './useAuthStore'
import { DEFAULT_PROMPTS } from '../data/defaultPrompts'

// For browser dev mode, use localStorage fallback
const isElectron = typeof window !== 'undefined' && (window as any).require
const ipcRenderer = isElectron ? (window as any).require('electron').ipcRenderer : null

const STORAGE_KEY = 'promptcraft-prompts'

function loadFromStorage(): Prompt[] {
  try {
    const data = localStorage.getItem(STORAGE_KEY)
    return data ? JSON.parse(data) : []
  } catch {
    return []
  }
}

function saveToStorage(prompts: Prompt[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(prompts))
}

// Convert a Prompt to Supabase DB row format
function promptToRow(prompt: Prompt, userId: string) {
  return {
    id: prompt.id,
    user_id: userId,
    title: prompt.title,
    description: prompt.description,
    content: prompt.content,
    category: prompt.category,
    tags: prompt.tags,
    variables: prompt.variables,
    versions: prompt.versions,
    debug_records: prompt.debugRecords,
    is_favorite: prompt.isFavorite,
    is_shared: prompt.isShared,
    share_code: prompt.shareCode,
    author: prompt.author,
    collaborators: prompt.collaborators,
    created_at: prompt.createdAt,
    updated_at: prompt.updatedAt
  }
}

// Convert a Supabase DB row to Prompt format
function rowToPrompt(row: any): Prompt {
  return {
    id: row.id,
    title: row.title || '未命名提示词',
    description: row.description || '',
    content: row.content || '',
    category: row.category || '自定义',
    tags: row.tags || [],
    variables: row.variables || [],
    versions: row.versions || [],
    debugRecords: row.debug_records || [],
    isFavorite: row.is_favorite || false,
    isShared: row.is_shared || false,
    shareCode: row.share_code || '',
    author: row.author || '',
    collaborators: row.collaborators || [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    useCount: row.use_count || 0
  }
}

interface AppState {
  prompts: Prompt[]
  selectedPromptId: string | null
  activeView: ActiveView
  rightPanelTab: RightPanelTab
  searchQuery: string
  selectedCategory: string
  viewMode: ViewMode
  sortBy: SortBy
  sidebarCollapsed: boolean
  darkMode: boolean
  syncing: boolean
  localMode: boolean

  // Actions
  loadPrompts: () => Promise<void>
  savePrompts: () => Promise<void>
  addPrompt: (prompt?: Partial<Prompt>) => Prompt
  updatePrompt: (id: string, updates: Partial<Prompt>) => void
  deletePrompt: (id: string) => void
  duplicatePrompt: (id: string) => void
  toggleFavorite: (id: string) => void
  selectPrompt: (id: string | null) => void
  setActiveView: (view: ActiveView) => void
  setRightPanelTab: (tab: RightPanelTab) => void
  setSearchQuery: (query: string) => void
  setSelectedCategory: (category: string) => void
  setViewMode: (mode: ViewMode) => void
  setSortBy: (sort: SortBy) => void
  toggleSidebar: () => void
  toggleDarkMode: () => void
  setLocalMode: (mode: boolean) => void
  addVersion: (promptId: string, note: string) => void
  restoreVersion: (promptId: string, versionId: string) => void
  addDebugRecord: (promptId: string, record: Omit<DebugRecord, 'id' | 'timestamp'>) => void
  trackUsage: (promptId: string) => void
  getFilteredPrompts: () => Prompt[]
  getRecentPrompts: (limit?: number) => Prompt[]
  getSharedPrompts: () => Prompt[]
  getSelectedPrompt: () => Prompt | undefined
  syncPromptToSupabase: (prompt: Prompt) => Promise<void>
  deletePromptFromSupabase: (id: string) => Promise<void>
}

function getUser() {
  return useAuthStore.getState().user
}

export const useAppStore = create<AppState>((set, get) => ({
  prompts: [],
  selectedPromptId: null,
  activeView: 'workspace',
  rightPanelTab: 'debug',
  searchQuery: '',
  selectedCategory: '全部',
  viewMode: 'grid',
  sortBy: 'updatedAt',
  sidebarCollapsed: false,
  darkMode: false,
  syncing: false,
  localMode: false,

  loadPrompts: async () => {
    const user = getUser()

    // If logged in, load from Supabase
    if (user) {
      set({ syncing: true })
      try {
        const { data, error } = await supabase
          .from('prompts')
          .select('*')
          .eq('user_id', user.id)
          .order('updated_at', { ascending: false })

        if (error) {
          console.error('Error loading prompts from Supabase:', error)
          // Fall back to local
          let prompts = ipcRenderer ? await ipcRenderer.invoke('load-prompts') : loadFromStorage()
          if (prompts.length === 0) {
            prompts = getSamplePrompts()
          } else {
            const { merged, newCount } = mergeDefaultPrompts(prompts)
            if (newCount > 0) prompts = merged
          }
          set({ prompts, syncing: false })
          return
        }

        let prompts = (data || []).map(rowToPrompt)

        // If no cloud data, check local and migrate
        if (prompts.length === 0) {
          const localPrompts = ipcRenderer ? await ipcRenderer.invoke('load-prompts') : loadFromStorage()
          if (localPrompts.length > 0) {
            // Migrate local prompts to cloud
            for (const p of localPrompts) {
              const row = promptToRow(p, user.id)
              await supabase.from('prompts').upsert(row)
            }
            prompts = localPrompts
          } else {
            prompts = getSamplePrompts()
            // Save sample prompts to cloud
            for (const p of prompts) {
              const row = promptToRow(p, user.id)
              await supabase.from('prompts').upsert(row)
            }
          }
        }

        // Merge any new default prompts that don't exist yet
        const { merged, newCount } = mergeDefaultPrompts(prompts)
        if (newCount > 0) {
          prompts = merged
          // Save new prompts to cloud
          const newOnes = merged.slice(merged.length - newCount)
          for (const p of newOnes) {
            const row = promptToRow(p, user.id)
            await supabase.from('prompts').upsert(row)
          }
          console.log(`Merged ${newCount} new default prompts`)
        }

        set({ prompts, syncing: false })
      } catch (err) {
        console.error('Error loading prompts:', err)
        set({ syncing: false })
      }
      return
    }

    // Not logged in: use local storage
    let prompts: Prompt[] = []
    if (ipcRenderer) {
      prompts = await ipcRenderer.invoke('load-prompts')
    } else {
      prompts = loadFromStorage()
    }
    if (prompts.length === 0) {
      prompts = getSamplePrompts()
    } else {
      // Merge any new default prompts for existing users
      const { merged, newCount } = mergeDefaultPrompts(prompts)
      if (newCount > 0) {
        prompts = merged
        console.log(`Merged ${newCount} new default prompts`)
      }
    }
    set({ prompts })
  },

  savePrompts: async () => {
    const { prompts } = get()
    // Always save locally as backup
    if (ipcRenderer) {
      await ipcRenderer.invoke('save-prompts', prompts)
    } else {
      saveToStorage(prompts)
    }
  },

  syncPromptToSupabase: async (prompt: Prompt) => {
    const user = getUser()
    if (!user) return

    try {
      const row = promptToRow(prompt, user.id)
      const { error } = await supabase.from('prompts').upsert(row)
      if (error) {
        console.error('Error syncing prompt to Supabase:', error)
      }
    } catch (err) {
      console.error('Error syncing prompt:', err)
    }
  },

  deletePromptFromSupabase: async (id: string) => {
    const user = getUser()
    if (!user) return

    try {
      const { error } = await supabase
        .from('prompts')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id)

      if (error) {
        console.error('Error deleting prompt from Supabase:', error)
      }
    } catch (err) {
      console.error('Error deleting prompt:', err)
    }
  },

  addPrompt: (partial) => {
    const now = new Date().toISOString()
    const user = getUser()
    const newPrompt: Prompt = {
      id: uuidv4(),
      title: '未命名提示词',
      description: '',
      content: '',
      category: '自定义',
      tags: [],
      variables: [],
      versions: [],
      debugRecords: [],
      isFavorite: false,
      isShared: false,
      shareCode: '',
      author: user?.email?.split('@')[0] || 'Me',
      collaborators: [],
      createdAt: now,
      updatedAt: now,
      useCount: 0,
      ...partial
    }
    set(state => {
      const prompts = [newPrompt, ...state.prompts]
      setTimeout(() => {
        get().savePrompts()
        get().syncPromptToSupabase(newPrompt)
      }, 0)
      return { prompts, selectedPromptId: newPrompt.id, activeView: 'editor' }
    })
    return newPrompt
  },

  updatePrompt: (id, updates) => {
    set(state => {
      const prompts = state.prompts.map(p =>
        p.id === id ? { ...p, ...updates, updatedAt: new Date().toISOString() } : p
      )
      const updatedPrompt = prompts.find(p => p.id === id)
      setTimeout(() => {
        get().savePrompts()
        if (updatedPrompt) get().syncPromptToSupabase(updatedPrompt)
      }, 0)
      return { prompts }
    })
  },

  deletePrompt: (id) => {
    set(state => {
      const prompts = state.prompts.filter(p => p.id !== id)
      const selectedPromptId = state.selectedPromptId === id ? null : state.selectedPromptId
      setTimeout(() => {
        get().savePrompts()
        get().deletePromptFromSupabase(id)
      }, 0)
      return { prompts, selectedPromptId, activeView: selectedPromptId ? state.activeView : 'workspace' }
    })
  },

  duplicatePrompt: (id) => {
    const prompt = get().prompts.find(p => p.id === id)
    if (prompt) {
      get().addPrompt({
        ...prompt,
        id: undefined as any,
        title: `${prompt.title} (副本)`,
        versions: [],
        debugRecords: [],
        isShared: false,
        shareCode: ''
      })
    }
  },

  toggleFavorite: (id) => {
    set(state => {
      const prompts = state.prompts.map(p =>
        p.id === id ? { ...p, isFavorite: !p.isFavorite } : p
      )
      const updatedPrompt = prompts.find(p => p.id === id)
      setTimeout(() => {
        get().savePrompts()
        if (updatedPrompt) get().syncPromptToSupabase(updatedPrompt)
      }, 0)
      return { prompts }
    })
  },

  selectPrompt: (id) => set({ selectedPromptId: id }),
  setActiveView: (view) => set({ activeView: view }),
  setRightPanelTab: (tab) => set({ rightPanelTab: tab }),
  setSearchQuery: (query) => set({ searchQuery: query }),
  setSelectedCategory: (category) => set({ selectedCategory: category }),
  setViewMode: (mode) => set({ viewMode: mode }),
  setSortBy: (sort) => set({ sortBy: sort }),
  toggleSidebar: () => set(s => ({ sidebarCollapsed: !s.sidebarCollapsed })),
  toggleDarkMode: () => set(s => ({ darkMode: !s.darkMode })),
  setLocalMode: (mode) => set({ localMode: mode }),

  trackUsage: (promptId) => {
    set(state => {
      const prompts = state.prompts.map(p =>
        p.id === promptId ? { ...p, lastUsedAt: new Date().toISOString(), useCount: (p.useCount || 0) + 1 } : p
      )
      const updatedPrompt = prompts.find(p => p.id === promptId)
      setTimeout(() => {
        get().savePrompts()
        if (updatedPrompt) get().syncPromptToSupabase(updatedPrompt)
      }, 0)
      return { prompts }
    })
  },

  addVersion: (promptId, note) => {
    const prompt = get().prompts.find(p => p.id === promptId)
    if (prompt) {
      const version: PromptVersion = {
        id: uuidv4(),
        content: prompt.content,
        variables: [...prompt.variables],
        createdAt: new Date().toISOString(),
        note
      }
      get().updatePrompt(promptId, {
        versions: [...prompt.versions, version]
      })
    }
  },

  restoreVersion: (promptId, versionId) => {
    const prompt = get().prompts.find(p => p.id === promptId)
    if (prompt) {
      const version = prompt.versions.find(v => v.id === versionId)
      if (version) {
        get().updatePrompt(promptId, {
          content: version.content,
          variables: [...version.variables]
        })
      }
    }
  },

  addDebugRecord: (promptId, record) => {
    const prompt = get().prompts.find(p => p.id === promptId)
    if (prompt) {
      const debugRecord: DebugRecord = {
        ...record,
        id: uuidv4(),
        timestamp: new Date().toISOString()
      }
      get().updatePrompt(promptId, {
        debugRecords: [debugRecord, ...prompt.debugRecords]
      })
    }
  },

  getFilteredPrompts: () => {
    const { prompts, searchQuery, selectedCategory, sortBy } = get()
    let filtered = [...prompts]

    if (selectedCategory === '收藏') {
      filtered = filtered.filter(p => p.isFavorite)
    } else if (selectedCategory === '最近使用') {
      filtered = filtered.filter(p => p.lastUsedAt)
      filtered.sort((a, b) => new Date(b.lastUsedAt!).getTime() - new Date(a.lastUsedAt!).getTime())
    } else if (selectedCategory === '已分享') {
      filtered = filtered.filter(p => p.isShared)
    } else if (selectedCategory !== '全部') {
      filtered = filtered.filter(p => p.category === selectedCategory)
    }

    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      filtered = filtered.filter(p =>
        p.title.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q) ||
        p.content.toLowerCase().includes(q) ||
        p.tags.some(t => t.toLowerCase().includes(q))
      )
    }

    if (selectedCategory !== '最近使用') {
      filtered.sort((a, b) => {
        if (sortBy === 'title') return a.title.localeCompare(b.title)
        if (sortBy === 'useCount') return (b.useCount || 0) - (a.useCount || 0)
        return new Date(b[sortBy]).getTime() - new Date(a[sortBy]).getTime()
      })
    }

    return filtered
  },

  getSelectedPrompt: () => {
    const { prompts, selectedPromptId } = get()
    return prompts.find(p => p.id === selectedPromptId)
  },

  getRecentPrompts: (limit = 8) => {
    const { prompts } = get()
    return [...prompts]
      .filter(p => p.lastUsedAt)
      .sort((a, b) => new Date(b.lastUsedAt!).getTime() - new Date(a.lastUsedAt!).getTime())
      .slice(0, limit)
  },

  getSharedPrompts: () => {
    const { prompts } = get()
    return prompts.filter(p => p.isShared)
  }
}))

function getSamplePrompts(): Prompt[] {
  const now = new Date().toISOString()
  return DEFAULT_PROMPTS.map(p => ({
    id: uuidv4(),
    title: p.title,
    description: p.description,
    content: p.content,
    category: p.category,
    tags: p.tags,
    variables: p.variables,
    versions: [],
    debugRecords: [],
    isFavorite: false,
    isShared: false,
    shareCode: '',
    author: 'PromptMinder',
    collaborators: [],
    createdAt: now,
    updatedAt: now,
    useCount: 0
  }))
}

// Merge default prompts into existing prompts (by title dedup)
// This ensures existing users also get new default prompts on update
function mergeDefaultPrompts(existing: Prompt[]): { merged: Prompt[]; newCount: number } {
  const existingTitles = new Set(existing.map(p => p.title))
  const now = new Date().toISOString()
  const newPrompts: Prompt[] = []

  for (const p of DEFAULT_PROMPTS) {
    if (!existingTitles.has(p.title)) {
      newPrompts.push({
        id: uuidv4(),
        title: p.title,
        description: p.description,
        content: p.content,
        category: p.category,
        tags: p.tags,
        variables: p.variables,
        versions: [],
        debugRecords: [],
        isFavorite: false,
        isShared: false,
        shareCode: '',
        author: 'PromptMinder',
        collaborators: [],
        createdAt: now,
        updatedAt: now,
        useCount: 0
      })
    }
  }

  return {
    merged: [...existing, ...newPrompts],
    newCount: newPrompts.length
  }
}
