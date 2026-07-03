import { createUser, getUserByName, deleteAllUsers, getUsers } from "./lib/db/queries/users";
import { createFeed, getAllFeedsWithUsers, getFeedByUrl, createFeedFollow, getFeedFollowsForUser, deleteFeedFollow, markFeedFetched, getNextFeedToFetch } from "./lib/db/queries/feeds";
import { createPost, getPostsForUser } from "./lib/db/queries/posts";
import { readConfig, writeConfig } from "./config";
import { fetchFeed } from "./rss";
import { users, feeds, posts } from "./schema";

type State = {
  config: any;
};

type Command = {
  name: string;
  args: string[];
};

type UserSelect = typeof users.$inferSelect;
type FeedSelect = typeof feeds.$inferSelect;

type CommandHandler = (state: State, cmd: Command) => Promise<void>;

type UserCommandHandler = (
  state: State,
  cmd: Command,
  user: UserSelect
) => Promise<void>;

type CommandsRegistry = {
  [key: string]: CommandHandler;
};

function registerCommand(registry: CommandsRegistry, cmdName: string, handler: CommandHandler) {
  registry[cmdName] = handler;
}

async function runCommand(registry: CommandsRegistry, state: State, cmd: Command): Promise<void> {
  const handler = registry[cmd.name];
  if (!handler) {
    throw new Error(`Unknown command: ${cmd.name}`);
  }
  await handler(state, cmd);
}

function middlewareLoggedIn(handler: UserCommandHandler): CommandHandler {
  return async (state: State, cmd: Command) => {
    const currentLoggedUser = state.config.currentUserName || state.config.current_user_name;
    if (!currentLoggedUser) {
      throw new Error("No user currently logged in.");
    }

    const currentUser = await getUserByName(currentLoggedUser);
    if (!currentUser) {
      throw new Error(`User ${currentLoggedUser} not found`);
    }

    await handler(state, cmd, currentUser);
  };
}

function printFeed(feed: FeedSelect, user: UserSelect): void {
  console.log(`ID: ${feed.id}`);
  console.log(`Created At: ${feed.createdAt}`);
  console.log(`Updated At: ${feed.updatedAt}`);
  console.log(`Name: ${feed.name}`);
  console.log(`URL: ${feed.url}`);
  console.log(`User ID: ${feed.userId}`);
  console.log(`User Name: ${user.name}`);
}

function parseDuration(durationStr: string): number {
  const regex = /^(\d+)(ms|s|m|h)$/;
  const match = durationStr.match(regex);
  if (!match) {
    throw new Error(`Invalid duration format: ${durationStr}`);
  }
  const value = parseInt(match[1], 10);
  const unit = match[2];
  switch (unit) {
    case "ms": return value;
    case "s": return value * 1000;
    case "m": return value * 60000;
    case "h": return value * 3600000;
    default: return 0;
  }
}

async function scrapeFeeds() {
  const nextFeed = await getNextFeedToFetch();
  if (!nextFeed) {
    console.log("No feeds available to fetch.");
    return;
  }
  console.log(`Fetching feed: ${nextFeed.name} (${nextFeed.url})`);
  try {
    const fetchedData = await fetchFeed(nextFeed.url);
    await markFeedFetched(nextFeed.id);
    for (const item of fetchedData.items) {
      let publishedAt: Date | undefined = undefined;
      if (item.pubDate) {
        const parsedDate = Date.parse(item.pubDate);
        if (!isNaN(parsedDate)) {
          publishedAt = new Date(parsedDate);
        }
      }
      await createPost(item.title, item.link, item.description, publishedAt, nextFeed.id);
    }
    console.log(`Successfully scraped and saved ${fetchedData.items.length} posts from ${nextFeed.name}.`);
  } catch (err: any) {
    console.error(`Error scraping feed ${nextFeed.name}: ${err.message}`);
  }
}

async function handlerRegister(state: State, cmd: Command): Promise<void> {
  if (!cmd.args || cmd.args.length === 0) {
    throw new Error("The register command expects a username.");
  }

  const username = cmd.args[0];

  const existingUser = await getUserByName(username);
  if (existingUser) {
    throw new Error("User already exists!");
  }

  const newUser = await createUser(username);
  
  state.config.currentUserName = newUser.name;
  writeConfig(state.config);

  console.log(`User '${newUser.name}' has been successfully created.`);
  console.log(newUser);
}

async function handlerLogin(state: State, cmd: Command): Promise<void> {
  if (!cmd.args || cmd.args.length === 0) {
    throw new Error("The login command expects a username.");
  }

  const username = cmd.args[0];

  const user = await getUserByName(username);
  if (!user) {
    throw new Error("User does not exist in the database. You cannot login!");
  }

  state.config.currentUserName = user.name;
  writeConfig(state.config);

  console.log(`Logged in successfully as ${user.name}`);
}

async function handlerReset(state: State, cmd: Command): Promise<void> {
  try {
    await deleteAllUsers();
    console.log("Database has been successfully reset. All users deleted.");
  } catch (error: any) {
    throw new Error(`Failed to reset database: ${error.message}`);
  }
}

async function handlerUsers(state: State, cmd: Command): Promise<void> {
  const allUsers = await getUsers();
  const currentLoggedUser = state.config.currentUserName || state.config.current_user_name;

  for (const user of allUsers) {
    if (user.name === currentLoggedUser) {
      console.log(`* ${user.name} (current)`);
    } else {
      console.log(`* ${user.name}`);
    }
  }
}

async function handlerAddFeed(state: State, cmd: Command, currentUser: UserSelect): Promise<void> {
  if (!cmd.args || cmd.args.length < 2) {
    throw new Error("The addfeed command expects two arguments: name and url.");
  }

  const feedName = cmd.args[0];
  const feedUrl = cmd.args[1];

  const newFeed = await createFeed(feedName, feedUrl, currentUser.id);
  printFeed(newFeed, currentUser);

  await createFeedFollow(currentUser.id, newFeed.id);
  console.log(`Feed '${newFeed.name}' is now automatically followed by user '${currentUser.name}'.`);
}

async function handlerFeeds(state: State, cmd: Command): Promise<void> {
  const allFeeds = await getAllFeedsWithUsers();
  for (const feed of allFeeds) {
    console.log(`* Name: ${feed.feedName}`);
    console.log(`  URL: ${feed.feedUrl}`);
    console.log(`  User: ${feed.userName}`);
  }
}

async function handlerFollow(state: State, cmd: Command, currentUser: UserSelect): Promise<void> {
  if (!cmd.args || cmd.args.length === 0) {
    throw new Error("The follow command expects a feed URL.");
  }

  const feedUrl = cmd.args[0];

  const targetFeed = await getFeedByUrl(feedUrl);
  if (!targetFeed) {
    throw new Error("Feed URL not found in database.");
  }

  const followRecord = await createFeedFollow(currentUser.id, targetFeed.id);
  console.log(`Feed '${followRecord.feedName}' followed by user '${followRecord.userName}'.`);
}

async function handlerFollowing(state: State, cmd: Command, currentUser: UserSelect): Promise<void> {
  const follows = await getFeedFollowsForUser(currentUser.id);
  for (const f of follows) {
    console.log(`* ${f.feedName}`);
  }
}

async function handlerUnfollow(state: State, cmd: Command, currentUser: UserSelect): Promise<void> {
  if (!cmd.args || cmd.args.length === 0) {
    throw new Error("The unfollow command expects a feed URL.");
  }

  const feedUrl = cmd.args[0];
  await deleteFeedFollow(currentUser.id, feedUrl);
  console.log(`Successfully unfollowed feed at URL: ${feedUrl}`);
}

async function handlerBrowse(state: State, cmd: Command, currentUser: UserSelect): Promise<void> {
  let limit = 2;
  if (cmd.args && cmd.args.length > 0) {
    const parsedLimit = parseInt(cmd.args[0], 10);
    if (!isNaN(parsedLimit)) {
      limit = parsedLimit;
    }
  }

  const userPosts = await getPostsForUser(currentUser.id, limit);
  if (userPosts.length === 0) {
    console.log("No posts found from the feeds you follow.");
    return;
  }

  for (const post of userPosts) {
    console.log(`========================================`);
    console.log(`Title: ${post.title}`);
    console.log(`Published At: ${post.publishedAt}`);
    console.log(`URL: ${post.url}`);
    console.log(`Description: ${post.description || "No description provided."}`);
  }
}

async function handlerAgg(state: State, cmd: Command): Promise<void> {
  if (!cmd.args || cmd.args.length === 0) {
    throw new Error("The agg command expects a time_between_reqs duration argument (e.g., 1s, 1m).");
  }
  const durationStr = cmd.args[0];
  const timeBetweenRequests = parseDuration(durationStr);
  console.log(`Collecting feeds every ${durationStr}`);

  await scrapeFeeds();

  const interval = setInterval(() => {
    scrapeFeeds().catch((err) => console.error(err));
  }, timeBetweenRequests);

  await new Promise<void>((resolve) => {
    process.on("SIGINT", () => {
      console.log("\nShutting down feed aggregator...");
      clearInterval(interval);
      resolve();
    });
  });
}

async function main() {
  const myRegistry: CommandsRegistry = {};
  
  registerCommand(myRegistry, "login", handlerLogin);
  registerCommand(myRegistry, "register", handlerRegister);
  registerCommand(myRegistry, "reset", handlerReset);
  registerCommand(myRegistry, "users", handlerUsers);
  registerCommand(myRegistry, "agg", handlerAgg);
  registerCommand(myRegistry, "feeds", handlerFeeds);
  
  registerCommand(myRegistry, "addfeed", middlewareLoggedIn(handlerAddFeed));
  registerCommand(myRegistry, "follow", middlewareLoggedIn(handlerFollow));
  registerCommand(myRegistry, "following", middlewareLoggedIn(handlerFollowing));
  registerCommand(myRegistry, "unfollow", middlewareLoggedIn(handlerUnfollow));
  registerCommand(myRegistry, "browse", middlewareLoggedIn(handlerBrowse));

  const config = readConfig();
  const state: State = { config };

  const args = process.argv.slice(2);

  if (args.length < 1) {
    console.error("Error: Not enough arguments provided.");
    process.exit(1);
  }

  const cmdName = args[0];
  const cmdArgs = args.slice(1);

  const command: Command = {
    name: cmdName,
    args: cmdArgs
  };

  try {
    await runCommand(myRegistry, state, command);
} catch (error: any) {console.error(Error: ${error.message});process.exit(1);}process.exit(0);}main();
