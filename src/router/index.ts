import { createRouter, createWebHistory } from 'vue-router';
import { useSessionStore } from '@/stores/session';
import { useSpaceStore } from '@/stores/space';

// Lazy per-route chunks: a session only ever needs one or two of these
// screens per visit, and none of them need to be in the initial bundle
// that has to parse before login even renders.
const LandingView = () => import('@/views/LandingView.vue');
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
const HorizonLayout = () => import('@/views/horizon/HorizonLayout.vue');
const TodayView = () => import('@/views/horizon/TodayView.vue');
const AccountsView = () => import('@/views/horizon/AccountsView.vue');
const TimelineView = () => import('@/views/horizon/TimelineView.vue');
const MoneyView = () => import('@/views/horizon/MoneyView.vue');
const HorizonSettingsView = () => import('@/views/horizon/HorizonSettingsView.vue');

declare module 'vue-router' {
  interface RouteMeta {
    // Whether App.vue renders the space/theme/sign-out header — off for
    // /login and /spaces, on for every Pocket screen.
    showHeader?: boolean;
    // Reachable without a session — only the public landing page. Checked
    // ahead of the auth redirect in beforeEach below.
    public?: boolean;
  }
}

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', name: 'landing', component: LandingView, meta: { public: true } },
    { path: '/login', name: 'login', component: LoginView },
    { path: '/spaces', name: 'spaces', component: SpaceView },
    { path: '/pocket', name: 'home', component: PocketHomeView, meta: { showHeader: true } },
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
    {
      // Horizon is its own app: no Pocket header/tab bar (no showHeader).
      // The layout renders the app switcher and the mobile/desktop gate.
      path: '/horizon',
      component: HorizonLayout,
      children: [
        { path: '', name: 'horizon-today', component: TodayView },
        { path: 'accounts', name: 'horizon-accounts', component: AccountsView },
        { path: 'timeline', name: 'horizon-timeline', component: TimelineView },
        { path: 'money-in', name: 'horizon-money-in', component: MoneyView },
        { path: 'money-out', name: 'horizon-money-out', component: MoneyView },
        { path: 'money', name: 'horizon-money', component: MoneyView },
        { path: 'settings', name: 'horizon-settings', component: HorizonSettingsView },
      ],
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

  // The landing page is the public face of the project — reachable signed
  // out, but a signed-in visitor should land on their actual app, not the
  // marketing page.
  if (to.name === 'landing') {
    return authenticated ? { name: 'home' } : true;
  }

  if (to.name !== 'login' && !to.meta.public && !authenticated) {
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
