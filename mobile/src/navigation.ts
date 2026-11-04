export type ReturnState = { active: boolean; busy: boolean; dirty: boolean };
export type ExitPrompt = { leave: () => void; stay: () => void };
/** Share the main destination and unsaved-work protection across system and screen Back. */
export function createMainReturn(options: {
  state: () => ReturnState;
  confirm: (prompt: ExitPrompt) => void;
  returnToMain: () => void;
}) {
  let pending: ExitPrompt | null = null;
  const request = () => {
    const state = options.state();
    if (!state.active) return false;
    if (state.busy || pending) return true;
    if (!state.dirty) {
      options.returnToMain();
      return true;
    }
    const prompt: ExitPrompt = {
      leave: () => {
        if (pending !== prompt) return;
        pending = null;
        const latest = options.state();
        if (latest.active && !latest.busy) options.returnToMain();
      },
      stay: () => {
        if (pending === prompt) pending = null;
      },
    };
    pending = prompt;
    options.confirm(prompt);
    return true;
  };
  return {
    request,
    cancel: () => {
      pending = null;
    },
  };
}
