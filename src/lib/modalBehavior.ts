export interface ModalBehaviorOptions {
  enabled: boolean;
  onClose?: () => void;
  initialFocus?: () => HTMLElement | null;
  restoreFocus?: boolean;
}

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

function getFocusableElements(node: HTMLElement): HTMLElement[] {
  return Array.from(node.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter((element) => {
    if (element.hasAttribute('disabled')) return false;
    if (element.getAttribute('aria-hidden') === 'true') return false;
    return element.offsetParent !== null || element === document.activeElement;
  });
}

export function modalBehavior(node: HTMLElement, options: ModalBehaviorOptions) {
  let currentOptions = options;
  let previousActiveElement: HTMLElement | null = null;

  function restoreFocus() {
    if (currentOptions.restoreFocus === false) return;
    if (!previousActiveElement) return;
    if (!document.contains(previousActiveElement)) return;
    previousActiveElement.focus();
    previousActiveElement = null;
  }

  function focusInitialElement() {
    previousActiveElement = document.activeElement instanceof HTMLElement ? document.activeElement : null;

    setTimeout(() => {
      const target = currentOptions.initialFocus?.() ?? getFocusableElements(node)[0] ?? node;
      target.focus();
    }, 0);
  }

  function trapFocus(event: KeyboardEvent) {
    if (!currentOptions.enabled) return;

    if (event.key === 'Escape') {
      event.preventDefault();
      currentOptions.onClose?.();
      return;
    }

    if (event.key !== 'Tab') return;

    const focusable = getFocusableElements(node);
    if (focusable.length === 0) {
      event.preventDefault();
      node.focus();
      return;
    }

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const activeElement = document.activeElement as HTMLElement | null;

    if (event.shiftKey && activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  node.addEventListener('keydown', trapFocus, true);

  if (currentOptions.enabled) {
    focusInitialElement();
  }

  return {
    update(nextOptions: ModalBehaviorOptions) {
      const wasEnabled = currentOptions.enabled;
      currentOptions = nextOptions;

      if (!wasEnabled && currentOptions.enabled) {
        focusInitialElement();
      } else if (wasEnabled && !currentOptions.enabled) {
        restoreFocus();
      }
    },
    destroy() {
      node.removeEventListener('keydown', trapFocus, true);
      if (currentOptions.enabled) {
        restoreFocus();
      }
    },
  };
}
