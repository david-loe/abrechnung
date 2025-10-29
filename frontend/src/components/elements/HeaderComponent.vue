<template>
  <nav class="navbar navbar-expand-lg border-bottom py-1">
    <div class="container d-flex" id="navBarContent">
      <a href="/" class="navbar-brand link-body-emphasis d-flex align-items-center py-0">
        <i class="fs-3 bi bi-receipt"></i>
        <span class="fs-4 ms-1">{{ t('headlines.title') }}</span>
      </a>
      <button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navbarSupportedContent">
        <span class="navbar-toggler-icon"></span>
      </button>

      <div class="collapse navbar-collapse justify-content-end" id="navbarSupportedContent">
        <ul class="navbar-nav" style="flex-wrap: wrap; line-height: 1">
          <slot></slot>
          <li class="nav-item d-flex align-items-center ms-lg-auto">
            <select
              class="form-select"
              style="max-width: 68px"
              :value="props.language"
              @change="(e) => emits('update:language', (e.target as HTMLSelectElement).value as Locale)">
              <option v-for="lang of locales" :key="lang" :value="lang" :title="$t('labels.' + lang)">
                {{ lang !== 'en' ? getFlagEmoji(lang) : '🇬🇧' }}
              </option>
            </select>
          </li>
        </ul>
      </div>
    </div>
  </nav>
</template>

<script lang="ts" setup>
import { Locale, locales } from 'abrechnung-common/types.js'
import { getFlagEmoji } from 'abrechnung-common/utils/scripts.js'
import { PropType } from 'vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

const props = defineProps({ language: { type: String as PropType<Locale> } })

const emits = defineEmits<{ 'update:language': [Locale] }>()
</script>

<style>
.router-link-active {
  font-weight: bold !important;
}
</style>
