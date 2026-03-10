import { derived, writable } from 'svelte/store';
import {
  listCategories,
  createCategory as apiCreateCategory,
  updateCategory as apiUpdateCategory,
  deleteCategory as apiDeleteCategory,
  type Category,
} from '../lib/api';
import { toastStore } from './toastStore';

function createCategoryStore() {
  const { subscribe, set, update } = writable<Category[]>([]);
  const visibility = writable<Set<number>>(new Set());

  const loadCategories = async () => {
    try {
      const data = await listCategories();
      set(data);
    } catch (err) {
      console.error('Failed to load categories', err);
      toastStore.showError('Could not load categories');
      set([]);
    }
  };

  const createCategory = async (name: string, color_hex: string): Promise<Category | null> => {
    try {
      const created = await apiCreateCategory({ name, color_hex });
      update((current) => [...current, created]);
      visibility.update((vis) => {
        const next = new Set(vis);
        if (created.id != null) next.delete(created.id);
        return next;
      });
      toastStore.showSuccess('Category created');
      return created;
    } catch (err) {
      console.error('Failed to create category', err);
      toastStore.showError('Could not create category');
      return null;
    }
  };

  const updateCategory = async (id: number, name: string, color_hex: string): Promise<Category | null> => {
    try {
      const updated = await apiUpdateCategory({ id, name, color_hex });
      update((current) => current.map((c) => (c.id === id ? updated : c)));
      toastStore.showSuccess('Category updated');
      return updated;
    } catch (err) {
      console.error('Failed to update category', err);
      toastStore.showError('Could not update category');
      return null;
    }
  };

  const deleteCategory = async (id: number) => {
    try {
      await apiDeleteCategory(id);
      update((current) => current.filter((c) => c.id !== id));
      visibility.update((vis) => {
        const next = new Set(vis);
        next.delete(id);
        return next;
      });
      toastStore.showSuccess('Category deleted');
    } catch (err) {
      console.error('Failed to delete category', err);
      toastStore.showError('Could not delete category');
      return;
    }
  };

  const toggleCategoryVisibility = (id: number) => {
    visibility.update((vis) => {
      const next = new Set(vis);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const hiddenCategoryIds = derived(visibility, (vis) => vis);

  const visibleCategories = derived([hiddenCategoryIds, { subscribe }], ([$hidden, $cats]) =>
    $cats.filter((cat) => !(cat.id && $hidden.has(cat.id)))
  );

  return {
    subscribe,
    loadCategories,
    createCategory,
    updateCategory,
    deleteCategory,
    toggleCategoryVisibility,
    hiddenCategoryIds,
    visibleCategories,
  };
}

export const categoryStore = createCategoryStore();
export const hiddenCategoryIds = categoryStore.hiddenCategoryIds;
export const visibleCategories = categoryStore.visibleCategories;
