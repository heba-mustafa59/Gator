import { XMLParser } from "fast-xml-parser";

export type RSSItem = {
  title: string;
  link: string;
  description: string;
  pubDate: string;
};

export type RSSFeed = {
  channel: {
    title: string;
    link: string;
    description: string;
  };
  items: RSSItem[];
};

export async function fetchFeed(feedURL: string): Promise<RSSFeed> {
  const response = await fetch(feedURL, {
    headers: {
      "User-Agent": "gator",
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch feed: ${response.statusText}`);
  }

  const xmlData = await response.text();
  const parser = new XMLParser({
    processEntities: false,
  });

  const parsedObject = parser.parse(xmlData);
  const channel = parsedObject?.rss?.channel;

  if (!channel) {
    throw new Error("Invalid RSS feed: channel element not found.");
  }

  const feedTitle = channel.title;
  const feedLink = channel.link;
  const feedDescription = channel.description;

  if (typeof feedTitle !== "string" || typeof feedLink !== "string" || typeof feedDescription !== "string") {
    throw new Error("Invalid RSS feed: missing required channel metadata.");
  }

  const rawItems = channel.item;
  let itemsArray: any[] = [];

  if (Array.isArray(rawItems)) {
    itemsArray = rawItems;
  } else if (rawItems && typeof rawItems === "object") {
    itemsArray = [rawItems];
  }

  const validItems: RSSItem[] = [];

  for (const item of itemsArray) {
    if (
      typeof item.title === "string" &&
      typeof item.link === "string" &&
      typeof item.description === "string" &&
      typeof item.pubDate === "string"
    ) {
      validItems.push({
        title: item.title,
        link: item.link,
        description: item.description,
        pubDate: item.pubDate,
      });
    }
  }

  return {
    channel: {
      title: feedTitle,
      link: feedLink,
      description: feedDescription,
    },
    items: validItems,
  };
}
