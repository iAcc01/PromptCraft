export interface PromptVariable {
  name: string
  description: string
  defaultValue: string
}

export interface PromptVersion {
  id: string
  content: string
  variables: PromptVariable[]
  createdAt: string
  note: string
}

export interface DebugRecord {
  id: string
  variables: Record<string, string>
  renderedContent: string
  response: string
  rating: number
  timestamp: string
}

export interface Prompt {
  id: string
  title: string
  description: string
  content: string
  category: string
  tags: string[]
  variables: PromptVariable[]
  versions: PromptVersion[]
  debugRecords: DebugRecord[]
  isFavorite: boolean
  isShared: boolean
  shareCode: string
  author: string
  collaborators: string[]
  createdAt: string
  updatedAt: string
  lastUsedAt?: string
  useCount: number
}

export type ViewMode = 'grid' | 'list'
export type SortBy = 'updatedAt' | 'createdAt' | 'title' | 'useCount'
export type ActiveView = 'workspace' | 'library' | 'editor' | 'explore' | 'settings'
export type RightPanelTab = 'debug' | 'versions' | 'share' | 'info'

// 按照 Prompt Minder 信息架构重构的分类体系
export const DEFAULT_CATEGORIES = [
  '全部',
  'IT/编程',
  '写作辅助',
  '教育培训',
  '商业管理',
  '创意艺术',
  '生活服务',
  '技术开发',
  '语言翻译',
  '哲学/宗教',
  '医疗健康',
  'SEO',
  '娱乐游戏',
  '专业咨询',
  '技术培训',
  '商业办公',
  '社区贡献'
]

// 分类对应的 Emoji 图标
export const CATEGORY_ICONS: Record<string, string> = {
  '全部': '📋',
  'IT/编程': '💻',
  '写作辅助': '✍️',
  '教育培训': '🎓',
  '商业管理': '📊',
  '创意艺术': '🎨',
  '生活服务': '🏠',
  '技术开发': '⚙️',
  '语言翻译': '🌐',
  '哲学/宗教': '🧠',
  '医疗健康': '🏥',
  'SEO': '🔍',
  '娱乐游戏': '🎮',
  '专业咨询': '💼',
  '技术培训': '🔧',
  '商业办公': '🏢',
  '社区贡献': '🤝'
}
