import { BillingInterval } from "@shopify/shopify-api";
import { shopifyApp } from "@shopify/shopify-app-express";
import { RedisSessionStorage } from "@shopify/shopify-app-session-storage-redis";
import { restResources } from "@shopify/shopify-api/rest/admin/2025-07";

// The transactions with Shopify will always be marked as test transactions, unless NODE_ENV is production.
// See the ensureBilling helper to learn more about billing in this template.
const billingConfig = {
  "My Shopify One-Time Charge": {
    // This is an example configuration that would do a one-time charge for $5 (only USD is currently supported)
    amount: 5.0,
    currencyCode: "USD",
    interval: BillingInterval.OneTime,
  },
};

const REDIS_URL = process.env.REDIS_URL || "redis://127.0.0.1:6379";
const REDIS_SESSION_KEY_PREFIX = process.env.REDIS_SESSION_KEY_PREFIX;

const shopify = shopifyApp({
  api: {
    apiVersion: "2026-04",
    restResources,
    future: {
      customerAddressDefaultFix: true,
      lineItemBilling: true,
      unstable_managedPricingSupport: true,
    },
    billing: undefined, // or replace with billingConfig above to enable example billing
    scopes: [
      'read_locales',
      'read_products',
      'write_products',
      'write_pixels',
      'read_pixels',
      'read_customer_events',
    ],
  },
  auth: {
    path: "/api/auth",
    callbackPath: "/api/auth/callback",
  },
  webhooks: {
    path: "/api/webhooks",
  },
  sessionStorage: new RedisSessionStorage(REDIS_URL, {
    sessionKeyPrefix: REDIS_SESSION_KEY_PREFIX || undefined,
  }),
});

export default shopify;
