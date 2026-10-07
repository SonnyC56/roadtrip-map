import './assets/main.css'
import { initAnalytics, trackFailure } from './lib/analytics'

import { createApp } from 'vue'
import { createPinia } from 'pinia'

import App from './App.vue'

initAnalytics()
const app = createApp(App)

app.use(createPinia())
app.config.errorHandler = (error) => { trackFailure('app', 'vue'); console.error(error) }

app.mount('#app')
