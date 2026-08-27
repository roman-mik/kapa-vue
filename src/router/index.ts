import { createRouter, createWebHistory } from "vue-router";
import { useSessionStore } from "@/stores/session";
import HomeView from "@/views/HomeView.vue";
import LoginView from "@/views/LoginView.vue";

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: "/login", name: "login", component: LoginView },
    { path: "/", name: "home", component: HomeView },
  ],
});

// Kapa has no self-signup — password auth against an allowlist table — so
// this only ever redirects to /login, never to a register screen. By the
// time the router starts navigating, main.ts has already awaited
// sessionStore.init(), so session.user reflects the restored session (or
// its absence) rather than an in-flight unknown.
router.beforeEach((to) => {
  const session = useSessionStore();
  const authenticated = session.user !== null;

  if (to.name !== "login" && !authenticated) {
    return { name: "login", query: { redirect: to.fullPath } };
  }
  if (to.name === "login" && authenticated) {
    return { name: "home" };
  }
});

export default router;
