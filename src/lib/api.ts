import { invoke } from '@tauri-apps/api/core';

export interface Event {
  id?: number;
  title: string;
  description?: string | null;
  start_time: string;
  end_time: string | null;
  category_id?: number | null;
  category?: Category | null;
  all_day?: number;
  created_at?: string;
  updated_at?: string;
}

export interface Category {
  id?: number;
  name: string;
  color: string;
  created_at?: string;
}

export interface CreateEventRequest {
  title: string;
  description?: string;
  start_time: string;
  end_time: string;
  category_id?: number;
  all_day: boolean;
}

export interface UpdateEventRequest {
  id: number;
  title?: string;
  description?: string;
  start_time?: string;
  end_time?: string;
  category_id?: number;
  all_day?: boolean;
}

// Events API
export async function getEvents(startDate?: string, endDate?: string): Promise<Event[]> {
  return await invoke<Event[]>('get_events', { start_date: startDate, end_date: endDate });
}

export async function createEvent(event: CreateEventRequest): Promise<Event> {
  return await invoke<Event>('create_event', { request: event });
}

export async function updateEvent(event: UpdateEventRequest): Promise<Event> {
  return await invoke<Event>('update_event', { request: event });
}

export async function deleteEvent(id: number): Promise<void> {
  return await invoke<void>('delete_event', { id });
}

// Categories API
export async function listCategories(): Promise<Category[]> {
  return await invoke<Category[]>('list_categories');
}

export async function createCategory(name: string, color?: string): Promise<Category> {
  return await invoke<Category>('create_category', { request: { name, color } });
}

