import { createRouter, createWebHistory } from 'vue-router';
import { useSessionStore } from '@/stores/session';
import { useSpaceStore } from '@/stores/space';

// Lazy per-route chunks: a session only ever needs one or two of these
// screens per visit, and none of them need to be in the initial bundle
// that has to parse before login even renders.
const LoginView = () => import('@/views/LoginView.vue');
const SpaceView = () => import('@/views/SpaceView.vue');
const SettingsView = () => import('@/views/SettingsView.vue');
const NotFoundView = () => import('@/views/NotFoundView.vue');
const PocketHomeView = () => import('@/views/pocket/PocketHomeView.vue');
const CapView = () => import('@/views/pocket/CapView.vue');
const CategoriesView = () => import('@/views/pocket/CategoriesView.vue');
const AddExpenseView = () => import('@/views/pocket/AddExpenseView.vue');
const EditExpenseView = () => import('@/views/pocket/EditExpenseView.vue');
const HistoryView = () => import('@/views/pocket/HistoryView.vue');

declare module 'vue-router' {
  interface RouteMeta {
    // Whether App.vue renders the space/theme/sign-out header — off for
    // /login and /spaces, on for every Pocket screen.
    showHeader?: boolean;
  }
}

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/login', name: 'login', component: LoginView },
    { path: '/spaces', name: 'spaces', component: SpaceView },
    { path: '/', name: 'home', component: PocketHomeView, meta: { showHeader: true } },
    { path: '/pocket/cap', name: 'pocket-cap', component: CapView, meta: { showHeader: true } },
    {
      path: '/pocket/categories',
      name: 'pocket-categories',
      component: CategoriesView,
      meta: { showHeader: true },
    },
    {
      path: '/pocket/add',
      name: 'pocket-add',
      component: AddExpenseView,
      meta: { showHeader: true },
    },
    {
      path: '/pocket/history',
      name: 'pocket-history',
      component: HistoryView,
      meta: { showHeader: true },
    },
    {
      path: '/pocket/edit/:id',
      name: 'pocket-edit',
      component: EditExpenseView,
      meta: { showHeader: true },
    },
    {
      path: '/settings',
      name: 'settings',
      component: SettingsView,
      meta: { showHeader: true },
    },
    { path: '/:pathMatch(.*)*', name: 'not-found', component: NotFoundView },
  ],
});

// Kapa has no self-signup — password auth against an allowlist table — so
// this only ever redirects to /login, never to a register screen. By the
// time the router starts navigating, main.ts has already awaited
// sessionStore.init(), so session.user reflects the restored session (or
// its absence) rather than an in-flight unknown.
router.beforeEach(async (to) => {
  const session = useSessionStore();
  const authenticated = session.user !== null;

  if (to.name !== 'login' && !authenticated) {
    return { name: 'login', query: { redirect: to.fullPath } };
  }
  if (to.name === 'login' && authenticated) {
    return { name: 'home' };
  }

  // Every Pocket query is space-scoped, so a space must be selected before
  // any other authenticated screen renders. Initialized here (rather than
  // eagerly in main.ts) so it re-runs after a fresh login too, not just on
  // startup — `ready` makes repeat navigations a no-op.
  if (authenticated) {
    const space = useSpaceStore();
    if (!space.ready) await space.init();
    if (to.name !== 'spaces' && !space.currentSpaceId) {
      return { name: 'spaces', query: { redirect: to.fullPath } };
    }
  }
});

export default router;
