import { useState, useMemo } from "react";
import { useMovies, useCategories } from "@/hooks/use-movies";
import { useAuth } from "@/hooks/use-auth";
import MovieCard from "@/components/movies/MovieCard";
import Navbar from "@/components/layout/Navbar";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Play, Info, Clapperboard } from "lucide-react";
import { Link } from "wouter";
import { motion } from "framer-motion";

export default function Home() {
  const { data: movies, isLoading, error } = useMovies();
  const { data: categoriesList } = useCategories();
  const { isAuthenticated } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);

  const filteredMovies = useMemo(() => {
    if (!movies) return [];
    let result = movies;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(m => m.title.toLowerCase().includes(q) || m.description.toLowerCase().includes(q));
    }
    if (selectedCategory) {
      result = result.filter(m => m.categoryId === selectedCategory);
    }
    return result;
  }, [movies, searchQuery, selectedCategory]);

  const heroMovie = filteredMovies.length > 0 ? filteredMovies[0] : null;
  const gridMovies = filteredMovies.length > 0 ? filteredMovies.slice(1) : [];

  const fallbackHeroImage = "https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=1920&q=80";

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-foreground">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-2" data-testid="text-error">Xatolik yuz berdi</h2>
          <p className="text-muted-foreground">{error.message}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar onSearch={setSearchQuery} />

      {isLoading ? (
        <div className="w-full h-[70vh] sm:h-[80vh] bg-muted animate-pulse" />
      ) : heroMovie && !searchQuery && !selectedCategory ? (
        <div className="relative w-full h-[70vh] sm:h-[80vh] overflow-hidden">
          <div className="absolute inset-0">
            <img
              src={heroMovie.imageUrl || fallbackHeroImage}
              alt={heroMovie.title}
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-background via-background/60 to-transparent" />
            <div className="absolute inset-0 bg-gradient-to-t from-background via-background/20 to-transparent" />
          </div>

          <div className="relative h-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col justify-end pb-24 sm:pb-32">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, ease: "easeOut" }}
              className="max-w-2xl"
            >
              <h1 className="text-5xl sm:text-7xl font-black text-white mb-4 text-shadow-lg leading-tight" data-testid="text-hero-title">
                {heroMovie.title}
              </h1>
              <div className="flex items-center gap-4 mb-6 text-white/80 font-medium flex-wrap">
                {heroMovie.releaseYear && <span className="text-primary">{heroMovie.releaseYear}</span>}
                {heroMovie.category && <Badge variant="secondary" className="bg-white/10 text-white border-0">{heroMovie.category.name}</Badge>}
                {heroMovie.user?.firstName && <span>Qo'shgan: {heroMovie.user.firstName}</span>}
              </div>
              <p className="text-lg sm:text-xl text-white/90 mb-8 line-clamp-3 text-shadow-md" data-testid="text-hero-description">
                {heroMovie.description}
              </p>

              <div className="flex flex-wrap gap-4">
                <Link href={`/movie/${heroMovie.id}`} className="inline-flex items-center justify-center px-8 py-3 rounded-md bg-white text-black font-bold text-lg transition-colors shadow-lg shadow-black/20" data-testid="link-hero-play">
                  <Play className="w-6 h-6 mr-2 fill-black" />
                  Ko'rish
                </Link>
                <Link href={`/movie/${heroMovie.id}`} className="inline-flex items-center justify-center px-8 py-3 rounded-md bg-secondary/80 text-white font-bold text-lg transition-colors backdrop-blur-md" data-testid="link-hero-info">
                  <Info className="w-6 h-6 mr-2" />
                  Batafsil
                </Link>
              </div>
            </motion.div>
          </div>
        </div>
      ) : !isLoading && filteredMovies.length === 0 ? (
        <div className="w-full h-[60vh] flex items-center justify-center bg-gradient-to-b from-black to-background pt-20">
          <div className="text-center px-4">
            <Clapperboard className="w-20 h-20 mx-auto text-muted-foreground mb-6 opacity-50" />
            <h2 className="text-3xl font-bold text-white mb-4" data-testid="text-empty">
              {searchQuery || selectedCategory ? "Hech narsa topilmadi" : "Hozircha kinolar yo'q"}
            </h2>
            <p className="text-lg text-muted-foreground mb-8">
              {searchQuery || selectedCategory ? "Boshqa so'z bilan qidirib ko'ring" : "Birinchi bo'lib kino qo'shing!"}
            </p>
            {!isAuthenticated && !searchQuery && (
              <Link href="/login">
                <Button className="px-8 py-3 bg-primary text-white font-bold" data-testid="button-login-empty">
                  Kirish va qo'shish
                </Button>
              </Link>
            )}
          </div>
        </div>
      ) : null}

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 relative z-10 -mt-20">
        {categoriesList && categoriesList.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-8 mt-20 sm:mt-0">
            <Button
              variant={selectedCategory === null ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedCategory(null)}
              className={selectedCategory === null ? "bg-primary text-white" : "bg-transparent border-white/20 text-white"}
              data-testid="button-category-all"
            >
              Barchasi
            </Button>
            {categoriesList.map((cat) => (
              <Button
                key={cat.id}
                variant={selectedCategory === cat.id ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedCategory(selectedCategory === cat.id ? null : cat.id)}
                className={selectedCategory === cat.id ? "bg-primary text-white" : "bg-transparent border-white/20 text-white"}
                data-testid={`button-category-${cat.id}`}
              >
                {cat.name}
              </Button>
            ))}
          </div>
        )}

        {isLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 sm:gap-6 mt-20">
            {Array.from({ length: 10 }).map((_, i) => (
              <Skeleton key={i} className="aspect-[2/3] w-full rounded-md bg-muted" />
            ))}
          </div>
        ) : gridMovies.length > 0 || (searchQuery || selectedCategory) ? (
          <>
            <h2 className="text-2xl font-bold text-white mb-6" data-testid="text-section-title">
              {searchQuery ? `"${searchQuery}" qidiruv natijalari` : selectedCategory ? "Tanlangan kategoriya" : "Trendda"}
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 sm:gap-6">
              {(searchQuery || selectedCategory ? filteredMovies : gridMovies).map((movie, index) => (
                <MovieCard key={movie.id} movie={movie} index={index} />
              ))}
            </div>
          </>
        ) : null}
      </main>
    </div>
  );
}
