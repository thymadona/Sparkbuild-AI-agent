export type ProjectFiles = Record<string, string>

// Unused since the homework/review feature was removed — describes the
// values the retained-but-unwritten submission_status column can still hold.
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

// Snapshot of what actually went into a turn's model call — captured so a
// past turn can be replayed as an eval/regression fixture, since none of
// this survives anywhere else (projects.files and lesson_progress are
// mutated in place).
export interface PromptContext {
  mode: 'ask' | 'build'
  reasoning_effort: 'low' | 'high' | 'max'
  system_content: string
  user_content: string
  history: { role: 'user' | 'assistant'; content: string }[]
  open_task_id: string | null
  escalation_tier: 1 | 2 | 3
}

export interface Prompt {
  id: string
  user_id: string
  project_id: string
  content: string
  context: PromptContext | null
  created_at: string
}

export interface Message {
  id: string
  project_id: string
  user_id: string
  role: 'user' | 'assistant' | 'teacher' | 'helper'
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
  start_time: string // HH:MM:SS
  duration_min: number
  label: string | null
}

export interface ClassEnabledLesson {
  class_id: string
  lesson_id: number
  enabled_by: string | null
  enabled_at: string
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

export interface AppSetting {
  key: string
  value: unknown // jsonb
  updated_at: string
}
