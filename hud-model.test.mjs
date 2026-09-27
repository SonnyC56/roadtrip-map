import test from 'node:test'
import assert from 'node:assert/strict'
import {activeAt, cueAlpha, routeState, hudLayout} from './src/lib/storyHud.ts'
test('seeking backwards restores the right cue; exact end switches to the next cue',()=>{
  const cues=[{start:0,end:10,id:'arrival'},{start:10,end:20,id:'ridge'}]
  assert.deepEqual(activeAt(cues,15).map(c=>c.id),['ridge'])
  assert.deepEqual(activeAt(cues,2).map(c=>c.id),['arrival'])
  assert.deepEqual(activeAt(cues,10).map(c=>c.id),['ridge'])
  assert.deepEqual(activeAt(cues,20),[])
})
test('fade is bounded and determined by media time, including short cues',()=>{
  for(const t of [-1,0,.1,.3,.5,1,2])assert.ok(cueAlpha({start:0,end:1},t)>=0 && cueAlpha({start:0,end:1},t)<=1)
  assert.equal(cueAlpha({start:10,end:20},15),1)
  assert.equal(cueAlpha({start:10,end:20},20),0)
  assert.equal(cueAlpha({start:0,end:.1},.2),0)
})
test('route and miles interpolate only within the current shot anchors',()=>{
  const c={start:10,end:20,miles:4000,endMiles:4100,through:.4,endThrough:.5}
  assert.deepEqual(routeState(c,15),{miles:4050,through:.45})
  assert.deepEqual(routeState(c,0),{miles:4000,through:.4})
  assert.deepEqual(routeState(c,50),{miles:4100,through:.5})
})
test('phone HUD cards remain inside portrait/landscape viewports and above touch controls',()=>{
  for(const [w,h] of [[390,844],[844,390],[320,568],[1920,1080]]){
    const layout=hudLayout(w,h,156),halfH=2*Math.tan(75*Math.PI/360),halfW=halfH*w/h
    assert.ok(1.42*layout.lowerScale/2<=halfW*.91)
    assert.ok(layout.awardX+.75*layout.awardScale/2<=halfW*.91)
    assert.ok(-layout.narratorX+.62*layout.narratorScale/2<=halfW*.91)
    const lowerBottom=layout.lowerY-1.42*250/1440*layout.lowerScale/2
    assert.ok(lowerBottom>=-halfH+2*halfH*156/h)
  }
})
