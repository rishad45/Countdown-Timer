import { register } from "@shopify/web-pixels-extension";

register(({ analytics }) => {
  analytics.subscribe("product_added_to_cart", (event) => {
    const productId = event.data?.productVariant?.product?.id;
    console.log("Product added to cart", event);
    fetch("http://localhost:3000/api/analytics/add-to-cart", {
      method: "POST",
      body: JSON.stringify({
        productId,
        shop: event.data?.shop?.myshopifyDomain,
        timestamp: event.timestamp,
      }),
      headers: {
        "Content-Type": "application/json",
      },
      keepalive: true,
    });
  });
});