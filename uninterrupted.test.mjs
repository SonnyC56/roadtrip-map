import test from 'node:test'
import assert from 'node:assert/strict'
import { verifiedMaster } from './src/lib/uninterrupted.ts'
const ready = { version: 'v06', status: 'ready', format: '16x9', src: 'masters/v06/film.mp4', duration: 7392, bytes: 50000000000, sha256: 'a'.repeat(64) }
test('unpublished and incomplete masters stay unavailable', () => {
 for (const value of [null, {}, {...ready,status:'preparing'}, {...ready,sha256:''}, {...ready,bytes:0}, {...ready,version:'v05'}, {...ready,src:'masters/v06/../unfinished.mp4'}]) assert.equal(verifiedMaster(value,'16x9'),null)
})
test('verified masters enable only their matching format', () => {
 assert.deepEqual(verifiedMaster(ready,'16x9'),ready)
 assert.equal(verifiedMaster(ready,'vr'),null)
 const vr={...ready,format:'vr',src:'masters/vr-v06/film.mp4'}
 assert.deepEqual(verifiedMaster(vr,'vr'),vr)
})
