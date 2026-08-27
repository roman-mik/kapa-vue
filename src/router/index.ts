import { createRouter, createWebHistory } from "vue-router";
import { useSessionStore } from "@/stores/session";
import { useSpaceStore } from "@/stores/space";
import LoginView from "@/views/LoginView.vue";
import SpaceView from "@/views/SpaceView.vue";
import PocketHomeView from "@/views/pocket/PocketHomeView.vue";

declare module "vue-router" {
  interface RouteMeta {
    // Whether App.vue renders the space/theme/sign-out header — off for
    // /login and /spaces, on for every Pocket screen.
    showHeader?: boolean;
  }
}

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: "/login", name: "login", component: LoginView },
    { path: "/spaces", name: "spaces", component: SpaceView },
    { path: "/", name: "home", component: PocketHomeView, meta: { showHeader: true } },
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

  if (to.name !== "login" && !authenticated) {
    return { name: "login", query: { redirect: to.fullPath } };
  }
  if (to.name === "login" && authenticated) {
    return { name: "home" };
  }

  // Every Pocket query is space-scoped, so a space must be selected before
  // any other authenticated screen renders. Initialized here (rather than
  // eagerly in main.ts) so it re-runs after a fresh login too, not just on
  // startup — `ready` makes repeat navigations a no-op.
  if (authenticated) {
    const space = useSpaceStore();
    if (!space.ready) await space.init();
    if (to.name !== "spaces" && !space.currentSpaceId) {
      return { name: "spaces", query: { redirect: to.fullPath } };
    }
  }
});

export default router;
