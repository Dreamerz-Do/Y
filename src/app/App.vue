<script setup lang="ts">
import { RouterView } from 'vue-router'

// The app renders inside a phone-width frame on wide screens and full-bleed on
// a device. The single router-view hosts every screen (spec 7.6).
</script>

<template>
  <div class="mx-auto min-h-dvh w-full max-w-[430px] bg-bg text-text">
    <RouterView />
  </div>
</template>
