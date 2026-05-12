<template>
  <div id="app">
    <router-view />
    <AgentChatDrawer />
  </div>
</template>

<script lang="ts">
import { Component, Vue } from 'vue-property-decorator'
import AgentChatDrawer from '@/components/AgentChatDrawer.vue'

@Component({
  name: 'App',
  components: {
    AgentChatDrawer,
  },
})
export default class extends Vue {}
</script>
