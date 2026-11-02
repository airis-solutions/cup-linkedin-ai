import { loadEnv } from '../../src/config/env.js';

describe('test environment', () => {
  it('has no alert channel, so no test can post to the real Telegram group', () => {
    expect(loadEnv().ALERT_WEBHOOK_URL).toBeUndefined();
  });
});
