import { shallowMount } from '@vue/test-utils';
import { createPinia } from 'pinia';
import { describe, expect, it, vi } from 'vite-plus/test';
import { ref } from 'vue';
import SettingsView from './SettingsView.vue';

vi.mock('@/lib/supabase', () => ({ supabase: {} }));
vi.mock('@/composables/useInvite', () => ({
  useInvite: () => ({ invite: ref(null), busy: ref(false), error: ref(null), mint: vi.fn() }),
}));
vi.mock('@/composables/useInstallPrompt', () => ({
  useInstallPrompt: () => ({ canInstall: ref(false), installed: ref(false) }),
}));
vi.mock('@/composables/useNightMode', () => ({
  useNightMode: () => ({ enabled: ref(false), toggle: vi.fn() }),
}));
vi.mock('vue-router', () => ({ useRouter: () => ({ replace: vi.fn() }) }));

describe('Settings cap entry point', () => {
  it('always links to the existing monthly cap editor', () => {
    const wrapper = shallowMount(SettingsView, {
      global: {
        plugins: [createPinia()],
        renderStubDefaultSlot: true,
        stubs: { RouterLink: { props: ['to'], template: '<a :data-route="to.name"><slot /></a>' } },
      },
    });
    const link = wrapper.get('a[data-route="pocket-cap"]');
    expect(link.text()).toBe('Monthly cap');
  });
});
