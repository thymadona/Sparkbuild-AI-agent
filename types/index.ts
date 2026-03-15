export type ProjectFiles = Record<string, string>

export interface Project {
  id: string
  user_id: string
  title: string
  files: ProjectFiles
  is_public: boolean
  lesson_id: number | null
  created_at: string
  updated_at: string
}

export interface Prompt {
  id: string
  user_id: string
  project_id: string
  content: string
  created_at: string
}

export interface Message {
  id: string
  project_id: string
  user_id: string
  role: 'user' | 'assistant'
  content: string
  created_at: string
}
