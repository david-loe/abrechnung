<template>
  <footer class="border-top d-flex align-items-center">
    <div class="container">
      <div class="d-flex align-items-center lh-1">
        <i class="fs-4 bi bi-receipt"></i>
        <span class="ps-2 text-secondary">
          © {{ new Date().getFullYear() }} abrechnung
          <small v-if="props.version"
            ><a
              class="text-decoration-none link-secondary"
              target="_blank"
              :href="'https://github.com/david-loe/abrechnung/releases/tag/v' + props.version"
              >v{{ props.version }}</a
            ></small
          >
        </span>
      </div>
    </div>
  </footer>
</template>

<script lang="ts" setup>
const props = defineProps({ version: { type: String } })
</script>

<style>
body {
  margin-bottom: 45px !important;
  /* Margin bottom by footer height */
}
footer {
  position: absolute;
  bottom: 0;
  width: 100%;
  height: 45px;
  /* Set the fixed height of the footer here */
  /* z-index: -999; */
}
</style>
