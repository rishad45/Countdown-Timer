import { getDb } from "./mongo.js";

const SHOPS_COLLECTION = "shops";

const shopCollectionValidator = {
  $jsonSchema: {
    bsonType: "object",
    required: [
      "shop",
      "accessToken",
      "isOnline",
      "scope",
      "sessionId",
      "expiresAt",
      "installedAt",
      "updatedAt",
    ],
    additionalProperties: false,
    properties: {
      _id: {
        bsonType: "objectId",
        description: "Set by MongoDB on insert",
      },
      shop: {
        bsonType: "string",
        minLength: 1,
        description: "Shop domain, e.g. example.myshopify.com",
      },
      accessToken: {
        bsonType: "string",
        minLength: 1,
        description: "Offline or online Admin API access token",
      },
      isOnline: {
        bsonType: "bool",
      },
      scope: {
        bsonType: "string",
        description: "Space-separated OAuth scopes granted for this token",
      },
      sessionId: {
        bsonType: "string",
        minLength: 1,
        description: "Shopify session id",
      },
      expiresAt: {
        bsonType: ["date", "null"],
        description: "Access token expiry (online sessions)",
      },
      installedAt: { bsonType: "date" },
      updatedAt: { bsonType: "date" },
    },
  },
};

/**
 * @param {import("@shopify/shopify-api").Session} session
 */
function sessionToShopFields(session) {
  const shop = typeof session.shop === "string" ? session.shop.trim() : "";
  const accessToken =
    typeof session.accessToken === "string" ? session.accessToken : "";
  if (!shop || !accessToken) {
    return null;
  }

  const expiresAt =
    session.expires instanceof Date && !Number.isNaN(session.expires.getTime())
      ? session.expires
      : null;

  return {
    shop,
    accessToken,
    isOnline: Boolean(session.isOnline),
    scope: typeof session.scope === "string" ? session.scope : "",
    sessionId: typeof session.id === "string" ? session.id : "",
    expiresAt,
  };
}

export async function initializeShopsCollection() {
  const db = await getDb();
  const collections = await db
    .listCollections({ name: SHOPS_COLLECTION }, { nameOnly: true })
    .toArray();

  if (collections.length === 0) {
    await db.createCollection(SHOPS_COLLECTION, {
      validator: shopCollectionValidator,
      validationLevel: "strict",
      validationAction: "error",
    });
  } else {
    await db.command({
      collMod: SHOPS_COLLECTION,
      validator: shopCollectionValidator,
      validationLevel: "strict",
      validationAction: "error",
    });
  }

  const shops = db.collection(SHOPS_COLLECTION);
  await shops.createIndexes([
    { name: "shop_unique", key: { shop: 1 }, unique: true },
  ]);
}

export async function getShopsCollection() {
  const db = await getDb();
  return db.collection(SHOPS_COLLECTION);
}

/**
 * Persists or updates shop + access token after OAuth or when the session changes.
 * Skips the write if stored fields already match (avoids write on every API call).
 *
 * @param {import("@shopify/shopify-api").Session} session
 * @returns {Promise<import("mongodb").ObjectId | null>}
 */
export async function upsertShopFromSession(session) {
  const fields = sessionToShopFields(session);
  if (!fields || !fields.sessionId) {
    return null;
  }

  const collection = await getShopsCollection();
  const now = new Date();

  const existing = await collection.findOne(
    { shop: fields.shop },
    {
      projection: {
        accessToken: 1,
        isOnline: 1,
        scope: 1,
        sessionId: 1,
        expiresAt: 1,
      },
    }
  );

  const expiresEqual = datesEqual(existing?.expiresAt ?? null, fields.expiresAt);

  const unchanged =
    existing &&
    existing.accessToken === fields.accessToken &&
    existing.isOnline === fields.isOnline &&
    existing.scope === fields.scope &&
    existing.sessionId === fields.sessionId &&
    expiresEqual;

  if (unchanged) {
    return existing._id;
  }

  const setDoc = {
    ...fields,
    updatedAt: now,
  };

  await collection.updateOne(
    { shop: fields.shop },
    {
      $set: setDoc,
      $setOnInsert: { installedAt: now },
    },
    { upsert: true }
  );

  const doc = await collection.findOne({ shop: fields.shop }, { projection: { _id: 1 } });
  return doc?._id ?? null;
}

/**
 * @param {Date | null | undefined} a
 * @param {Date | null | undefined} b
 */
function datesEqual(a, b) {
  if (a == null && b == null) return true;
  if (a == null || b == null) return false;
  if (a instanceof Date && b instanceof Date) return a.getTime() === b.getTime();
  return false;
}
