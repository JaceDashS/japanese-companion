/** Keep browser confirmation dialogs usable in the shared screens. */
export async function confirmAction(message: string) { return window.confirm(message); }
