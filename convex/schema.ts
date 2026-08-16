import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';
export default defineSchema({
 savedRoutes: defineTable({ name:v.string(), stops:v.array(v.string()), createdAt:v.number() }),
 favorites: defineTable({ externalId:v.string(), source:v.literal('park4night'), label:v.string(), url:v.string() }).index('by_externalId',['externalId'])
});
