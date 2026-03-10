export interface KeyboardShortcut {
  key: string;
  ctrl?: boolean;
  meta?: boolean;
  shift?: boolean;
  alt?: boolean;
  preventDefault?: boolean;
  description?: string;
}

export function matchesShortcut(e: KeyboardEvent, shortcut: KeyboardShortcut): boolean {
  if (shortcut.key.toLowerCase() !== e.key.toLowerCase()) {
    return false;
  }
  
  const ctrlMatch = shortcut.ctrl === undefined ? true : (e.ctrlKey === shortcut.ctrl);
  const metaMatch = shortcut.meta === undefined ? true : (e.metaKey === shortcut.meta);
  const shiftMatch = shortcut.shift === undefined ? true : (e.shiftKey === shortcut.shift);
  const altMatch = shortcut.alt === undefined ? true : (e.altKey === shortcut.alt);
  
  // For Cmd/Ctrl shortcuts, either ctrl or meta should match
  if (shortcut.ctrl || shortcut.meta) {
    const cmdOrCtrl = !!(shortcut.ctrl && e.ctrlKey) || !!(shortcut.meta && e.metaKey);
    return cmdOrCtrl && shiftMatch && altMatch && !(shortcut.ctrl && e.metaKey) && !(shortcut.meta && e.ctrlKey);
  }
  
  return ctrlMatch && metaMatch && shiftMatch && altMatch;
}

export function createShortcutHandler(
  shortcuts: Array<{ shortcut: KeyboardShortcut; handler: (e: KeyboardEvent) => void }>
) {
  return (e: KeyboardEvent) => {
    for (const { shortcut, handler } of shortcuts) {
      if (matchesShortcut(e, shortcut)) {
        if (shortcut.preventDefault !== false) {
          e.preventDefault();
        }
        handler(e);
        return;
      }
    }
  };
}

