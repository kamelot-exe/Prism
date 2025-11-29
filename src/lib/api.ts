import { invoke } from '@tauri-apps/api/core';

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

export interface Task {
  id?: number;
  title: string;
  done?: boolean;
  date?: string | null;
  created_at?: string;
}

export interface Setting {
  key: string;
  value: string;
}

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
  return base;
}

function mapCategoryFromApi(c: any): Category {
  return { ...c, color: c.color_hex };
}

// Events API
export async function getEvents(startDate?: string, endDate?: string): Promise<Event[]> {
  const events = await invoke<any[]>('events_list', { start: startDate, end: endDate });
  return events.map(mapEventFromApi);
}

export async function createEvent(event: CreateEventRequest): Promise<Event> {
  const payload = mapEventToApi(event);
  const created = await invoke<any>('events_create', { payload });
  return mapEventFromApi(created);
}

export async function updateEvent(event: UpdateEventRequest): Promise<Event> {
  const payload = mapEventToApi(event);
  const updated = await invoke<any>('events_update', { payload });
  return mapEventFromApi(updated);
}

export async function deleteEvent(id: number): Promise<void> {
  await invoke<void>('events_delete', { id });
}

// Categories API
export async function listCategories(): Promise<Category[]> {
  const categories = await invoke<any[]>('categories_list');
  return categories.map(mapCategoryFromApi);
}

export async function createCategory(request: { name: string; color_hex: string; is_hidden?: boolean; sort_order?: number; }): Promise<Category> {
  const created = await invoke<any>('categories_create', { payload: request });
  return mapCategoryFromApi(created);
}

export async function updateCategory(request: { id: number; name?: string; color_hex?: string; is_hidden?: boolean; sort_order?: number; }): Promise<Category> {
  const updated = await invoke<any>('categories_update', { payload: request });
  return mapCategoryFromApi(updated);
}

export async function deleteCategory(id: number): Promise<void> {
  await invoke<void>('categories_delete', { id });
}

// Tasks API
export async function listTasks(date?: string): Promise<Task[]> {
  const parsedDate = date ? date.split('T')[0] : undefined;
  return await invoke<Task[]>('tasks_list', { date: parsedDate });
}

export async function createTask(task: { title: string; date?: string | null }): Promise<Task> {
  return await invoke<Task>('tasks_create', { payload: task });
}

export async function updateTask(task: { id: number; title?: string; done?: boolean; date?: string | null }): Promise<Task> {
  return await invoke<Task>('tasks_update', { payload: task });
}

export async function deleteTask(id: number): Promise<void> {
  await invoke<void>('tasks_delete', { id });
}

// Settings API
export async function listSettings(): Promise<Setting[]> {
  return await invoke<Setting[]>('settings_list');
}

export async function saveSetting(key: string, value: string): Promise<Setting> {
  return await invoke<Setting>('settings_put', { key, value });
}

// Gmail sync
export async function getAuthUrl(): Promise<{ url: string; state: string }> {
  return await invoke('gmail_get_auth_url');
}

export async function waitForCallback(): Promise<string> {
  return await invoke('gmail_wait_for_callback');
}

export async function exchangeCode(code: string, state: string): Promise<boolean> {
  return await invoke('gmail_exchange_code', { code, state });
}

export async function syncGmail(): Promise<void> {
  await invoke('sync_gmail');
}

export async function disconnectGmail(): Promise<void> {
  await invoke('gmail_disconnect');
}
