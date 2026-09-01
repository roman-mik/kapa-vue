<script setup lang="ts">
// Thin opener: the actual Add UI lives in the globally-mounted
// <PocketEntrySheet> (App.vue), reached from here (a deep link / bottom-tab
// "Add") as well as from a Duplicate row action elsewhere in Pocket. Closing
// the sheet while this route is the active one navigates back so the URL
// doesn't stay stuck on /pocket/add behind a closed sheet.
import { onMounted, watch } from 'vue';
import { useRouter } from 'vue-router';
import { usePocketEntrySheet } from '@/composables/usePocketEntrySheet';

const router = useRouter();
const sheet = usePocketEntrySheet();

onMounted(() => sheet.open());

watch(
  () => sheet.isOpen.value,
  (isOpen) => {
    if (!isOpen) router.back();
  }
);
</script>

<template>
  <main class="page" />
</template>
