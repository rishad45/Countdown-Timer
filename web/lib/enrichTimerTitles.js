import shopify from "../shopify.js";

const RESOURCE_TITLE_QUERY = `#graphql
  query AppTimerResourceTitles($ids: [ID!]!) {
    nodes(ids: $ids) {
      ... on Product {
        id
        title
      }
      ... on Collection {
        id
        title
      }
    }
  }
`;

function numericIdFromGid(gid) {
  if (typeof gid !== "string") return "";
  const m = gid.match(/\/(\d+)$/);
  return m ? m[1] : "";
}

/**
 * Adds `resolvedProducts` / `resolvedCollections` with `{ id, title }` using Admin API.
 * @param {Record<string, unknown>} timer
 * @param {import("@shopify/shopify-api").Session | null | undefined} session
 */
export async function enrichTimerWithResourceTitles(timer, session) {
  if (!timer || !session?.accessToken) {
    return timer;
  }

  const productIds = Array.isArray(timer.productIds) ? timer.productIds.map(String) : [];
  const collectionIds = Array.isArray(timer.collectionIds) ? timer.collectionIds.map(String) : [];

  const gqlIds = [
    ...productIds.map((id) => `gid://shopify/Product/${id}`),
    ...collectionIds.map((id) => `gid://shopify/Collection/${id}`),
  ];

  if (gqlIds.length === 0) {
    return {
      ...timer,
      resolvedProducts: [],
      resolvedCollections: [],
    };
  }

  try {
    const client = new shopify.api.clients.Graphql({ session });
    const response = await client.request(RESOURCE_TITLE_QUERY, {
      variables: { ids: gqlIds },
    });

    const payload = response?.data ?? response;
    const nodes = Array.isArray(payload?.nodes) ? payload.nodes : [];

    const titleByNumericId = new Map();
    for (const node of nodes) {
      if (!node || typeof node !== "object") continue;
      const num = numericIdFromGid(node.id);
      const title = typeof node.title === "string" ? node.title : "";
      if (num && title) {
        titleByNumericId.set(num, title);
      }
    }

    return {
      ...timer,
      resolvedProducts: productIds.map((id) => ({
        id,
        title: titleByNumericId.get(id) ?? null,
      })),
      resolvedCollections: collectionIds.map((id) => ({
        id,
        title: titleByNumericId.get(id) ?? null,
      })),
    };
  } catch (error) {
    console.warn("enrichTimerWithResourceTitles:", error?.message || error);
    return {
      ...timer,
      resolvedProducts: productIds.map((id) => ({ id, title: null })),
      resolvedCollections: collectionIds.map((id) => ({ id, title: null })),
    };
  }
}
