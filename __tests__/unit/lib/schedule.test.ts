import { dueLabel, nextClassMeeting, type ClassSlot } from '@/lib/schedule'

// Wednesday 2026-07-29, 11:00 local.
const WEDNESDAY = new Date(2026, 6, 29, 11, 0, 0)

const tuesday4pm: ClassSlot = { day_of_week: 2, start_time: '16:00:00' }
const wednesday9am: ClassSlot = { day_of_week: 3, start_time: '09:00:00' }
const wednesday4pm: ClassSlot = { day_of_week: 3, start_time: '16:00' }
const friday2pm: ClassSlot = { day_of_week: 5, start_time: '14:00:00' }

describe('nextClassMeeting', () => {
  it('returns null when the student has no schedule', () => {
    expect(nextClassMeeting([], WEDNESDAY)).toBeNull()
  })

  it('finds a class later the same day', () => {
    const meeting = nextClassMeeting([wednesday4pm], WEDNESDAY)!
    expect(meeting.getDate()).toBe(29)
    expect(meeting.getHours()).toBe(16)
  })

  it('rolls a class that already happened today to next week', () => {
    const meeting = nextClassMeeting([wednesday9am], WEDNESDAY)!
    expect(meeting.getDate()).toBe(5) // next Wednesday, August
    expect(meeting.getMonth()).toBe(7)
    expect(meeting.getHours()).toBe(9)
  })

  it('picks the soonest of several slots', () => {
    const meeting = nextClassMeeting([friday2pm, wednesday4pm, tuesday4pm], WEDNESDAY)!
    expect(meeting.getDate()).toBe(29)
    expect(meeting.getHours()).toBe(16)
  })

  it('crosses into next week for a day already passed', () => {
    const meeting = nextClassMeeting([tuesday4pm], WEDNESDAY)!
    expect(meeting.getDay()).toBe(2)
    expect(meeting.getDate()).toBe(4) // next Tuesday, August
  })

  it('skips malformed slots instead of throwing', () => {
    const junk: ClassSlot[] = [
      { day_of_week: 9, start_time: '16:00' },
      { day_of_week: -1, start_time: '16:00' },
      { day_of_week: 5, start_time: 'lunchtime' },
      { day_of_week: 5, start_time: '99:99' },
    ]
    expect(nextClassMeeting(junk, WEDNESDAY)).toBeNull()
    expect(nextClassMeeting([...junk, friday2pm], WEDNESDAY)?.getDay()).toBe(5)
  })
})

describe('dueLabel', () => {
  it('says nothing when there is no class', () => {
    expect(dueLabel(null, WEDNESDAY)).toBeNull()
  })

  it('warns when class is today', () => {
    expect(dueLabel(nextClassMeeting([wednesday4pm], WEDNESDAY), WEDNESDAY)).toBe('Hand in today, before class.')
  })

  it('says tomorrow for the next day', () => {
    const thursday: ClassSlot = { day_of_week: 4, start_time: '10:00' }
    expect(dueLabel(nextClassMeeting([thursday], WEDNESDAY), WEDNESDAY)).toBe('Hand in by tomorrow.')
  })

  it('names the weekday for anything further out', () => {
    expect(dueLabel(nextClassMeeting([friday2pm], WEDNESDAY), WEDNESDAY)).toBe('Hand in before Friday.')
  })

  it('stays inside the reading budget', () => {
    for (const slot of [wednesday4pm, friday2pm, tuesday4pm]) {
      const label = dueLabel(nextClassMeeting([slot], WEDNESDAY), WEDNESDAY)!
      expect(label.split(/\s+/).length).toBeLessThanOrEqual(6)
    }
  })
})
