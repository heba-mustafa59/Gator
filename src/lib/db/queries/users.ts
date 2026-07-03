import { eq } from "drizzle-orm";
import { db } from "../index";
import { users } from "../../../schema";

export async function createUser(name: string) {
  const [result] = await db.insert(users).values({ name: name }).returning();
  return result;
}

export async function getUserByName(name: string) {
  const [user] = await db.select().from(users).where(eq(users.name, name));
  return user;
}

export async function deleteAllUsers() {
return await db.delete(users);
}

export async function getUsers() {
  return await db.select().from(users);
}
