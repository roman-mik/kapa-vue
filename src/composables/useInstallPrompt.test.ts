import { effectScope } from 'vue';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test';
import { useInstallPrompt } from './useInstallPrompt';

function fakeBeforeInstallPromptEvent() {
  const event = new Event('beforeinstallprompt') as Event & {
    prompt: () => Promise<void>;
    userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
  };
  event.prompt = vi.fn().mockResolvedValue(undefined);
  event.userChoice = Promise.resolve({ outcome: 'accepted' });
  return event;
}

describe('useInstallPrompt', () => {
  let scope: ReturnType<typeof effectScope>;

  beforeEach(() => {
    scope = effectScope();
  });

  afterEach(() => {
    scope.stop();
  });

  it('starts with nothing installable', () => {
    const { canInstall, installed } = scope.run(() => useInstallPrompt())!;
    expect(canInstall.value).toBe(false);
    expect(installed.value).toBe(false);
  });

  it('becomes installable after beforeinstallprompt fires, and prevents the default mini-infobar', () => {
    const { canInstall } = scope.run(() => useInstallPrompt())!;
    const event = fakeBeforeInstallPromptEvent();
    const preventDefault = vi.spyOn(event, 'preventDefault');

    window.dispatchEvent(event);

    expect(preventDefault).toHaveBeenCalled();
    expect(canInstall.value).toBe(true);
  });

  it('promptInstall() calls the captured event and clears canInstall after the choice resolves', async () => {
    const { canInstall, promptInstall } = scope.run(() => useInstallPrompt())!;
    const event = fakeBeforeInstallPromptEvent();
    window.dispatchEvent(event);

    await promptInstall();

    expect(event.prompt).toHaveBeenCalled();
    expect(canInstall.value).toBe(false);
  });

  it('appinstalled marks installed and clears canInstall', () => {
    const { canInstall, installed } = scope.run(() => useInstallPrompt())!;
    window.dispatchEvent(fakeBeforeInstallPromptEvent());
    window.dispatchEvent(new Event('appinstalled'));

    expect(installed.value).toBe(true);
    expect(canInstall.value).toBe(false);
  });
});
