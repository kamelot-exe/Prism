import { safeInvoke, isTauriEnvironment } from './safeInvoke';

export interface Category {
  id?: number;
  name: string;
  color_hex: string;
  color?: string;
  created_at?: string;
  is_hidden?: boolean;
  sort_order?: number;
}

export interface Event {
  id?: number;
  title: string;
  description?: string | null;
  start_time: string;
  end_time: string;
  category_id?: number | null;
  all_day?: boolean;
  recurrence_rule?: string | null;
  reminder_minutes?: number | null;
  source?: string | null;
  external_id?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface CreateEventRequest {
  title: string;
  description?: string | null;
  start_time: string;
  end_time: string;
  category_id?: number | null;
  all_day?: boolean;
  recurrence_rule?: string | null;
  reminder_minutes?: number | null;
  source?: string | null;
  external_id?: string | null;
}

export interface UpdateEventRequest {
  id: number;
  title?: string;
  description?: string | null;
  start_time?: string;
  end_time?: string;
  category_id?: number | null;
  all_day?: boolean;
  recurrence_rule?: string | null;
  reminder_minutes?: number | null;
}

export interface Recurrence {
  kind: 'daily' | 'weekly' | 'monthly' | 'yearly' | 'custom';
  interval?: number;
  daysOfWeek?: number[];
}

export interface PomodoroSession {
  id: number;
  taskId?: number | null;
  kind: 'focus' | 'break';
  startedAt: string;
  endedAt?: string | null;
  durationMinutes: number;
  completed: boolean;
}

export interface NewPomodoroSessionPayload {
  taskId?: number | null;
  kind: 'focus' | 'break';
  startedAt: string;
  durationMinutes: number;
  completed: boolean;
  endedAt?: string | null;
}

export interface FocusSessionRecord {
  id: number;
  taskId?: number | null;
  plannedBlockId?: number | null;
  startedAt: string;
  endedAt?: string | null;
  durationMinutes?: number | null;
}

export interface CreateFocusSessionRequest {
  taskId?: number | null;
  plannedBlockId?: number | null;
  startedAt: string;
  endedAt?: string | null;
  durationMinutes?: number | null;
}

export interface CompleteFocusSessionRequest {
  id: number;
  endedAt?: string | null;
  durationMinutes?: number | null;
}

export interface PlannedBlockRecord {
  id: number;
  taskId?: number | null;
  eventId?: number | null;
  title: string;
  start: string;
  end: string;
  completed?: boolean;
  createdAt?: string;
}

export interface CreatePlannedBlockRequest {
  taskId?: number | null;
  eventId?: number | null;
  title: string;
  start: string;
  end: string;
  completed?: boolean;
}

export interface UpdatePlannedBlockRequest {
  id: number;
  taskId?: number | null;
  eventId?: number | null;
  title?: string;
  start?: string;
  end?: string;
  completed?: boolean;
}

export type TaskPriority = 'low' | 'normal' | 'high' | 'urgent';

export interface Task {
  id?: number;
  title: string;
  done?: boolean;
  date?: string | null;
  priority: TaskPriority;
  recurrence?: Recurrence | null;
  estimatedMinutes?: number;
  isFocus: boolean;
  created_at?: string;
}

export interface Setting {
  key: string;
  value: string;
}

export interface ProductivitySettings {
  pomodoroFocus: number;
  pomodoroBreak: number;
  pomodoroAutoStart?: boolean;
  quickAddDuration: number;
  todoAutoRoll: boolean;
  workDayStart?: string;
  workDayEnd?: string;
}

export interface AppSettings {
  theme: string;
  currentTheme: string;
  firstDayOfWeek: 'monday' | 'sunday';
  timeFormat: '12h' | '24h';
  userCategoryColors?: Record<string, string>;
  productivity: ProductivitySettings;
}

export interface GmailStatus {
  connected: boolean;
  lastSync?: string | null;
  email?: string | null;
}

export interface TokenInfo {
  access_token: string;
  refresh_token: string;
  expires_at?: string | null;
}

const fallbackId = () => Math.floor(Date.now() + Math.random() * 1000);
const fallbackPlannedBlocks = new Map<number, PlannedBlockRecord>();
const fallbackFocusSessions = new Map<number, FocusSessionRecord>();

const defaultAppSettings: AppSettings = {
  theme: 'base',
  currentTheme: 'base',
  firstDayOfWeek: 'monday',
  timeFormat: '24h',
  userCategoryColors: {},
  productivity: {
    pomodoroFocus: 25,
    pomodoroBreak: 5,
    pomodoroAutoStart: true,
    quickAddDuration: 60,
    todoAutoRoll: true,
    workDayStart: '09:00',
    workDayEnd: '18:00',
  },
};

function mapEventFromApi(e: any): Event {
  return {
    id: e.id,
    title: e.title,
    description: e.description,
    start_time: e.start_ts,
    end_time: e.end_ts,
    category_id: e.category_id,
    all_day: e.all_day,
    recurrence_rule: e.recurrence_rule,
    reminder_minutes: e.reminder_minutes,
    source: e.source,
    external_id: e.external_id,
    created_at: e.created_at,
    updated_at: e.updated_at,
  };
}

function mapEventToApi(request: CreateEventRequest | UpdateEventRequest) {
  const base: any = { ...request };
  if ('start_time' in base && base.start_time) {
    base.start_ts = base.start_time;
    delete base.start_time;
  }
  if ('end_time' in base && base.end_time) {
    base.end_ts = base.end_time;
    delete base.end_time;
  }
  if ('reminder_minutes' in base) {
    base.reminder_minutes = base.reminder_minutes ?? null;
  }
  return base;
}

function mapCategoryFromApi(c: any): Category {
  return { ...c, color: c.color_hex };
}

function mapPlannedBlockFromApi(record: any): PlannedBlockRecord {
  return {
    id: record.id,
    taskId: record.task_id,
    eventId: record.event_id,
    title: record.title,
    start: record.start_ts,
    end: record.end_ts,
    completed: record.completed,
    createdAt: record.created_at,
  };
}

function mapPlannedBlockToApi(
  request: CreatePlannedBlockRequest | UpdatePlannedBlockRequest
): Record<string, unknown> {
  const base: Record<string, unknown> = { ...request };
  if ('taskId' in base) {
    base.task_id = base.taskId ?? null;
    delete base.taskId;
  }
  if ('eventId' in base) {
    base.event_id = base.eventId ?? null;
    delete base.eventId;
  }
  if ('start' in base) {
    base.start_ts = base.start ?? null;
    delete base.start;
  }
  if ('end' in base) {
    base.end_ts = base.end ?? null;
    delete base.end;
  }
  return base;
}

function mapFocusSessionFromApi(record: any): FocusSessionRecord {
  return {
    id: record.id,
    taskId: record.task_id,
    plannedBlockId: record.planned_block_id,
    startedAt: record.started_at,
    endedAt: record.ended_at,
    durationMinutes: record.duration_minutes,
  };
}

function mapFocusSessionToApi(
  request: CreateFocusSessionRequest | CompleteFocusSessionRequest
): Record<string, unknown> {
  const base: Record<string, unknown> = { ...request };
  if ('taskId' in base) {
    base.task_id = base.taskId ?? null;
    delete base.taskId;
  }
  if ('plannedBlockId' in base) {
    base.planned_block_id = base.plannedBlockId ?? null;
    delete base.plannedBlockId;
  }
  if ('startedAt' in base) {
    base.started_at = base.startedAt ?? null;
    delete base.startedAt;
  }
  if ('endedAt' in base) {
    base.ended_at = base.endedAt ?? null;
    delete base.endedAt;
  }
  if ('durationMinutes' in base) {
    base.duration_minutes = base.durationMinutes ?? null;
    delete base.durationMinutes;
  }
  return base;
}

async function invokeOrThrow<T>(cmd: string, payload?: Record<string, unknown>): Promise<T> {
  const result = await safeInvoke<T>(cmd, payload);
  if (result === null) {
    throw new Error(`Invoke ${cmd} failed`);
  }
  return result;
}

export async function getEvents(startDate?: string, endDate?: string): Promise<Event[]> {
  if (!isTauriEnvironment()) return [];
  const events = await invokeOrThrow<any[]>('events_list', { start: startDate, end: endDate });
  return events.map(mapEventFromApi);
}

export async function createEvent(event: CreateEventRequest): Promise<Event> {
  if (!isTauriEnvironment()) {
    const now = new Date().toISOString();
    return {
      ...event,
      title: event.title || 'Untitled',
      id: fallbackId(),
      start_time: event.start_time,
      end_time: event.end_time,
      created_at: now,
      updated_at: now,
    };
  }
  const payload = mapEventToApi(event);
  const created = await invokeOrThrow<any>('events_create', { payload });
  return mapEventFromApi(created);
}

export async function updateEvent(event: UpdateEventRequest): Promise<Event> {
  if (!isTauriEnvironment()) {
    const now = new Date().toISOString();
    return {
      ...event,
      title: event.title || 'Untitled',
      id: event.id,
      start_time: event.start_time || now,
      end_time: event.end_time || now,
      created_at: now,
      updated_at: now,
    };
  }
  const payload = mapEventToApi(event);
  const updated = await invokeOrThrow<any>('events_update', { payload });
  return mapEventFromApi(updated);
}

export async function deleteEvent(id: number): Promise<void> {
  if (!isTauriEnvironment()) return;
  await invokeOrThrow<void>('events_delete', { id });
}

export async function listCategories(): Promise<Category[]> {
  if (!isTauriEnvironment()) return [];
  const categories = await invokeOrThrow<any[]>('categories_list');
  return categories.map(mapCategoryFromApi);
}

export async function createCategory(request: { name: string; color_hex: string; is_hidden?: boolean; sort_order?: number; }): Promise<Category> {
  if (!isTauriEnvironment()) {
    return {
      ...request,
      name: request.name || 'Untitled',
      id: fallbackId(),
      created_at: new Date().toISOString(),
      color: request.color_hex,
    };
  }
  const created = await invokeOrThrow<any>('categories_create', { payload: request });
  return mapCategoryFromApi(created);
}

export async function updateCategory(request: { id: number; name?: string; color_hex?: string; is_hidden?: boolean; sort_order?: number; }): Promise<Category> {
  if (!isTauriEnvironment()) {
    return {
      ...request,
      name: request.name ?? 'Untitled',
      created_at: new Date().toISOString(),
      color: request.color_hex ?? '#ffffff',
      color_hex: request.color_hex ?? '#ffffff',
    };
  }
  const updated = await invokeOrThrow<any>('categories_update', { payload: request });
  return mapCategoryFromApi(updated);
}

export async function deleteCategory(id: number): Promise<void> {
  if (!isTauriEnvironment()) return;
  await invokeOrThrow<void>('categories_delete', { id });
}

function mapRecurrenceFromApi(rec: any): Recurrence | null {
  if (!rec) return null;
  return {
    kind: rec.kind,
    interval: rec.interval,
    daysOfWeek: rec.days_of_week || rec.daysOfWeek,
  };
}

function mapTaskFromApi(task: any): Task {
  let priority: TaskPriority = 'normal';
  if (task.priority) {
    if (task.priority === 'medium') {
      priority = 'normal';
    } else if (['low', 'normal', 'high', 'urgent'].includes(task.priority)) {
      priority = task.priority as TaskPriority;
    }
  }

  return {
    id: task.id,
    title: task.title,
    done: task.done,
    date: task.date,
    priority,
    recurrence: mapRecurrenceFromApi(task.recurrence),
    estimatedMinutes: task.estimated_minutes ?? task.estimatedMinutes,
    isFocus: task.is_focus ?? task.isFocus ?? false,
    created_at: task.created_at,
  };
}

export async function listTasks(date?: string): Promise<Task[]> {
  if (!isTauriEnvironment()) return [];
  const parsedDate = date ? date.split('T')[0] : undefined;
  const tasks = await invokeOrThrow<any[]>('tasks_list', { date: parsedDate });
  return tasks.map(mapTaskFromApi);
}

export async function listTasksRange(startDate?: string, endDate?: string): Promise<Task[]> {
  if (!isTauriEnvironment()) return [];
  const start = startDate ? startDate.split('T')[0] : undefined;
  const end = endDate ? endDate.split('T')[0] : undefined;
  const tasks = await invokeOrThrow<any[]>('tasks_list_range', { start, end });
  return tasks.map(mapTaskFromApi);
}

export async function createTask(task: { title: string; date?: string | null; priority?: TaskPriority; recurrence?: Recurrence | null; estimatedMinutes?: number; isFocus?: boolean }): Promise<Task> {
  if (!isTauriEnvironment()) {
    return {
      id: fallbackId(),
      title: task.title,
      done: false,
      date: task.date ?? null,
      priority: task.priority ?? 'normal',
      recurrence: task.recurrence ?? null,
      estimatedMinutes: task.estimatedMinutes,
      isFocus: task.isFocus ?? false,
      created_at: new Date().toISOString(),
    };
  }
  const payload: any = {
    title: task.title,
    date: task.date ? task.date.split('T')[0] : null,
    priority: task.priority ?? 'normal',
    estimated_minutes: task.estimatedMinutes,
    is_focus: task.isFocus ?? false,
  };
  if (task.recurrence) {
    payload.recurrence = {
      kind: task.recurrence.kind,
      interval: task.recurrence.interval,
      days_of_week: task.recurrence.daysOfWeek,
    };
  }
  const result = await invokeOrThrow<any>('tasks_create', { payload });
  return mapTaskFromApi(result);
}

export async function updateTask(task: { id: number; title?: string; done?: boolean; date?: string | null; priority?: TaskPriority; recurrence?: Recurrence | null; estimatedMinutes?: number; isFocus?: boolean }): Promise<Task> {
  if (!isTauriEnvironment()) {
    return {
      id: task.id,
      title: task.title ?? 'Task',
      done: task.done ?? false,
      date: task.date ?? null,
      priority: task.priority ?? 'normal',
      isFocus: task.isFocus ?? false,
      recurrence: task.recurrence ?? null,
      estimatedMinutes: task.estimatedMinutes,
      created_at: new Date().toISOString(),
    };
  }
  const payload: Record<string, unknown> = { id: task.id };
  if (typeof task.title === 'string') payload.title = task.title;
  if (typeof task.done === 'boolean') payload.done = task.done;
  if (task.date !== undefined) payload.date = task.date ? task.date.split('T')[0] : null;
  if (task.priority !== undefined) payload.priority = task.priority;
  if (task.estimatedMinutes !== undefined) payload.estimated_minutes = task.estimatedMinutes;
  if (task.isFocus !== undefined) payload.is_focus = task.isFocus;
  if (task.recurrence !== undefined) {
    if (task.recurrence) {
      payload.recurrence = {
        kind: task.recurrence.kind,
        interval: task.recurrence.interval,
        days_of_week: task.recurrence.daysOfWeek,
      };
    } else {
      payload.recurrence = null;
    }
  }

  const result = await invokeOrThrow<any>('tasks_update', { payload });
  return mapTaskFromApi(result);
}

export interface ToggleTaskResponse {
  task: Task;
  nextTask: Task | null;
}

export async function toggleTaskDone(id: number, done?: boolean): Promise<ToggleTaskResponse> {
  if (!isTauriEnvironment()) {
    return {
      task: {
        id,
        title: 'Task',
        done: done ?? false,
        date: null,
        priority: 'normal' as const,
        isFocus: false,
        created_at: new Date().toISOString(),
      },
      nextTask: null,
    };
  }
  const response = await invokeOrThrow<{ task: any; next_task: any | null }>('tasks_toggle_done', { id, done });
  return {
    task: mapTaskFromApi(response.task),
    nextTask: response.next_task ? mapTaskFromApi(response.next_task) : null,
  };
}

export async function deleteTask(id: number): Promise<void> {
  if (!isTauriEnvironment()) return;
  await invokeOrThrow<void>('tasks_delete', { id });
}

export async function parseAndCreateTask(text: string): Promise<Task> {
  if (!isTauriEnvironment()) {
    const { parseTextToTask } = await import('./nlp/taskParser');
    const parsed = parseTextToTask(text);
    return createTask({
      title: parsed.title,
      date: parsed.date ? parsed.date.toISOString().split('T')[0] : null,
      priority: parsed.priority,
      recurrence: parsed.recurrence || null,
    });
  }
  const result = await invokeOrThrow<any>('task_parse_create', { text });
  return mapTaskFromApi(result);
}

export async function createPlannedBlock(request: CreatePlannedBlockRequest): Promise<PlannedBlockRecord> {
  if (!isTauriEnvironment()) {
    const id = fallbackId();
    const now = new Date().toISOString();
    const record: PlannedBlockRecord = {
      id,
      taskId: request.taskId ?? null,
      eventId: request.eventId ?? null,
      title: request.title,
      start: request.start,
      end: request.end,
      completed: request.completed ?? false,
      createdAt: now,
    };
    fallbackPlannedBlocks.set(id, record);
    return record;
  }
  const payload = mapPlannedBlockToApi(request);
  const record = await invokeOrThrow<any>('createPlannedBlock', { payload });
  return mapPlannedBlockFromApi(record);
}

export async function updatePlannedBlock(request: UpdatePlannedBlockRequest): Promise<PlannedBlockRecord> {
  if (!isTauriEnvironment()) {
    const existing = fallbackPlannedBlocks.get(request.id);
    if (!existing) {
      throw new Error(`Planned block ${request.id} not found`);
    }
    const updated: PlannedBlockRecord = {
      ...existing,
      taskId: request.taskId ?? existing.taskId,
      eventId: request.eventId ?? existing.eventId,
      title: request.title ?? existing.title,
      start: request.start ?? existing.start,
      end: request.end ?? existing.end,
      completed: request.completed ?? existing.completed,
    };
    fallbackPlannedBlocks.set(request.id, updated);
    return updated;
  }
  const payload = mapPlannedBlockToApi(request);
  const record = await invokeOrThrow<any>('updatePlannedBlock', { payload });
  return mapPlannedBlockFromApi(record);
}

export async function deletePlannedBlock(id: number): Promise<void> {
  if (!isTauriEnvironment()) {
    fallbackPlannedBlocks.delete(id);
    return;
  }
  await invokeOrThrow<void>('deletePlannedBlock', { id });
}

export async function listPlannedBlocksRange(startDate?: string, endDate?: string): Promise<PlannedBlockRecord[]> {
  if (!isTauriEnvironment()) {
    const start = startDate ? new Date(startDate) : null;
    const end = endDate ? new Date(endDate) : null;
    return Array.from(fallbackPlannedBlocks.values()).filter((block) => {
      const blockStart = new Date(block.start);
      const blockEnd = new Date(block.end);
      if (start && blockEnd < start) return false;
      if (end && blockStart > end) return false;
      return true;
    });
  }
  const blocks = await invokeOrThrow<any[]>('listPlannedBlocksRange', { start: startDate, end: endDate });
  return blocks.map(mapPlannedBlockFromApi);
}

function mapPomodoroFromApi(session: any): PomodoroSession {
  return {
    id: session.id,
    taskId: session.task_id,
    kind: session.kind,
    startedAt: session.started_at,
    endedAt: session.ended_at,
    durationMinutes: session.duration_minutes,
    completed: session.completed,
  };
}

export async function logPomodoroSession(
  payload: NewPomodoroSessionPayload
): Promise<PomodoroSession> {
  if (!isTauriEnvironment()) {
    return {
      id: fallbackId(),
      taskId: payload.taskId,
      kind: payload.kind,
      startedAt: payload.startedAt,
      endedAt: payload.endedAt,
      durationMinutes: payload.durationMinutes,
      completed: payload.completed,
    };
  }
  const apiPayload: any = {
    task_id: payload.taskId,
    kind: payload.kind,
    started_at: payload.startedAt,
    ended_at: payload.endedAt,
    duration_minutes: payload.durationMinutes,
    completed: payload.completed,
  };    
  const result = await invokeOrThrow<any>('pomodoro_log_session', { payload: apiPayload });
  return mapPomodoroFromApi(result);
}

export async function listPomodoroForDate(dateIso: string): Promise<PomodoroSession[]> {
  if (!isTauriEnvironment()) return [];
  const sessions = await invokeOrThrow<any[]>('pomodoro_list_for_date', { dateIso });
  return sessions.map(mapPomodoroFromApi);
}

export async function listPomodoroRange(startIso: string, endIso: string): Promise<PomodoroSession[]> {
  if (!isTauriEnvironment()) return [];
  const sessions = await invokeOrThrow<any[]>('pomodoro_list_range', { startIso, endIso });
  return sessions.map(mapPomodoroFromApi);
}

export async function createFocusSession(request: CreateFocusSessionRequest): Promise<FocusSessionRecord> {
  if (!isTauriEnvironment()) {
    const id = fallbackId();
    const record: FocusSessionRecord = {
      id,
      taskId: request.taskId ?? null,
      plannedBlockId: request.plannedBlockId ?? null,
      startedAt: request.startedAt,
      endedAt: request.endedAt ?? null,
      durationMinutes: request.durationMinutes ?? null,
    };
    fallbackFocusSessions.set(id, record);
    return record;
  }
  const payload = mapFocusSessionToApi(request);
  const record = await invokeOrThrow<any>('createFocusSession', { payload });
  return mapFocusSessionFromApi(record);
}

export async function completeFocusSession(request: CompleteFocusSessionRequest): Promise<FocusSessionRecord> {
  if (!isTauriEnvironment()) {
    const existing = fallbackFocusSessions.get(request.id);
    if (!existing) {
      throw new Error(`Focus session ${request.id} not found`);
    }
    const updated: FocusSessionRecord = {
      ...existing,
      endedAt: request.endedAt ?? existing.endedAt ?? new Date().toISOString(),
      durationMinutes: request.durationMinutes ?? existing.durationMinutes ?? null,
    };
    fallbackFocusSessions.set(request.id, updated);
    return updated;
  }
  const payload = mapFocusSessionToApi(request);
  const record = await invokeOrThrow<any>('completeFocusSession', { payload });
  return mapFocusSessionFromApi(record);
}

export async function listFocusSessionsRange(startIso?: string, endIso?: string): Promise<FocusSessionRecord[]> {
  if (!isTauriEnvironment()) {
    const start = startIso ? new Date(startIso) : null;
    const end = endIso ? new Date(endIso) : null;
    return Array.from(fallbackFocusSessions.values()).filter((session) => {
      const startedAt = new Date(session.startedAt);
      if (start && startedAt < start) return false;
      if (end && startedAt > end) return false;
      return true;
    });
  }
  const sessions = await invokeOrThrow<any[]>('listFocusSessionsRange', { start: startIso, end: endIso });
  return sessions.map(mapFocusSessionFromApi);
}

export async function getSettings(): Promise<AppSettings> {
  if (!isTauriEnvironment()) return defaultAppSettings;
  return await invokeOrThrow<AppSettings>('settings_get');
}

export async function saveSettings(settings: AppSettings): Promise<AppSettings> {
  if (!isTauriEnvironment()) return { ...defaultAppSettings, ...settings };
  return await invokeOrThrow<AppSettings>('settings_save', { settings });
}

export async function getAuthUrl(): Promise<{ url: string; state: string }> {
  if (!isTauriEnvironment()) return { url: '#', state: 'dev' };
  return await invokeOrThrow('gmail_get_auth_url');
}

export async function exchangeCode(code?: string, state?: string): Promise<boolean> {
  if (!isTauriEnvironment()) return true;
  await invokeOrThrow<TokenInfo>('gmail_exchange_code', { code, state });
  return true;
}

export async function syncGmail(performSync = true): Promise<GmailStatus> {
  if (!isTauriEnvironment()) return { connected: false, lastSync: null, email: null };
  return await invokeOrThrow<GmailStatus>('gmail_sync', { perform_sync: performSync });
}

export async function disconnectGmail(): Promise<void> {
  if (!isTauriEnvironment()) return;
  await invokeOrThrow('gmail_disconnect');
}

export async function gmailStatus(): Promise<GmailStatus> {
  if (!isTauriEnvironment()) return { connected: false, lastSync: null, email: null };
  return await syncGmail(false);
}

