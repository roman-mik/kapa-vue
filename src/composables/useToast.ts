import { reactive } from 'vue';

export interface ToastMessage {
  id: number;
  text: string;
  tone: 'success' | 'error';
}

// Module-level (not per-component) state: any view can call toast() and
// have it render in the single <ToastHost> mounted once in App.vue.
const toasts = reactive<ToastMessage[]>([]);
let nextId = 0;
const DEFAULT_DURATION_MS = 3500;

function dismiss(id: number): void {
  const index = toasts.findIndex((t) => t.id === id);
  if (index !== -1) toasts.splice(index, 1);
}

function toast(text: string, tone: ToastMessage['tone'] = 'success'): void {
  const id = nextId++;
  toasts.push({ id, text, tone });
  setTimeout(() => dismiss(id), DEFAULT_DURATION_MS);
}

export function useToast() {
  return {
    toasts,
    toast,
    success: (text: string) => toast(text, 'success'),
    error: (text: string) => toast(text, 'error'),
    dismiss,
  };
}
