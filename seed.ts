import { db } from "./server/db";
import { movies } from "@shared/schema";
import { users } from "@shared/models/auth";
import { eq } from "drizzle-orm";

async function seed() {
  const existingMovies = await db.select().from(movies);
  if (existingMovies.length === 0) {
    // Check if we have any users, if not we'll create a dummy system user just for seeding movies
    let systemUser = await db.select().from(users).where(eq(users.id, "system")).limit(1);
    
    if (systemUser.length === 0) {
      await db.insert(users).values({
        id: "system",
        email: "system@example.com",
        firstName: "System",
        lastName: "User",
      });
    }

    await db.insert(movies).values([
      {
        title: 'Inception',
        description: 'A thief who steals corporate secrets through the use of dream-sharing technology is given the inverse task of planting an idea into the mind of a C.E.O.',
        imageUrl: 'https://image.tmdb.org/t/p/original/9gk7adHYeDvHkCSEqAvQNLV5Uge.jpg',
        releaseYear: 2010,
        userId: 'system'
      },
      {
        title: 'Interstellar',
        description: 'A team of explorers travel through a wormhole in space in an attempt to ensure humanity\'s survival.',
        imageUrl: 'https://image.tmdb.org/t/p/original/gEU2QniE6E77NI6lCU6MxlNBvIx.jpg',
        releaseYear: 2014,
        userId: 'system'
      },
      {
        title: 'The Dark Knight',
        description: 'When the menace known as the Joker wreaks havoc and chaos on the people of Gotham, Batman must accept one of the greatest psychological and physical tests of his ability to fight injustice.',
        imageUrl: 'https://image.tmdb.org/t/p/original/qJ2tW6WMUDux911r6m7haRef0WH.jpg',
        releaseYear: 2008,
        userId: 'system'
      }
    ]);
    console.log("Seeded database with sample movies");
  } else {
    console.log("Database already has data");
  }
}

seed().catch(console.error).finally(() => process.exit(0));
