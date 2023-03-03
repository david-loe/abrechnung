<template>
  <div class="card" style="width: 18rem">
    <a href="#" class="nav-link" @click="$emit('clicked')">
      <div class="card-body">
        <h5 class="card-title">{{ travel.name ? travel.name : travel.reason }}</h5>
        <h6 class="card-subtitle mb-2 text-muted">
          {{
            new Date(travel.startDate).toLocaleDateString(undefined, dateFormat) +
            ' - ' +
            new Date(travel.endDate).toLocaleDateString(undefined, dateFormat)
          }}
        </h6>
        <div>
          <span
            :class="'badge text-' + $root.stateColors[travel.state].text"
            :style="'background-color: ' + $root.stateColors[travel.state].color + ';'"
            >{{ $t('states.' + travel.state) }}</span
          >
        </div>
      </div>
    </a>
  </div>
</template>

<script>
export default {
  name: 'TravelCard',
  emits: ['clicked'],
  data() {
    return {
      dateFormat: { day: '2-digit', month: '2-digit' },
    }
  },
  components: {},
  props: { travel: { type: Object } },
  methods: {},
}
</script>

<style>
</style>