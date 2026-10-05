/**
 * Future provider adapter contract. No SDK, network calls, or entitlement writer.
 * verifyWebhook must verify raw bytes, signature and timestamp with a server secret,
 * and return a provider event ID and canonical subscription snapshot.
 */
export class PaymentProvider {
  async createCheckoutSession() { throw new Error('PAYMENTS_DISABLED'); }
  async verifyWebhook() { throw new Error('PAYMENTS_DISABLED'); }
  async cancelSubscription() { throw new Error('PAYMENTS_DISABLED'); }
  async getSubscriptionStatus() { throw new Error('PAYMENTS_DISABLED'); }
}
