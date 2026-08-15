import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
export const save = mutation({args:{clientId:v.string(),name:v.string(),days:v.number(),placeIds:v.array(v.string()),distanceKm:v.number(),durationMinutes:v.number(),createdAt:v.number()},returns:v.id("routes"),handler:async(ctx,args)=>ctx.db.insert("routes",args)});
export const list = query({args:{clientId:v.string()},returns:v.array(v.any()),handler:async(ctx,{clientId})=>ctx.db.query("routes").withIndex("by_clientId",q=>q.eq("clientId",clientId)).order("desc").take(20)});