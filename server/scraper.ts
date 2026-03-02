import { storage } from "./storage";

const BASE_URL = "https://uzmovi.tv";

const CATEGORY_MAP: Record<string, string> = {
  "tarjima-kinolarri": "Tarjima kinolar",
  "hind-kinolar": "Hind kinolar",
  "serialar": "Seriallar",
  "multfilmlari": "Multfilmlar",
  "criminal": "Criminal",
  "drama": "Drama",
  "ujas": "Ujas",
  "komediya": "Komediya",
  "jangari": "Jangari",
  "fantastik": "Fantastik",
};

interface ScrapedMovie {
  title: string;
  description: string;
  imageUrl: string | null;
  releaseYear: number | null;
  genre: string | null;
  country: string | null;
  sourceUrl: string;
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&#039;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#x20;/g, " ")
    .replace(/&#x27;/g, "'")
    .replace(/&#x28;/g, "(")
    .replace(/&#x29;/g, ")")
    .replace(/&#x2F;/g, "/")
    .replace(/&#8230;/g, "...")
    .replace(/&nbsp;/g, " ");
}

function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, "").trim();
}

async function fetchPage(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      "Accept-Language": "uz,ru;q=0.9,en;q=0.8",
    },
  });
  if (!response.ok) throw new Error(`Failed to fetch ${url}: ${response.status}`);
  return response.text();
}

function extractMovieUrlsFromPage(html: string): string[] {
  const urls: Set<string> = new Set();
  const absolutePattern = /href="(https:\/\/uzmovi\.tv\/[^"]+\.html)"/g;
  let match;
  while ((match = absolutePattern.exec(html))) {
    const u = match[1];
    if (!u.includes("/age.html") && !u.includes("/login") && !u.includes("/register")) {
      urls.add(u);
    }
  }
  const relativePattern = /href="(\/[^"]+\.html)"/g;
  while ((match = relativePattern.exec(html))) {
    const u = `${BASE_URL}${match[1]}`;
    if (!u.includes("/age.html")) {
      urls.add(u);
    }
  }
  return [...urls];
}

function parseMovieDetail(html: string, sourceUrl: string): ScrapedMovie | null {
  const titleMatch = html.match(/<title>(.*?)<\/title>/);
  if (!titleMatch) return null;

  let title = decodeHtmlEntities(stripTags(titleMatch[1]));
  title = title
    .replace(/\s*-\s*uzmovi\.tv.*$/i, "")
    .replace(/\s*\|\s*uzmovi.*$/i, "")
    .trim();

  if (!title) return null;

  let description = "";
  let releaseYear: number | null = null;
  let genre: string | null = null;
  let country: string | null = null;
  let imageUrl: string | null = null;

  const quoteMatch = html.match(/<blockquote[^>]*>([\s\S]*?)<\/blockquote>/);
  if (quoteMatch) {
    description = decodeHtmlEntities(stripTags(quoteMatch[1])).trim();
  }

  const yearSection = html.match(/Yili[\s\S]*?finfo-text[^>]*>([\s\S]*?)<\/div>/i);
  if (yearSection) {
    const yearNum = yearSection[1].match(/(\d{4})/);
    if (yearNum) releaseYear = Number(yearNum[1]);
  }

  const genreSection = html.match(/Janr[\s\S]*?finfo-text[^>]*>([\s\S]*?)<\/div>/i);
  if (genreSection) {
    const genreLinks = genreSection[1].match(/<a[^>]*>([^<]+)<\/a>/g) || [];
    const genres = genreLinks
      .map((g) => decodeHtmlEntities(stripTags(g)))
      .filter((g) => g.length > 1 && !g.includes("o'tish"));
    if (genres.length > 0) genre = genres.join(", ");
  }

  const countrySection = html.match(/Davlati[\s\S]*?finfo-text[^>]*>([\s\S]*?)<\/div>/i);
  if (countrySection) {
    country = decodeHtmlEntities(stripTags(countrySection[1])).trim();
  }

  const imgMatch = html.match(/<img[^>]+src="(https:\/\/images\.uzmovi\.tv\/[^"]+\.(jpg|jpeg|png|webp)[^"]*)"/i);
  if (imgMatch) {
    imageUrl = imgMatch[1];
  }

  if (!description && title) {
    description = title;
  }

  return {
    title,
    description,
    imageUrl,
    releaseYear,
    genre,
    country,
    sourceUrl,
  };
}

export async function scrapeMovieList(
  page: number = 1,
  category?: string
): Promise<{ urls: string[]; total: number }> {
  let url: string;
  if (category) {
    url = page > 1 ? `${BASE_URL}/${category}/page/${page}/` : `${BASE_URL}/${category}/`;
  } else {
    url = page > 1 ? `${BASE_URL}/page/${page}/` : `${BASE_URL}/`;
  }

  const html = await fetchPage(url);
  const urls = extractMovieUrlsFromPage(html);

  let sidebarStart = html.indexOf('id="sidebar"');
  if (sidebarStart === -1) sidebarStart = html.indexOf('class="sidebar"');
  const mainUrls = sidebarStart > 0
    ? extractMovieUrlsFromPage(html.substring(0, sidebarStart))
    : urls;

  return { urls: mainUrls, total: mainUrls.length };
}

export async function scrapeMovieDetail(url: string): Promise<ScrapedMovie | null> {
  try {
    const html = await fetchPage(url);
    return parseMovieDetail(html, url);
  } catch (err) {
    console.error(`Failed to scrape ${url}:`, err);
    return null;
  }
}

export async function scrapeAndSaveMovies(
  options: {
    page?: number;
    category?: string;
    limit?: number;
    userId: string;
  }
): Promise<{ added: number; skipped: number; errors: number; movies: string[] }> {
  const { page = 1, category, limit = 10, userId } = options;

  const { urls } = await scrapeMovieList(page, category);
  const limitedUrls = urls.slice(0, limit);

  let added = 0;
  let skipped = 0;
  let errors = 0;
  const addedMovies: string[] = [];

  const existingMovies = await storage.getMovies();
  const existingTitles = new Set(existingMovies.map((m) => m.title.toLowerCase().trim()));

  let categoryId: number | null = null;
  if (category && CATEGORY_MAP[category]) {
    const cats = await storage.getCategories();
    let cat = cats.find((c) => c.name === CATEGORY_MAP[category]);
    if (!cat) {
      cat = await storage.createCategory(CATEGORY_MAP[category]);
    }
    categoryId = cat.id;
  }

  for (const url of limitedUrls) {
    try {
      await new Promise((r) => setTimeout(r, 500));

      const movie = await scrapeMovieDetail(url);
      if (!movie) {
        errors++;
        continue;
      }

      if (existingTitles.has(movie.title.toLowerCase().trim())) {
        skipped++;
        continue;
      }

      let movieCategoryId = categoryId;
      if (!movieCategoryId && movie.genre) {
        const cats = await storage.getCategories();
        const firstGenre = movie.genre.split(",")[0].trim();
        let cat = cats.find((c) => c.name.toLowerCase() === firstGenre.toLowerCase());
        if (!cat && firstGenre) {
          cat = await storage.createCategory(firstGenre);
        }
        if (cat) movieCategoryId = cat.id;
      }

      await storage.createMovie({
        title: movie.title,
        description: movie.description,
        imageUrl: movie.imageUrl,
        releaseYear: movie.releaseYear,
        categoryId: movieCategoryId,
        userId,
      });

      existingTitles.add(movie.title.toLowerCase().trim());
      addedMovies.push(movie.title);
      added++;
    } catch (err) {
      console.error(`Error processing ${url}:`, err);
      errors++;
    }
  }

  return { added, skipped, errors, movies: addedMovies };
}

export function getAvailableCategories(): { key: string; name: string }[] {
  return Object.entries(CATEGORY_MAP).map(([key, name]) => ({ key, name }));
}
