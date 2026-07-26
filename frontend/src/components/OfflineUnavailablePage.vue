<template>
  <main class="container py-5 text-center">
    <i class="bi bi-wifi-off fs-1"></i>
    <h1 class="h3 mt-3">{{ title }}</h1>
    <p>{{ message }}</p>
    <router-link class="btn btn-primary" to="/user">{{ back }}</router-link>
  </main>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

const { locale } = useI18n()
const title = computed(() => (locale.value === 'de' ? 'Offline nicht verfügbar' : 'Unavailable offline'))
const message = computed(() =>
  locale.value === 'de'
    ? 'Diese Seite benötigt aus Sicherheitsgründen eine aktive Verbindung.'
    : 'For security, this page requires an active connection.'
)
const back = computed(() => (locale.value === 'de' ? 'Zu meinen Berichten' : 'Back to my reports'))
</script>
