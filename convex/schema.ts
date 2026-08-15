import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  routes: defineTable({
    clientId: v.string(),
    name: v.string(),
    days: v.number(),
    placeIds: v.array(v.string()),
    distanceKm: v.number(),
    durationMinutes: v.number(),
    createdAt: v.number(),
  }).index("by_clientId", ["clientId"]),
  favorites: defineTable({
    clientId: v.string(),
    itemType: v.string(),
    itemId: v.string(),
    name: v.string(),
    photo: v.optional(v.string()),
    createdAt: v.number(),
  }).index("by_clientId", ["clientId"]).index("by_clientId_and_itemType_and_itemId", ["clientId","itemType","itemId"]),
  preferences: defineTable({
    clientId: v.string(),
    payload: v.any(),
    updatedAt: v.number(),
  }).index("by_clientId", ["clientId"]),
});