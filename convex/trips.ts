import { mutation, query } from "./_generated/server";import { v } from "convex/values";
export const list=query({args:{},handler:async(ctx)=>await ctx.db.query("trips").withIndex("by_createdAt").order("desc").take(30)});
export const save=mutation({args:{name:v.string(),stopNames:v.array(v.string()),distanceKm:v.optional(v.number()),durationMin:v.optional(v.number())},handler:async(ctx,a)=>ctx.db.insert("trips",{...a,createdAt:Date.now()})});
