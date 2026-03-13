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
}

export type ViewMode = 'grid' | 'list'
export type SortBy = 'updatedAt' | 'createdAt' | 'title'

export const DEFAULT_CATEGORIES = [
  '全部',
  '写作',
  '编程',
  '翻译',
  '分析',
  '创意',
  '角色扮演',
  '工具',
  '自定义'
]
