import { useEffect, type KeyboardEvent, type RefObject } from "react";

const FOCUSABLE = '[role="menuitem"],[role="menuitemradio"]';

type UseMenuKeyboardArgs = {
  open: boolean;
  setOpen: (open: boolean) => void;
  /** Wrapper that contains the menu items (the existing component ref is fine). */
  menuRef: RefObject<HTMLElement | null>;
  /** The trigger button, so focus can return to it on close. */
  triggerRef: RefObject<HTMLElement | null>;
};

/**
 * Implements the WAI-ARIA menu-button keyboard contract shared by the header
 * dropdowns: focus the first item on open, roving Up/Down/Home/End, and Esc/Tab
 * to close while returning focus to the trigger. Attach the returned `onKeyDown`
 * to the menu panel element.
 */
export function useMenuKeyboard({ open, setOpen, menuRef, triggerRef }: UseMenuKeyboardArgs) {
  // Move focus into the menu when it opens so keyboard users land on an item.
  useEffect(() => {
    if (!open) return;
    const first = menuRef.current?.querySelector<HTMLElement>(FOCUSABLE);
    first?.focus();
  }, [open, menuRef]);

  function onKeyDown(event: KeyboardEvent) {
    const items = Array.from(menuRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? []);
    if (items.length === 0) return;
    const current = items.findIndex((el) => el === document.activeElement);
    const focusAt = (index: number) => items[(index + items.length) % items.length]?.focus();

    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        focusAt(current + 1);
        break;
      case "ArrowUp":
        event.preventDefault();
        focusAt(current - 1);
        break;
      case "Home":
        event.preventDefault();
        focusAt(0);
        break;
      case "End":
        event.preventDefault();
        focusAt(items.length - 1);
        break;
      case "Escape":
        event.preventDefault();
        setOpen(false);
        triggerRef.current?.focus();
        break;
      case "Tab":
        // Let focus leave naturally, but close the menu behind it.
        setOpen(false);
        break;
    }
  }

  return { onKeyDown };
}
