/**
 * Selection helper utilities for planner blocks
 */

export interface SelectionState {
  selectedIds: Set<string>;
  primaryId: string | null; // The "main" selected block (last clicked)
}

export function createSelectionState(): SelectionState {
  return {
    selectedIds: new Set(),
    primaryId: null,
  };
}

export function toggleSelection(
  state: SelectionState,
  id: string,
  isShiftClick: boolean
): SelectionState {
  if (isShiftClick) {
    // Multi-select: toggle this block
    const newSelectedIds = new Set(state.selectedIds);
    if (newSelectedIds.has(id)) {
      newSelectedIds.delete(id);
      return {
        selectedIds: newSelectedIds,
        primaryId: newSelectedIds.size > 0 ? (state.primaryId === id ? Array.from(newSelectedIds)[0] : state.primaryId) : null,
      };
    } else {
      newSelectedIds.add(id);
      return {
        selectedIds: newSelectedIds,
        primaryId: id,
      };
    }
  } else {
    // Single select: replace selection
    return {
      selectedIds: new Set([id]),
      primaryId: id,
    };
  }
}

export function clearSelection(): SelectionState {
  return {
    selectedIds: new Set(),
    primaryId: null,
  };
}

export function isSelected(state: SelectionState, id: string): boolean {
  return state.selectedIds.has(id);
}

export function getSelectedCount(state: SelectionState): number {
  return state.selectedIds.size;
}

