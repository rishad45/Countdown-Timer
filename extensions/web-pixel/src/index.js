import { register } from "@shopify/web-pixels-extension";

register(({ analytics, init, settings }) => {

  const shopDomain = init.data?.shop?.myshopifyDomain ?? null;

  const send = (event) => {
    const body = {
      shop: shopDomain,
      receivedAt: new Date().toISOString(),
      event,
    };
    console.log("Sending event", body);
    // fetch(`http://localhost:3000/api/public/analytics`, {
    //   method: "POST",
    //   headers: {
    //     "Content-Type": "application/json",
    //     Accept: "application/json",
    //   },
    //   body: JSON.stringify(body),
    //   keepalive: true,
    // }).catch(() => {});
  };

  analytics.subscribe("all_events", (event) => {
    send(event);
  });
});
