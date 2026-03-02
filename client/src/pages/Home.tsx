import { useState, useMemo } from "react";
import { useMovies, useCategories } from "@/hooks/use-movies";
import MovieCard from "@/components/movies/MovieCard";
import Navbar from "@/components/layout/Navbar";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Play, Info, Clapperboard, Film } from "lucide-react";
import { Link } from "wouter";
import { motion } from "framer-motion";

export default function Home() {
  const { data: movies, isLoading, error } = useMovies();
  const { data: categoriesList } = useCategories();
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
      <div className="min-h-screen flex items-center justify-center text-foreground relative z-10">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-2" data-testid="text-error">Xatolik yuz berdi</h2>
          <p className="text-muted-foreground">{error.message}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen relative z-10">
      <Navbar onSearch={setSearchQuery} />

      {isLoading ? (
        <div className="w-full h-[70vh] sm:h-[80vh] bg-black/50 animate-pulse" />
      ) : heroMovie && !searchQuery && !selectedCategory ? (
        <div className="relative w-full h-[70vh] sm:h-[85vh] overflow-hidden">
          <div className="absolute inset-0">
            <img
              src={heroMovie.imageUrl || fallbackHeroImage}
              alt={heroMovie.title}
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-black via-black/70 to-transparent" />
            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/30 to-transparent" />
            <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-transparent to-transparent h-32" />
          </div>

          <div className="relative h-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col justify-end pb-28 sm:pb-36">
            <motion.div
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, ease: "easeOut" }}
              className="max-w-2xl"
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5, delay: 0.2 }}
                className="mb-4"
              >
                <Badge className="bg-primary/90 text-white border-0 px-3 py-1 text-sm font-semibold backdrop-blur-sm">
                  <Film className="w-3.5 h-3.5 mr-1.5" />
                  Tavsiya etilgan
                </Badge>
              </motion.div>

              <h1 className="text-4xl sm:text-6xl lg:text-7xl font-black text-white mb-4 text-shadow-lg leading-[1.1]" data-testid="text-hero-title">
                {heroMovie.title}
              </h1>
              <div className="flex items-center gap-3 sm:gap-4 mb-5 text-white/70 font-medium flex-wrap">
                {heroMovie.releaseYear && (
                  <span className="text-primary font-bold text-lg">{heroMovie.releaseYear}</span>
                )}
                {heroMovie.category && (
                  <Badge variant="secondary" className="bg-white/10 text-white/90 border-0 backdrop-blur-sm">
                    {heroMovie.category.name}
                  </Badge>
                )}
                {heroMovie.rating && heroMovie.rating > 0 && (
                  <span className="text-yellow-400 font-bold">{heroMovie.rating.toFixed(1)}</span>
                )}
              </div>
              <p className="text-base sm:text-lg text-white/80 mb-8 line-clamp-3 text-shadow-md leading-relaxed max-w-xl" data-testid="text-hero-description">
                {heroMovie.description}
              </p>

              <div className="flex flex-wrap gap-3">
                <Link href={`/movie/${heroMovie.id}`} className="inline-flex items-center justify-center px-7 py-3 rounded-lg bg-white text-black font-bold text-base transition-all shadow-xl shadow-black/30 hover:shadow-white/20 hover:scale-105 active:scale-95" data-testid="link-hero-play">
                  <Play className="w-5 h-5 mr-2 fill-black" />
                  Ko'rish
                </Link>
                <Link href={`/movie/${heroMovie.id}`} className="inline-flex items-center justify-center px-7 py-3 rounded-lg bg-white/10 text-white font-bold text-base transition-all backdrop-blur-md border border-white/10 hover:bg-white/20 hover:scale-105 active:scale-95" data-testid="link-hero-info">
                  <Info className="w-5 h-5 mr-2" />
                  Batafsil
                </Link>
              </div>
            </motion.div>
          </div>
        </div>
      ) : !isLoading && filteredMovies.length === 0 ? (
        <div className="w-full h-[70vh] flex items-center justify-center pt-20">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center px-4"
          >
            <div className="relative inline-block mb-6">
              <Clapperboard className="w-20 h-20 mx-auto text-white/20" />
              <div className="absolute inset-0 animate-ping opacity-20">
                <Clapperboard className="w-20 h-20 mx-auto text-primary" />
              </div>
            </div>
            <h2 className="text-3xl font-bold text-white mb-3" data-testid="text-empty">
              {searchQuery || selectedCategory ? "Hech narsa topilmadi" : "Hozircha kinolar yo'q"}
            </h2>
            <p className="text-lg text-white/50">
              {searchQuery || selectedCategory ? "Boshqa so'z bilan qidirib ko'ring" : "Tez orada yangi kinolar qo'shiladi!"}
            </p>
          </motion.div>
        </div>
      ) : null}

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 relative z-10 -mt-16 sm:-mt-20">
        {categoriesList && categoriesList.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="flex flex-wrap gap-2 mb-10 mt-16 sm:mt-0"
          >
            <Button
              variant={selectedCategory === null ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedCategory(null)}
              className={`rounded-full transition-all duration-300 ${
                selectedCategory === null
                  ? "bg-primary text-white shadow-lg shadow-primary/30"
                  : "bg-white/5 border-white/10 text-white/70 hover:bg-white/10 hover:text-white"
              }`}
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
                className={`rounded-full transition-all duration-300 ${
                  selectedCategory === cat.id
                    ? "bg-primary text-white shadow-lg shadow-primary/30"
                    : "bg-white/5 border-white/10 text-white/70 hover:bg-white/10 hover:text-white"
                }`}
                data-testid={`button-category-${cat.id}`}
              >
                {cat.name}
              </Button>
            ))}
          </motion.div>
        )}

        {isLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-5 mt-20">
            {Array.from({ length: 12 }).map((_, i) => (
              <Skeleton key={i} className="aspect-[2/3] w-full rounded-lg bg-white/5" />
            ))}
          </div>
        ) : gridMovies.length > 0 || (searchQuery || selectedCategory) ? (
          <>
            <h2 className="text-xl sm:text-2xl font-bold text-white mb-6 flex items-center gap-3" data-testid="text-section-title">
              <div className="w-1 h-6 bg-primary rounded-full" />
              {searchQuery ? `"${searchQuery}" qidiruv natijalari` : selectedCategory ? "Tanlangan kategoriya" : "Barcha kinolar"}
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-5">
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
