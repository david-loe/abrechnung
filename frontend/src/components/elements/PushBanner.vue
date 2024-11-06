<template>
  <div
    id="push-banner"
    style="
      position: absolute;
      left: 25%;
      background-color: #434343;
      color: #fff;
      width: 50%;
      margin-bottom: 1%;
      margin-right: auto;
      margin-left: auto;
      display: flex;
      justify-content: center;
      text-align: center;
    ">
    Willst du Benachrichtigungen aktivieren?
    <button class="btn btn-success" @click="$emit('subscribe')">Ja</button>
    <button class="btn btn-close" @click="$emit('closePush')"></button>
  </div>
</template>
<script lang="ts">
import { defineComponent } from 'vue'
export default defineComponent({
  name: 'OfflineComponent',
  emits: ['subscribe', 'closePush']
})
</script>
