/**
 * A hook that returns an auth-aware fetch function. (Aco-Modified)
 *
 * The returned fetch function that matches the browser's fetch API See:
 * https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API It will provide
 * the following functionality:
 *
 * 1. Add a `X-Shopify-Access-Token` header to the request.
 * 2. Check response for `X-Shopify-API-Request-Failure-Reauthorize` header.
 * 3. Redirect the user to the reauthorization URL if the header is present.
 *
 * @returns {Function} Fetch function
 */
const shop = shopify.config.shop;
const host = shopify.config.host;

const appendShopToFetch = (...args) => {
  if (typeof args[0] === 'string') {
    let url = args[0];
    const qry = `shop=${shop}&host=${host}`;
    const hasQuery = url.indexOf('?') !== -1;
    url = hasQuery ? `${url}&${qry}` : `${url}?${qry}`;
    args[0] = url;
  }

  return fetch(...args);
};
export function useAuthenticatedFetch() {
  return appendShopToFetch;
}
