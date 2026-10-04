<script setup lang="ts">
import PaymentActionSheet from '@/components/horizon/PaymentActionSheet.vue';
import { usePaymentActionSheet } from '@/composables/usePaymentActionSheet';
import PaymentLinkSheet from '@/components/horizon/PaymentLinkSheet.vue';
import { usePaymentLinkSheet } from '@/composables/usePaymentLinkSheet';
import { useRoute } from 'vue-router';
import AppHeader from '@/components/layout/AppHeader.vue';
import BottomTabBar from '@/components/layout/BottomTabBar.vue';
import OfflineBanner from '@/components/layout/OfflineBanner.vue';
import PocketEntrySheet from '@/components/pocket/PocketEntrySheet.vue';
import ToastHost from '@/components/ui/ToastHost.vue';

const route = useRoute();
const paymentAction = usePaymentActionSheet();
const paymentLink = usePaymentLinkSheet();
</script>

<template>
  <OfflineBanner />
  <AppHeader v-if="route.meta.showHeader" />
  <main class="app-main">
    <router-view />
  </main>
  <ToastHost />
  <PocketEntrySheet />
  <PaymentActionSheet v-if="paymentAction.paymentId.value" />
  <PaymentLinkSheet v-if="paymentLink.isOpen.value" />
  <BottomTabBar v-if="route.meta.showHeader" />
</template>
