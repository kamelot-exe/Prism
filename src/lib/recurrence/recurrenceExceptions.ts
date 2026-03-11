import {
  createRecurrenceException,
  listRecurrenceExceptions,
  type CreateRecurrenceExceptionRequest,
  type RecurrenceExceptionRecord,
} from '../api';

export type ExceptionAction = 'skip' | 'modify';
export type RecurrenceException = RecurrenceExceptionRecord;

export function toOccurrenceDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export async function listExceptionsForEvent(eventId: number): Promise<RecurrenceException[]> {
  return listRecurrenceExceptions(eventId);
}

export async function findException(
  eventId: number,
  occurrenceDate: string
): Promise<RecurrenceException | undefined> {
  const records = await listRecurrenceExceptions(eventId);
  return records.find((entry) => entry.occurrenceDate === occurrenceDate);
}

export async function skipOccurrence(
  eventId: number,
  occurrenceDate: Date | string
): Promise<RecurrenceException> {
  return createRecurrenceException({
    eventId,
    occurrenceDate: toOccurrenceDate(occurrenceDate),
    action: 'skip',
  });
}

export async function modifyOccurrence(
  eventId: number,
  occurrenceDate: Date | string,
  patch: Pick<CreateRecurrenceExceptionRequest, 'newStartTime' | 'newEndTime'>
): Promise<RecurrenceException> {
  return createRecurrenceException({
    eventId,
    occurrenceDate: toOccurrenceDate(occurrenceDate),
    action: 'modify',
    newStartTime: patch.newStartTime,
    newEndTime: patch.newEndTime,
  });
}

export async function resolveOccurrence(
  eventId: number,
  occurrenceDate: Date | string
): Promise<null | { newStartTime?: string | null; newEndTime?: string | null }> {
  const record = await findException(eventId, toOccurrenceDate(occurrenceDate));
  if (!record) return {};
  if (record.action === 'skip') return null;
  return {
    newStartTime: record.newStartTime,
    newEndTime: record.newEndTime,
  };
}

export async function isOccurrenceSkipped(eventId: number, occurrenceDate: Date | string): Promise<boolean> {
  const record = await findException(eventId, toOccurrenceDate(occurrenceDate));
  return record?.action === 'skip';
}

export async function getSkippedDates(eventId: number): Promise<string[]> {
  const records = await listRecurrenceExceptions(eventId);
  return records.filter((entry) => entry.action === 'skip').map((entry) => entry.occurrenceDate);
}
