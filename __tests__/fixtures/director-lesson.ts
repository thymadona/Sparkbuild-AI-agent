import { LESSONS, type Lesson } from '@/lib/lessons'

// A director lesson that exists only in tests: no shipped lesson has aiPolicy 'director'
// until phase 3b. Every string is unique so a test can prove Bolt never sees it.
export const DIRECTOR_LESSON: Lesson = {
  id: 999,
  title: 'Fixture Director Week',
  description: 'ZEBRA_LESSON_DESCRIPTION',
  templateFile: 'py/w1.py',
  starterFile: 'main.py',
  aiPolicy: 'director',
  tasks: [
    {
      id: 'dir-1',
      type: 'core',
      chip: 'ZEBRA_TASK_CHIP',
      success: 'ZEBRA_TASK_SUCCESS',
      prompt: 'ZEBRA_TASK_GOAL',
      checks: [
        {
          kind: 'sourceMatches',
          label: 'ZEBRA_CHECK_LABEL',
          hint: 'ZEBRA_CHECK_HINT',
          pattern: 'ZEBRA_CHECK_PATTERN',
        },
      ],
    },
  ],
}

// getLessonForProject reads LESSONS live, so a test adds the fixture for its own run.
export const addDirectorLesson = () => LESSONS.push(DIRECTOR_LESSON)
export const removeDirectorLesson = () => LESSONS.splice(LESSONS.indexOf(DIRECTOR_LESSON), 1)
