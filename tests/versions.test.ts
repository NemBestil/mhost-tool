import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { compareVersions, resolveLatestKnownVersion } from '../server/utils/versions.ts'

describe('version resolution', () => {
  it('considers local 1.8.0 newer than WordPress.org 1.7.26', () => {
    assert.ok(compareVersions('1.8.0', '1.7.26') > 0)
    assert.equal(resolveLatestKnownVersion('1.7.26', '1.8.0'), '1.8.0')
  })

  it('keeps the WordPress.org version when the local version is older', () => {
    assert.equal(resolveLatestKnownVersion('2.0.0', '1.9.9'), '2.0.0')
  })

  it('uses whichever source has a version', () => {
    assert.equal(resolveLatestKnownVersion(null, '1.8.0'), '1.8.0')
    assert.equal(resolveLatestKnownVersion('1.7.26', undefined), '1.7.26')
    assert.equal(resolveLatestKnownVersion(null, undefined), null)
  })
})
