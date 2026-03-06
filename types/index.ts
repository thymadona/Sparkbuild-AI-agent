export type ProjectFiles = Record<string, string>

export interface Project {
  id: string
  user_id: string
  title: string
  files: ProjectFiles
  is_public: boolean
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
