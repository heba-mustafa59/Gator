import { db } from "../index";
import { feeds, users, feedFollows } from "../../../schema";
import { eq, and, asc, sql } from "drizzle-orm";

export async function createFeed(name: string, url: string, userId: string) {
  const [result] = await db.insert(feeds).values({ name, url, userId }).returning();
  return result;
}

export async function getAllFeedsWithUsers() {
  return await db
    .select({
      feedName: feeds.name,
      feedUrl: feeds.url,
      userName: users.name,
    })
    .from(feeds)
    .innerJoin(users, eq(feeds.userId, users.id));
}

export async function getFeedByUrl(url: string) {
  const [feed] = await db.select().from(feeds).where(eq(feeds.url, url));
  return feed;
}

export async function createFeedFollow(userId: string, feedId: string) {
  const [inserted] = await db.insert(feedFollows).values({ userId, feedId }).returning();
  const [result] = await db
    .select({
      id: feedFollows.id,
      createdAt: feedFollows.createdAt,
      updatedAt: feedFollows.updatedAt,
      userId: feedFollows.userId,
      feedId: feedFollows.feedId,
      userName: users.name,
      feedName: feeds.name,
    })
    .from(feedFollows)
    .innerJoin(users, eq(feedFollows.userId, users.id))
    .innerJoin(feeds, eq(feedFollows.feedId, feeds.id))
    .where(eq(feedFollows.id, inserted.id));
  return result;
}

export async function getFeedFollowsForUser(userId: string) {
  return await db
    .select({
      feedName: feeds.name,
      userName: users.name,
    })
    .from(feedFollows)
    .innerJoin(users, eq(feedFollows.userId, users.id))
    .innerJoin(feeds, eq(feedFollows.feedId, feeds.id))
    .where(eq(feedFollows.userId, userId));
}

export async function deleteFeedFollow(userId: string, url: string) {
  const targetFeed = await getFeedByUrl(url);
  if (!targetFeed) {
    throw new Error("Feed URL not found in database.");
  }
  return await db
    .delete(feedFollows)
    .where(and(eq(feedFollows.userId, userId), eq(feedFollows.feedId, targetFeed.id)));
}

// 1. تحديث وقت الجلب الحالي
export async function markFeedFetched(feedId: string) {
  return await db
    .update(feeds)
    .set({
      lastFetchedAt: new Date(),
      updatedAt: new Date()
    })
    .where(eq(feeds.id, feedId));
}

// 2. جلب أقدم خلاصة معالجة برمجياً
export async function getNextFeedToFetch() {
  const [nextFeed] = await db
    .select()
    .from(feeds)
    .orderBy(sql`${feeds.lastFetchedAt} ASC NULLS FIRST`)
    .limit(1);
  return nextFeed;
}
