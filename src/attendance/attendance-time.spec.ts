import {
  assertAttendanceCheckInWindow,
  getClassStartUtc,
} from './attendance-time';

describe('California attendance time', () => {
  beforeEach(() => {
    process.env.CLASS_TIME_ZONE = 'America/Los_Angeles';
    process.env.ATTENDANCE_CHECK_IN_BEFORE_MINUTES = '15';
    process.env.ATTENDANCE_CHECK_IN_AFTER_MINUTES = '0';
  });

  it('converts California summer time using daylight saving', () => {
    expect(getClassStartUtc('2026-08-02', '7:00 AM').toISOString()).toBe(
      '2026-08-02T14:00:00.000Z',
    );
  });

  it('converts California winter time using standard time', () => {
    expect(getClassStartUtc('2026-12-02', '7:00 AM').toISOString()).toBe(
      '2026-12-02T15:00:00.000Z',
    );
  });

  it('allows check-in inside the configured window and rejects early access', () => {
    const yogaClass = {
      scheduleDay: '2026-08-02',
      scheduleTime: '7:00 AM',
      durationMinutes: 60,
    };
    expect(() =>
      assertAttendanceCheckInWindow(
        yogaClass,
        new Date('2026-08-02T13:45:00.000Z'),
      ),
    ).not.toThrow();
    expect(() =>
      assertAttendanceCheckInWindow(
        yogaClass,
        new Date('2026-08-02T13:44:59.000Z'),
      ),
    ).toThrow('Attendance check-in opens');
  });
});
