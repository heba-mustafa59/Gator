import { db } from "../index";
import { posts, feedFollows } from "../../../schema";
import { eq, desc } from "drizzle-orm";

export async function createPost(title: string, url: string, description: string | undefined, publishedAt: Date | undefined, feedId: string) {
  return await db
    .insert(posts)
    .values({ title, url, description, publishedAt, feedId })
    .onConflictDoNothing({ target: posts.url })
    .returning();
}

export async function getPostsForUser(userId: string, limit: number) {
  return await db
    .select({
      id: posts.id,
      title: posts.title,
      url: posts.url,
      description: posts.description,
      publishedAt: posts.publishedAt,
    })
    .from(posts)
    .innerJoin(feedFollows, eq(posts.feedId, feedFollows.feedId))
    .where(eq(feedFollows.userId, userId))
    .orderBy(desc(posts.publishedAt))
    .limit(limit);
}
