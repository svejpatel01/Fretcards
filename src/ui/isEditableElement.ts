const EDITABLE_TAGS = new Set(['INPUT', 'SELECT', 'TEXTAREA', 'BUTTON'])

/** True when a keyboard shortcut would hijack normal interaction with a focused form control. */
export function isEditableElement(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && EDITABLE_TAGS.has(target.tagName)
}
