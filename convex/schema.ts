import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
export default defineSchema({
  trips: defineTable({ name:v.string(), stopNames:v.array(v.string()), distanceKm:v.optional(v.number()), durationMin:v.optional(v.number()), createdAt:v.number() }).index("by_createdAt",["createdAt"]),
  favorites: defineTable({ key:v.string(), type:v.union(v.literal("destination"),v.literal("park4night")), label:v.string(), createdAt:v.number() }).index("by_key",["key"]),
  preferences: defineTable({ profileKey:v.string(), maxDailyKm:v.number(), priority:v.string(), beach:v.boolean(), surf:v.boolean(), quiet:v.boolean() }).index("by_profileKey",["profileKey"])
});
