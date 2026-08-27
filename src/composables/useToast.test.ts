import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test';
import { useToast } from './useToast';

describe('useToast', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    // Toast state is module-level, shared across every useToast() call —
    // drain it after each test so runs don't leak into each other. dismiss()
    // splices `toasts` in place, so collect the ids before iterating rather
    // than mutating the array we're walking.
    const { toasts, dismiss } = useToast();
    const ids = toasts.map((t) => t.id);
    for (const id of ids) dismiss(id);
    vi.useRealTimers();
  });

  it('success() pushes a success-toned message', () => {
    const { toasts, success } = useToast();
    success('Saved');
    expect(toasts).toHaveLength(1);
    expect(toasts[0]).toMatchObject({ text: 'Saved', tone: 'success' });
  });

  it('error() pushes an error-toned message', () => {
    const { toasts, error } = useToast();
    error('Failed');
    expect(toasts[0]).toMatchObject({ text: 'Failed', tone: 'error' });
  });

  it('auto-dismisses after the default duration', () => {
    const { toasts, success } = useToast();
    success('Gone soon');
    expect(toasts).toHaveLength(1);
    vi.advanceTimersByTime(3500);
    expect(toasts).toHaveLength(0);
  });

  it('dismiss() removes a specific toast by id before its timer fires', () => {
    const { toasts, success, dismiss } = useToast();
    success('First');
    success('Second');
    expect(toasts).toHaveLength(2);
    dismiss(toasts[0].id);
    expect(toasts).toHaveLength(1);
    expect(toasts[0].text).toBe('Second');
  });
});
