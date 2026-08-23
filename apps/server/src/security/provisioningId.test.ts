import assert from 'node:assert/strict';
import test from 'node:test';
import { decodeProvisioningId } from './provisioningId.js';

test('decodes an application-scoped Kashtrix provisioning ID', () => {
  const payload = {
    v: 1,
    tenantId: '11111111-1111-4111-8111-111111111111',
    applicationId: '0aa77b9e-602e-49b4-90cb-ed4ad80402b2',
    clientId: '33333333-3333-4333-8333-333333333333',
    hwid: '3B4978767B10555FE24BBB89C6B8D43AB9FD464737E98032275851AAE4769F76',
    modules: [
      { code: 'CHANNELS', name: 'Channels', type: 'boolean' },
      { code: 'RECORDING_DEVICES', name: 'Recording devices', type: 'integer', min: 0, max: 1000, step: 1, defaultValue: 0, unit: 'devices' }
    ]
  };
  const value = `KTX1.${Buffer.from(JSON.stringify(payload)).toString('base64url')}`;
  assert.deepEqual(decodeProvisioningId(value), { ...payload, hwid: payload.hwid.toLowerCase() });
});

test('rejects a raw HWID as a provisioning ID', () => {
  assert.throws(() => decodeProvisioningId('a'.repeat(64)), /Invalid client provisioning ID/);
});

test('rejects a provisioning ID without a client module catalog', () => {
  const value = `KTX1.${Buffer.from(JSON.stringify({
    v: 1,
    tenantId: '11111111-1111-4111-8111-111111111111',
    applicationId: '0aa77b9e-602e-49b4-90cb-ed4ad80402b2',
    clientId: '33333333-3333-4333-8333-333333333333',
    hwid: 'a'.repeat(64)
  })).toString('base64url')}`;
  assert.throws(() => decodeProvisioningId(value), /Invalid client provisioning ID/);
});
