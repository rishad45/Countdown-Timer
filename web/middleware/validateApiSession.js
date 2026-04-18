// @ts-check
import { HttpResponseError, InvalidJwtError } from "@shopify/shopify-api";

const TEST_GRAPHQL_QUERY = `query shopifyAppShopName {
  shop {
    name
  }
}`;

/**
 * Safe fields to log (never log access tokens).
 * @param {import("@shopify/shopify-api").Session} session
 */
function sessionLogSummary(session) {
  if (!session) return null;
  return {
    id: session.id,
    shop: session.shop,
    isOnline: Boolean(session.isOnline),
    state: session.state,
    expires: session.expires,
  };
}

/**
 * Validates Shopify session like validateAuthenticatedSession, but never redirects.
 * Returns JSON 401/403/500 instead.
 *
 * @param {import("@shopify/shopify-app-express").ShopifyApp} shopifyApp
 */
export function validateApiSession(shopifyApp) {
  const { api, config } = shopifyApp;

  return async function validateApiSessionMiddleware(req, res, next) {
    const bearerMatch = req.headers.authorization?.match(/Bearer (.*)/);
    const hasBearer = Boolean(bearerMatch);

    console.info("[api-session] incoming", {
      method: req.method,
      path: req.path,
      queryShop: req.query.shop || null,
      hasBearer,
    });

    let sessionId;
    try {
      sessionId = await api.session.getCurrentId({
        isOnline: config.useOnlineTokens,
        rawRequest: req,
        rawResponse: res,
      });
    } catch (error) {
      if (error instanceof InvalidJwtError) {
        console.warn("[api-session] getCurrentId failed (JWT)", error.message);
        return res.status(401).json({
          success: false,
          errors: [error.message],
          session: null,
        });
      }
      console.error("[api-session] getCurrentId failed", error);
      return res.status(500).json({
        success: false,
        errors: [error.message || "Session lookup failed."],
        session: null,
      });
    }

    let session = null;
    if (sessionId) {
      try {
        session = await config.sessionStorage.loadSession(sessionId);
      } catch (error) {
        console.error("[api-session] loadSession failed", error);
        return res.status(500).json({
          success: false,
          errors: [error.message || "Failed to load session."],
          session: null,
        });
      }
    }

    let shop = api.utils.sanitizeShop(req.query.shop) || session?.shop;

    if (session && shop && session.shop !== shop) {
      console.warn("[api-session] shop mismatch", {
        requestShop: shop,
        sessionShop: session.shop,
        session: sessionLogSummary(session),
      });
      return res.status(403).json({
        success: false,
        errors: ["Session shop does not match request shop."],
        session: sessionLogSummary(session),
      });
    }

    if (session) {
      console.info("[api-session] loaded", {
        session: sessionLogSummary(session),
      });

      if (!session.isActive(api.config.scopes)) {
        console.warn("[api-session] session inactive (scopes)", {
          session: sessionLogSummary(session),
        });
        return res.status(403).json({
          success: false,
          errors: ["Session is inactive or missing required scopes."],
          session: sessionLogSummary(session),
        });
      }

      const tokenResult = await checkAccessToken(api, session);
      if (tokenResult.ok) {
        res.locals.shopify = {
          ...res.locals.shopify,
          session,
        };
        console.info("[api-session] validateAuthenticatedSession OK", {
          session: sessionLogSummary(session),
        });
        return next();
      }

      console.warn("[api-session] access token check failed", {
        code: tokenResult.code,
        message: tokenResult.message,
        session: sessionLogSummary(session),
      });
      return res.status(tokenResult.code).json({
        success: false,
        errors: [tokenResult.message],
        session: sessionLogSummary(session),
      });
    }

    if (hasBearer && api.config.isEmbeddedApp) {
      try {
        const payload = await api.session.decodeSessionToken(bearerMatch[1]);
        shop = payload.dest.replace("https://", "");
      } catch (error) {
        console.warn("[api-session] decodeSessionToken failed", error.message);
        return res.status(401).json({
          success: false,
          errors: [error.message || "Invalid session token."],
          session: null,
        });
      }
    }

    console.warn("[api-session] no valid session (would redirect in default middleware)", {
      shop: shop || null,
      hasBearer,
    });
    return res.status(403).json({
      success: false,
      errors: [
        "No valid session. Re-install the app or open it from the Shopify admin.",
      ],
      session: null,
    });
  };
}

/**
 * @param {import("@shopify/shopify-api").Shopify} api
 * @param {import("@shopify/shopify-api").Session} session
 * @returns {Promise<{ ok: true } | { ok: false, code: number, message: string }>}
 */
async function checkAccessToken(api, session) {
  try {
    const client = new api.clients.Graphql({ session });
    await client.request(TEST_GRAPHQL_QUERY);
    return { ok: true };
  } catch (error) {
    if (error instanceof HttpResponseError) {
      const code = error.response?.code;
      const message = error.message || "Shopify API error";
      if (code === 401) {
        return { ok: false, code: 401, message };
      }
      if (code === 403) {
        return { ok: false, code: 403, message };
      }
    }
    throw error;
  }
}
