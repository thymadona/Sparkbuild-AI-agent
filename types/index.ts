export type ProjectFiles = Record<string, string>

// null = homework not handed in yet
export type SubmissionStatus = 'submitted' | 'approved' | 'needs_work'

export interface Project {
  id: string
  user_id: string
  title: string
  files: ProjectFiles
  is_public: boolean
  lesson_id: number | null
  lesson_version: number | null
  submission_status: SubmissionStatus | null
  created_at: string
  updated_at: string
}

export interface LessonProgress {
  project_id: string
  completed_task_ids: string[]
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
  role: 'user' | 'assistant' | 'teacher'
  content: string
  created_at: string
}

export interface StudentProfile {
  user_id: string
  full_name: string
  parent_email: string | null
  parent_telegram_chat_id: string | null
  notes: string | null
  is_active: boolean
  created_by: string | null
  created_at: string
}

export interface Class {
  id: string
  name: string
  description: string | null
  created_at: string
}

export interface ClassMember {
  class_id: string
  user_id: string
  role: 'student' | 'teacher'
  joined_at: string
}

export interface ClassSchedule {
  id: string
  class_id: string
  day_of_week: number // 0=Sun … 6=Sat
  start_time: string  // HH:MM:SS
  duration_min: number
  label: string | null
}

export interface Invoice {
  id: string
  user_id: string
  amount_cents: number
  description: string
  due_date: string
  status: 'unpaid' | 'paid' | 'void'
  sent_at: string | null
  paid_at: string | null
  created_at: string
}

export interface Receipt {
  id: string
  invoice_id: string
  user_id: string
  amount_cents: number
  description: string
  paid_at: string
  receipt_number: string
}

export interface Role {
  id: string
  name: string
  description: string | null
  created_at: string
}

export interface Permission {
  id: string
  key: string
  description: string | null
  created_at: string
}

export interface RolePermission {
  role_id: string
  permission_id: string
}

export interface UserRole {
  user_id: string
  role_id: string
  granted_by: string | null
  created_at: string
}
