<script setup lang="ts">
import { defineAsyncComponent, ref } from 'vue'
import { enterVR, xrSupported, vrState } from '../lib/xr'
const VRViewer=defineAsyncComponent(()=>import('./VRViewer.vue'))
const error=ref('')
const base='https://media.2025roadtrip.com/experiments/vr-hud-v01/'
async function open(at=0,headset=false){
  error.value=''
  try{await enterVR({kind:'video',title:'Olympic · VR story HUD proof',src:base+(headset || window.innerWidth>700 ? 'olympic-hud-4k.mp4?v=20260927' : 'olympic-hud-mobile.mp4?v=20260927'),hud:base+'hud.json',startAt:at},!headset)}
  catch{error.value='Could not enter VR. Try the on-screen preview or reopen in your headset browser.'}
}
</script>
<template>
  <main class="proof">
    <p class="eyebrow">SONNY’S ROADTRIP 2025 · VR DESIGN PREVIEW</p>
    <h1>A little context.<br><span>The whole world around you.</span></h1>
    <p class="lead">Olympic, from arrival to Hurricane Ridge. A 50-second test of floating story panels, with the original v6 soundtrack.</p>
    <div class="actions">
      <button @click="open()">Watch the HUD preview <span>↗</span></button>
      <button v-if="xrSupported" class="secondary" @click="open(0,true)">Open in headset</button>
    </div>
    <div class="moments" aria-label="Preview moments">
      <button @click="open(2)"><small>00:02</small><strong>A keepsake joins the trip</strong><span>Olympic magnet</span></button>
      <button @click="open(10)"><small>00:10</small><strong>Park four, unlocked</strong><span>Animated park achievement</span></button>
      <button @click="open(28.2)"><small>00:28</small><strong>Sonny, looking back</strong><span>Retrospective narration indicator</span></button>
    </div>
    <p class="note">Drag to look around. The story panels follow your view. Use <strong>HUD on/off</strong> to compare; in a headset, open the scrub panel with a controller click or B/Y. Story panels step aside while those controls are open.</p>
    <p class="note">Unlisted style preview. Try the HUD on and off, then tell me how the size and placement feel. Turn your phone sideways for a wider view, or use a headset to test the floating panels. This preview does not change the main film.</p>
    <p v-if="error" role="alert">{{error}}</p>
    <VRViewer v-if="vrState" :state="vrState" />
  </main>
</template>
<style scoped>
.proof{height:100dvh;overflow:auto;padding:clamp(28px,7vw,90px);background:radial-gradient(ellipse at 90% 15%,#28484c 0,transparent 50%),#101b23;color:#f5f1e7;font-family:system-ui,sans-serif}
.eyebrow{font-size:12px;letter-spacing:.19em;color:#e6b56a;margin:0 0 36px}h1{font-size:clamp(36px,5vw,70px);font-weight:500;letter-spacing:-.045em;line-height:1.1;max-width:1050px;margin:0 0 25px}h1 span{color:#a5b9be}.lead{font-size:18px;line-height:1.65;max-width:650px;color:#c1ced0}.actions{display:flex;flex-wrap:wrap;gap:14px;margin:32px 0 46px}.actions button{border:1px solid #e6b56a;border-radius:11px;padding:18px 24px;background:#e6b56a;color:#101b23;font-size:16px;font-weight:650;cursor:pointer}.actions button span{margin-left:24px}.actions .secondary{background:transparent;color:#e6b56a}.moments{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;max-width:1050px}.moments button{display:grid;gap:15px;text-align:left;padding:25px;border:1px solid #465953;border-radius:14px;background:#142730ba;color:#f5f1e7;cursor:pointer}.moments small{color:#e6b56a;font-variant-numeric:tabular-nums}.moments strong{font-size:18px;font-weight:500}.moments span{color:#a5b9be;font-size:13px}.note{max-width:850px;font-size:13px;line-height:1.7;color:#a5b9be;margin-top:28px}button:focus-visible{outline:3px solid #e6b56a;outline-offset:4px}@media(max-width:650px){.moments{grid-template-columns:1fr}.proof{padding-bottom:70px}}
</style>
