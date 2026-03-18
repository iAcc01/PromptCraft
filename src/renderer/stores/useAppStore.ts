import { create } from 'zustand'
import { v4 as uuidv4 } from 'uuid'
import { Prompt, PromptVersion, DebugRecord, ViewMode, SortBy, ActiveView, RightPanelTab } from '../types'
import { supabase } from '../lib/supabase'
import { useAuthStore } from './useAuthStore'

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
    updatedAt: row.updated_at
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
          if (prompts.length === 0) prompts = getSamplePrompts()
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
  return [
    {
      id: uuidv4(),
      title: '专业技术文章写作',
      description: '帮助撰写结构清晰、内容深入的技术博客文章',
      content: '你是一位资深技术博客作者。请根据以下要求撰写一篇技术文章：\n\n主题：{{topic}}\n目标读者：{{audience}}\n文章长度：{{length}}\n\n要求：\n1. 开头用一个引人入胜的场景或问题引入\n2. 使用清晰的标题层级结构\n3. 包含代码示例（如适用）\n4. 每个章节结尾有小结\n5. 文末提供延伸阅读建议',
      category: '写作',
      tags: ['技术', '博客', '写作'],
      variables: [
        { name: 'topic', description: '文章主题', defaultValue: 'React Hooks 最佳实践' },
        { name: 'audience', description: '目标读者群', defaultValue: '中级前端开发者' },
        { name: 'length', description: '期望字数', defaultValue: '3000字' }
      ],
      versions: [],
      debugRecords: [],
      isFavorite: true,
      isShared: false,
      shareCode: '',
      author: 'Me',
      collaborators: [],
      createdAt: now,
      updatedAt: now,
      useCount: 0
    },
    {
      id: uuidv4(),
      title: 'Code Review 助手',
      description: '对代码进行专业的 Review，给出改进建议',
      content: '你是一位经验丰富的高级软件工程师，擅长代码审查。\n\n请对以下 {{language}} 代码进行审查：\n\n```{{language}}\n{{code}}\n```\n\n请从以下角度进行评审：\n- 代码质量与可读性\n- 性能优化建议\n- 安全性考虑\n- 最佳实践遵循度\n- 可维护性\n\n输出格式：\n1. 整体评分（1-10）\n2. 优点列表\n3. 问题与建议（按严重程度排序）\n4. 重构建议代码',
      category: '编程',
      tags: ['代码审查', '编程', '质量'],
      variables: [
        { name: 'language', description: '编程语言', defaultValue: 'TypeScript' },
        { name: 'code', description: '待审查的代码', defaultValue: '// paste your code here' }
      ],
      versions: [],
      debugRecords: [],
      isFavorite: false,
      isShared: false,
      shareCode: '',
      author: 'Me',
      collaborators: [],
      createdAt: now,
      updatedAt: now,
      useCount: 0
    },
    {
      id: uuidv4(),
      title: '多语言翻译专家',
      description: '提供高质量的多语言翻译，保持语境和风格',
      content: '你是一位精通多国语言的翻译专家，尤其擅长 {{source_lang}} 和 {{target_lang}} 之间的翻译。\n\n请翻译以下内容：\n\n{{text}}\n\n翻译要求：\n- 准确传达原文含义\n- 保持原文的语气和风格\n- 使用目标语言的自然表达\n- 对于专业术语，在括号中保留原文\n- 如有文化差异，添加简短注释',
      category: '翻译',
      tags: ['翻译', '多语言'],
      variables: [
        { name: 'source_lang', description: '源语言', defaultValue: '中文' },
        { name: 'target_lang', description: '目标语言', defaultValue: '英文' },
        { name: 'text', description: '待翻译文本', defaultValue: '' }
      ],
      versions: [],
      debugRecords: [],
      isFavorite: true,
      isShared: false,
      shareCode: '',
      author: 'Me',
      collaborators: [],
      createdAt: now,
      updatedAt: now,
      useCount: 0
    },
    {
      id: uuidv4(),
      title: '产品需求分析师',
      description: '从用户故事中提炼产品需求，输出 PRD 文档',
      content: '你是一位资深产品经理，擅长需求分析和 PRD 撰写。\n\n产品名称：{{product}}\n用户描述/需求：{{requirement}}\n\n请完成以下工作：\n\n1. **需求概述**：用一段话总结核心需求\n2. **用户画像**：描述目标用户特征\n3. **功能需求列表**：按优先级（P0-P3）排列\n4. **用户流程图**：用文字描述主要用户流程\n5. **数据需求**：列出需要的数据字段\n6. **非功能需求**：性能、安全等\n7. **验收标准**：列出可测试的验收条件',
      category: '分析',
      tags: ['产品', '需求', 'PRD'],
      variables: [
        { name: 'product', description: '产品名称', defaultValue: '' },
        { name: 'requirement', description: '用户需求描述', defaultValue: '' }
      ],
      versions: [],
      debugRecords: [],
      isFavorite: false,
      isShared: false,
      shareCode: '',
      author: 'Me',
      collaborators: [],
      createdAt: now,
      updatedAt: now,
      useCount: 0
    },
    {
      id: uuidv4(),
      title: '创意故事生成器',
      description: '根据关键元素生成引人入胜的短故事',
      content: '你是一位才华横溢的故事创作者。请根据以下元素创作一个短故事：\n\n故事类型：{{genre}}\n主要角色：{{character}}\n故事背景：{{setting}}\n核心冲突：{{conflict}}\n\n写作要求：\n- 字数控制在 {{wordcount}} 字左右\n- 使用生动的描写和对话\n- 构建合理的起承转合\n- 结尾要有余味，引人深思',
      category: '创意',
      tags: ['故事', '创意写作'],
      variables: [
        { name: 'genre', description: '故事类型', defaultValue: '科幻' },
        { name: 'character', description: '主角描述', defaultValue: '一位年轻的AI研究员' },
        { name: 'setting', description: '故事背景', defaultValue: '2050年的上海' },
        { name: 'conflict', description: '核心冲突', defaultValue: '发现AI产生了自我意识' },
        { name: 'wordcount', description: '字数要求', defaultValue: '1500' }
      ],
      versions: [],
      debugRecords: [],
      isFavorite: false,
      isShared: false,
      shareCode: '',
      author: 'Me',
      collaborators: [],
      createdAt: now,
      updatedAt: now,
      useCount: 0
    }
  ]
}
