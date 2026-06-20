/**
 * Platform detection utilities.
 * Used to show/hide UI elements based on the current OS.
 */

export const IS_LINUX = /Linux/.test(navigator.userAgent) && !/Android/.test(navigator.userAgent);
export const IS_MAC = /Mac|iPhone|iPad/.test(navigator.userAgent);
export const IS_WINDOWS = /Win/.test(navigator.userAgent);
