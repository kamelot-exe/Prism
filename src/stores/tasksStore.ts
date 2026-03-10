import { writable, derived, get } from 'svelte/store';
import type { Task, Recurrence } from '../lib/api';
import { listTasks, createTask, updateTask, deleteTask, toggleTaskDone, parseAndCreateTask } from '../lib/api';
import { toastStore } from './toastStore';

function normalizedDate(date: Date | string | null | undefined): string | null {
  if (!date) return null;
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toISOString().slice(0, 10);
}

// Priority order: urgent=0, high=1, normal=2, low=3
const priorityOrder: Record<string, number> = { urgent: 0, high: 1, normal: 2, low: 3 };

// Sort tasks by priority, then by date
function sortTasksByPriority(tasks: Task[]): Task[] {
  return [...tasks].sort((a, b) => {
    const priorityA = priorityOrder[a.priority ?? 'normal'] ?? 2;
    const priorityB = priorityOrder[b.priority ?? 'normal'] ?? 2;
    
    // First sort by priority
    if (priorityA !== priorityB) {
      return priorityA - priorityB;
    }
    
    // Then sort by date (earlier dates first)
    const dateA = a.date ? new Date(a.date).getTime() : 0;
    const dateB = b.date ? new Date(b.date).getTime() : 0;
    return dateA - dateB;
  });
}

function createTasksStore() {
  const { subscribe, set, update } = writable<Task[]>([]);
  const selectedDate = writable<string | null>(normalizedDate(new Date()));

  const loadAll = async () => {
    try {
      const tasks = await listTasks();
      set(sortTasksByPriority(tasks));
    } catch (err) {
      console.error('Failed to load tasks', err);
      toastStore.showError('Could not load tasks');
      set([]);
    }
  };

  const loadTasksForDate = async (date: Date | string) => {
    const dateStr = normalizedDate(date);
    selectedDate.set(dateStr);
    if (!dateStr) {
      await loadAll();
      return;
    }
    try {
      const tasks = await listTasks(dateStr);
      update((current) => {
        const other = current.filter((t) => normalizedDate(t.date) !== dateStr);
        return sortTasksByPriority([...other, ...tasks]);
      });
    } catch (err) {
      console.error('Failed to load tasks', err);
      toastStore.showError('Could not load tasks');
    }
  };

  const create = async (title: string, date: Date | null, priority: 'low' | 'normal' | 'high' | 'urgent' = 'normal', isFocus: boolean = false, recurrence: Recurrence | null = null): Promise<Task | null> => {
    try {
      const task = await createTask({ title, date: normalizedDate(date), priority, isFocus, recurrence });
      update((current) => sortTasksByPriority([...current, task]));
      toastStore.showSuccess('Task added');
      return task;
    } catch (err) {
      console.error('Failed to create task', err);
      toastStore.showError('Could not add task');
      return null;
    }
  };

  const tasksForDate = (date: Date | string): Task[] => {
    const dateStr = normalizedDate(date);
    const allTasks = get({ subscribe });
    return allTasks.filter((t) => normalizedDate(t.date) === dateStr);
  };

  const focusTasksForDate = (date: Date | string): Task[] => {
    return tasksForDate(date).filter((t) => t.isFocus);
  };

  const toggle = async (id: number, done: boolean): Promise<Task | null> => {
    try {
      const response = await toggleTaskDone(id, done);
      update((current) => {
        // Update the toggled task
        let updated = current.map((t) => (t.id === id ? response.task : t));
        // Add the new task if one was generated from recurrence
        if (response.nextTask) {
          updated.push(response.nextTask);
        }
        return sortTasksByPriority(updated);
      });
      return response.task;
    } catch (err) {
      console.error('Failed to update task', err);
      toastStore.showError('Could not update task');
      return null;
    }
  };

  const remove = async (id: number) => {
    try {
      await deleteTask(id);
      update((current) => current.filter((t) => t.id !== id));
      toastStore.showSuccess('Task deleted');
    } catch (err) {
      console.error('Failed to delete task', err);
      toastStore.showError('Could not delete task');
      return;
    }
  };

  const updateTaskInStore = async (taskId: number, updates: { title?: string; done?: boolean; date?: string | null; priority?: 'low' | 'normal' | 'high' | 'urgent'; recurrence?: Recurrence | null; estimatedMinutes?: number; isFocus?: boolean }) => {
    try {
      const updated = await updateTask({ id: taskId, ...updates });
      update((current) => {
        const index = current.findIndex((t) => t.id === taskId);
        if (index >= 0) {
          const updatedList = [...current];
          updatedList[index] = updated;
          return sortTasksByPriority(updatedList);
        }
        return current;
      });
      toastStore.showSuccess('Task updated');
      return updated;
    } catch (err) {
      console.error('Failed to update task', err);
      toastStore.showError('Could not update task');
      throw err;
    }
  };

  const tasksForSelectedDate = derived([selectedDate, { subscribe }], ([$date, $tasks]) =>
    sortTasksByPriority($tasks.filter((t) => normalizedDate(t.date) === $date))
  );

  const completedCount = derived(tasksForSelectedDate, (tasks) => tasks.filter((t) => t.done).length);
  const remainingCount = derived(tasksForSelectedDate, (tasks) => tasks.filter((t) => !t.done).length);

  const quickAdd = async (text: string) => {
    try {
      const task = await parseAndCreateTask(text);
      update((current) => sortTasksByPriority([...current, task]));
      toastStore.showSuccess('Task added');
      return task;
    } catch (err) {
      console.error('Failed to quick add task', err);
      toastStore.showError('Could not add task');
      throw err;
    }
  };

  return {
    subscribe,
    update,
    loadAll,
    loadTasksForDate,
    create,
    toggle,
    delete: remove,
    updateTask: updateTaskInStore,
    quickAdd,
    selectedDate,
    tasksForSelectedDate,
    completedCount,
    remainingCount,
    tasksForDate,
    focusTasksForDate,
  };
}

export const tasksStore = createTasksStore();
