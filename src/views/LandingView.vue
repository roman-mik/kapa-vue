<script setup lang="ts">
// Public logged-out homepage — the showcase for the whole project. `/` moved
// here (task 2); the signed-in app lives at `/pocket`. See
// docs/kapa-vue/plans/2026-08-30-landing-page.md for the full design brief.
import { onMounted, onUnmounted } from 'vue';
import '@fontsource/ibm-plex-mono/latin-400.css';
import '@fontsource/ibm-plex-mono/latin-500.css';
import '@/styles/landing.css';
import PocketDemo from '@/components/landing/PocketDemo.vue';
import MoneyLine from '@/components/landing/MoneyLine.vue';
import HorizonLedger from '@/components/landing/HorizonLedger.vue';
import { horizonProjection } from '@/lib/landing/horizonDemo';

const REPO_URL = 'https://github.com/roman-mik/kapa-vue';

// A fixed base date — not "today" — so the fixture (and the copy quoting
// its exact numbers below) never drifts out from under the deployed page.
const projection = horizonProjection(new Date(Date.UTC(2026, 0, 1)));
const ledgerMonth = '2026-01'; // the fixture's one crunch month

const RULES = [
  {
    id: 'D1',
    rule: 'Never spread a monthly total evenly across the month.',
    failure: 'Clustering bills on one assumed date produced a phantom crisis six weeks out.',
  },
  {
    id: 'D2',
    rule: 'Compute the intra-month minimum, not just the month-end balance.',
    failure:
      'A projection showed a healthy month end while the balance sat negative for two days mid-month.',
  },
  {
    id: 'D4',
    rule: 'A payment date and the period it covers are separate fields.',
    failure:
      'Rent paid on the 28th covers the following month — treating the two as one date was wrong twice.',
  },
  {
    id: 'D7',
    rule: 'Recurring vs. one-off is stored on every payment, never inferred.',
    failure: 'A one-off bonus mistaken for recurring overstated the annual position by 1.5M.',
  },
  {
    id: 'D11',
    rule: 'FX rates are dated snapshots, never live-fetched at render time.',
    failure:
      'Two runs of the same projection must produce identical numbers — a live rate breaks that.',
  },
  {
    id: 'D15',
    rule: 'Source amounts stay in their native currency; conversion happens at display time.',
    failure:
      'Rewriting an amount into another currency on the way in makes the original figure unrecoverable.',
  },
];

const BUILT_LIKE_THIS = [
  'Row-level security enforced at the database, not just the app layer.',
  'pgTAP tests plus integration tests run through a real per-user JWT, so RLS is verified, not assumed.',
  'Generated Supabase types diffed in CI — a migration without regenerated types fails the build.',
  'One shared @roman-mik/kapa-core package backs both Vue and (eventually) other frontends.',
  'Money stored as minor-unit integers everywhere; rounding happens only at display.',
  'Offline-capable PWA with an installable app shell.',
];

onMounted(() => {
  document.documentElement.setAttribute('data-landing', '');
});
onUnmounted(() => {
  document.documentElement.removeAttribute('data-landing');
});
</script>

<template>
  <div class="landing">
    <header class="bar">
      <span class="wordmark l-mono">kapa</span>
      <span class="bar-products l-mono">pocket · horizon</span>
    </header>

    <main>
      <section class="hero">
        <p class="eyebrow l-mono">Kapa · two household money apps</p>
        <h1 class="headline">
          <span class="line ember">What's left this month.</span>
          <span class="line signal">When it gets tight.</span>
        </h1>
        <p class="lede">
          Pocket answers the first question with a live spending cap. Horizon is built to answer the
          second — a day-by-day cashflow projection, specified in full and demoed here with a
          deterministic fixture while the engine itself gets built.
        </p>

        <MoneyLine :projection="projection" class="hero-chart" />

        <div class="cta-row">
          <router-link :to="{ name: 'login' }" class="cta primary">Sign in</router-link>
          <a :href="REPO_URL" target="_blank" rel="noopener" class="cta ghost">View source</a>
        </div>
      </section>

      <section class="split">
        <h2 class="section-title">Two questions</h2>
        <div class="split-grid">
          <div class="split-col">
            <div class="col-head">
              <span class="col-name">Pocket</span>
              <span class="col-status shipped l-mono">Shipped</span>
            </div>
            <p class="col-desc">
              A monthly spending cap, one tap per expense, always know what's left. The panel below
              runs the same functions the real app runs.
            </p>
            <PocketDemo />
          </div>
          <div class="split-col">
            <div class="col-head">
              <span class="col-name signal-text">Horizon</span>
              <span class="col-status in-design l-mono">In design</span>
            </div>
            <p class="col-desc">
              A day-by-day cashflow projection across accounts, currencies and pay schedules. Fully
              specified; the engine isn't built yet — this ledger is a deterministic fixture
              standing in for it.
            </p>
            <HorizonLedger :projection="projection" :month="ledgerMonth" />
          </div>
        </div>
      </section>

      <section class="rules">
        <h2 class="section-title">Rules that don't bend</h2>
        <p class="section-lede">
          Horizon's domain rules, by their real IDs from the spec — each exists because getting it
          wrong produced a materially wrong answer during manual analysis.
        </p>
        <ul class="rule-list">
          <li v-for="rule in RULES" :key="rule.id" class="rule">
            <span class="rule-id l-mono">{{ rule.id }}</span>
            <div class="rule-body">
              <p class="rule-text">{{ rule.rule }}</p>
              <p class="rule-failure">{{ rule.failure }}</p>
            </div>
          </li>
        </ul>
      </section>

      <section class="built">
        <h2 class="section-title">Built like this</h2>
        <ul class="built-list">
          <li v-for="item in BUILT_LIKE_THIS" :key="item">{{ item }}</li>
        </ul>
      </section>
    </main>

    <footer class="footer">
      <p>
        Kapa is invite-only — there's no public sign-up.
        <a :href="REPO_URL" target="_blank" rel="noopener">Source</a> ·
        <router-link :to="{ name: 'login' }">Sign in</router-link>
      </p>
    </footer>
  </div>
</template>

<style scoped>
.landing {
  display: flex;
  flex-direction: column;
}

.bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px clamp(20px, 5vw, 64px);
  border-bottom: 1px solid var(--l-line);
}

.wordmark {
  font-size: 14px;
  letter-spacing: 0.04em;
  color: var(--l-ink);
}

.bar-products {
  font-size: 12px;
  color: var(--l-haze);
}

main {
  display: flex;
  flex-direction: column;
}

.hero {
  padding: clamp(48px, 8vw, 96px) clamp(20px, 5vw, 64px) clamp(56px, 8vw, 88px);
  display: flex;
  flex-direction: column;
  gap: 24px;
  max-width: 880px;
}

.eyebrow {
  font-size: 12px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--l-haze);
  margin: 0;
}

.headline {
  font-size: clamp(40px, 7.5vw, 96px);
  line-height: 0.94;
  letter-spacing: -0.02em;
  margin: 0;
}

.headline .line {
  display: block;
}

.headline .ember {
  color: var(--l-ember);
}

.headline .signal {
  color: var(--l-signal);
}

.lede {
  font-size: 17px;
  line-height: 1.65;
  max-width: 56ch;
  color: var(--l-haze);
  margin: 0;
}

.hero-chart {
  margin-top: 8px;
  max-width: 640px;
}

.cta-row {
  display: flex;
  gap: 14px;
  flex-wrap: wrap;
  margin-top: 4px;
}

.cta {
  font-family: var(--l-font-body);
  font-weight: 600;
  font-size: 15px;
  padding: 12px 22px;
  border-radius: 999px;
  text-decoration: none;
  display: inline-flex;
  align-items: center;
}

.cta.primary {
  background: var(--l-ember-strong);
  color: var(--l-paper);
}

.cta.primary:hover {
  background: var(--l-ink);
}

.cta.ghost {
  border: 1px solid var(--l-line);
  color: var(--l-ink);
  background: var(--l-surface);
}

.cta.ghost:hover {
  border-color: var(--l-haze);
}

.cta:focus-visible {
  outline: 2px solid var(--l-signal);
  outline-offset: 3px;
}

section {
  padding: clamp(40px, 6vw, 72px) clamp(20px, 5vw, 64px);
  border-top: 1px solid var(--l-line);
}

.section-title {
  font-size: 28px;
  margin: 0 0 8px;
}

.section-lede {
  color: var(--l-haze);
  max-width: 62ch;
  margin: 0 0 28px;
}

.split-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 28px;
  margin-top: 8px;
}

.split-col {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.col-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
}

.col-name {
  font-family: var(--l-font-display);
  font-size: 22px;
  color: var(--l-ember-strong);
}

.col-name.signal-text {
  color: var(--l-signal);
}

.col-status {
  font-size: 11px;
  letter-spacing: 0.04em;
  padding: 3px 9px;
  border-radius: 999px;
  border: 1px solid var(--l-line);
}

.col-status.shipped {
  color: var(--l-ember-strong);
}

.col-status.in-design {
  color: var(--l-signal);
}

.col-desc {
  color: var(--l-haze);
  font-size: 14px;
  margin: 0;
}

.rule-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.rule {
  display: grid;
  grid-template-columns: 56px 1fr;
  gap: 16px;
  padding-bottom: 20px;
  border-bottom: 1px solid var(--l-line);
}

.rule:last-child {
  border-bottom: none;
  padding-bottom: 0;
}

.rule-id {
  font-size: 13px;
  color: var(--l-signal);
}

.rule-text {
  margin: 0 0 4px;
  color: var(--l-ink);
  font-size: 15px;
}

.rule-failure {
  margin: 0;
  color: var(--l-haze);
  font-size: 13px;
}

.built-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px 28px;
}

.built-list li {
  color: var(--l-haze);
  font-size: 14px;
}

.footer {
  padding: 28px clamp(20px, 5vw, 64px) 40px;
  border-top: 1px solid var(--l-line);
}

.footer p {
  margin: 0;
  font-size: 13px;
  color: var(--l-haze);
}

.footer a {
  color: var(--l-haze);
  text-decoration-color: var(--l-line);
}

.footer a:hover {
  color: var(--l-ink);
}

@media (max-width: 760px) {
  .split-grid {
    grid-template-columns: 1fr;
  }

  .built-list {
    grid-template-columns: 1fr;
  }

  .rule {
    grid-template-columns: 40px 1fr;
  }
}
</style>
