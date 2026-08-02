import { ForbiddenException } from '@nestjs/common';

const DEFAULT_TIME_ZONE = 'America/Los_Angeles';
const DEFAULT_CHECK_IN_BEFORE_MINUTES = 15;

function parseScheduleTime(value: string): { hours: number; minutes: number } {
  const match = value.trim().match(/^(\d{1,2}):(\d{2})(?:\s*([AP]M))?$/i);
  if (!match) throw new Error('Invalid class schedule time');

  let hours = Number(match[1]);
  const minutes = Number(match[2]);
  const modifier = match[3]?.toUpperCase();
  if (minutes > 59 || (modifier && (hours < 1 || hours > 12)) || (!modifier && hours > 23)) {
    throw new Error('Invalid class schedule time');
  }
  if (modifier === 'PM' && hours !== 12) hours += 12;
  if (modifier === 'AM' && hours === 12) hours = 0;
  return { hours, minutes };
}

export function getClassStartUtc(
  scheduleDay: string,
  scheduleTime: string,
  timeZone = process.env.CLASS_TIME_ZONE || DEFAULT_TIME_ZONE,
): Date {
  const dateMatch = scheduleDay.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!dateMatch) throw new Error('Invalid class schedule date');
  const { hours, minutes } = parseScheduleTime(scheduleTime);
  const desiredUtc = Date.UTC(
    Number(dateMatch[1]),
    Number(dateMatch[2]) - 1,
    Number(dateMatch[3]),
    hours,
    minutes,
  );

  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  });

  let candidate = desiredUtc;
  // Two passes handle offset changes around daylight-saving boundaries.
  for (let iteration = 0; iteration < 2; iteration += 1) {
    const parts = Object.fromEntries(
      formatter
        .formatToParts(new Date(candidate))
        .filter((part) => part.type !== 'literal')
        .map((part) => [part.type, Number(part.value)]),
    );
    const representedAsUtc = Date.UTC(
      parts.year,
      parts.month - 1,
      parts.day,
      parts.hour,
      parts.minute,
      parts.second,
    );
    candidate = desiredUtc - (representedAsUtc - candidate);
  }

  return new Date(candidate);
}

export function assertAttendanceCheckInWindow(
  yogaClass: {
    scheduleDay: string;
    scheduleTime: string;
    durationMinutes: number;
  },
  now = new Date(),
): void {
  const start = getClassStartUtc(yogaClass.scheduleDay, yogaClass.scheduleTime);
  const beforeMinutes = Number(
    process.env.ATTENDANCE_CHECK_IN_BEFORE_MINUTES ||
      DEFAULT_CHECK_IN_BEFORE_MINUTES,
  );
  const afterMinutes = Number(process.env.ATTENDANCE_CHECK_IN_AFTER_MINUTES || 0);
  const opensAt = start.getTime() - beforeMinutes * 60_000;
  const closesAt =
    start.getTime() + (yogaClass.durationMinutes + afterMinutes) * 60_000;

  if (now.getTime() < opensAt || now.getTime() > closesAt) {
    throw new ForbiddenException(
      `Attendance check-in opens ${beforeMinutes} minutes before class and closes at class end`,
    );
  }
}
