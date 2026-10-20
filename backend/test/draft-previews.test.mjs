import test from 'node:test'
import assert from 'node:assert/strict'
import { draftPreviews } from '../src/draft-previews.mjs'

test('preview capabilities are scoped, bounded and expiring, and recheck live access and version', async () => {
  let clock = 0
  let revoked = false
  let requests = 0
  const lead = { id: 1, briefVersion: 1 }
  const job = { id: 2, leadId: 1, briefVersion: 1, artifactManifest: 's3://private/draft' }
  const previews = draftPreviews({ now: () => clock, ttlMs: 1000, limit: 1,
    staffDetail: async (token, role, id) => {
      requests++
      assert.equal(token, 'private-staff-credential')
      assert.equal(role, 'caller')
      assert.equal(id, 1)
      if (revoked) throw Object.assign(new Error('Revoked'), { status: 403 })
      return { lead, concepts: [job] }
    },
  })
  const issue = () => previews.issue('private-staff-credential', 'caller', 1, 2)
  const key = preview => preview.siteUrl.split('/')[3]
  assert.equal(await previews.issue('private-staff-credential', 'caller', 1, 3), null)
  const first = await issue()
  assert.doesNotMatch(JSON.stringify(first), /private-staff-credential|s3:\/\//)
  assert.equal((await previews.resolve(key(first))).job.id, 2)
  const second = await issue()
  assert.equal(await previews.resolve(key(first)), null)
  const before = requests
  await previews.resolve(key(second))
  await previews.resolve(key(second))
  assert.equal(requests, before + 2)
  clock = 1001
  assert.equal(await previews.resolve(key(second)), null)
  const third = await issue()
  lead.briefVersion = 2
  assert.equal(await previews.resolve(key(third)), null)
  lead.briefVersion = 1
  const fourth = await issue()
  job.artifactManifest = 's3://private/replacement'
  assert.equal(await previews.resolve(key(fourth)), null)
  const fifth = await issue()
  revoked = true
  await assert.rejects(() => previews.resolve(key(fifth)), { status: 403 })
  assert.equal(await previews.resolve(key(fifth)), null)
})
