import { useMovies } from "@/hooks/use-movies";
import { useAuth } from "@/hooks/use-auth";
import MovieCard from "@/components/movies/MovieCard";
import Navbar from "@/components/layout/Navbar";
import { Skeleton } from "@/components/ui/skeleton";
import { Play, Info, Clapperboard } from "lucide-react";
import { Link } from "wouter";
import { motion } from "framer-motion";

export default function Home() {
  const { data: movies, isLoading, error } = useMovies();
  const { isAuthenticated } = useAuth();

  const heroMovie = movies && movies.length > 0 ? movies[0] : null;
  const gridMovies = movies && movies.length > 0 ? movies.slice(1) : [];

  {/* dramatic cinema screen lighting abstract */}
  const fallbackHeroImage = "https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=1920&q=80";

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-foreground">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-2">Oops! Something went wrong.</h2>
          <p className="text-muted-foreground">{error.message}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      {isLoading ? (
        <div className="w-full h-[70vh] sm:h-[80vh] bg-muted animate-pulse" />
      ) : heroMovie ? (
        <div className="relative w-full h-[70vh] sm:h-[80vh] overflow-hidden">
          <div className="absolute inset-0">
            <img 
              src={heroMovie.imageUrl || fallbackHeroImage} 
              alt={heroMovie.title}
              className="w-full h-full object-cover"
            />
            {/* Dark wash for readability matching Netflix style */}
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
              <h1 className="text-5xl sm:text-7xl font-black text-white mb-4 text-shadow-lg leading-tight" style={{ fontFamily: "var(--font-display)" }}>
                {heroMovie.title}
              </h1>
              <div className="flex items-center gap-4 mb-6 text-white/80 font-medium">
                {heroMovie.releaseYear && <span className="text-primary">{heroMovie.releaseYear}</span>}
                {heroMovie.user?.firstName && <span>Added by {heroMovie.user.firstName}</span>}
              </div>
              <p className="text-lg sm:text-xl text-white/90 mb-8 line-clamp-3 text-shadow-md">
                {heroMovie.description}
              </p>
              
              <div className="flex flex-wrap gap-4">
                <Link href={`/movie/${heroMovie.id}`} className="inline-flex items-center justify-center px-8 py-3 rounded-md bg-white text-black font-bold text-lg hover:bg-white/80 transition-colors shadow-lg shadow-black/20">
                  <Play className="w-6 h-6 mr-2 fill-black" />
                  Play Now
                </Link>
                <Link href={`/movie/${heroMovie.id}`} className="inline-flex items-center justify-center px-8 py-3 rounded-md bg-secondary/80 text-white font-bold text-lg hover:bg-secondary transition-colors backdrop-blur-md">
                  <Info className="w-6 h-6 mr-2" />
                  More Info
                </Link>
              </div>
            </motion.div>
          </div>
        </div>
      ) : (
        <div className="w-full h-[60vh] flex items-center justify-center bg-gradient-to-b from-black to-background">
          <div className="text-center px-4">
            <Clapperboard className="w-20 h-20 mx-auto text-muted-foreground mb-6 opacity-50" />
            <h2 className="text-3xl font-bold text-white mb-4" style={{ fontFamily: "var(--font-display)" }}>No movies yet</h2>
            <p className="text-lg text-muted-foreground mb-8">Be the first to add a movie to the catalog.</p>
            {!isAuthenticated && (
              <button 
                onClick={() => window.location.href = '/api/login'}
                className="px-8 py-3 bg-primary text-white font-bold rounded-md hover:bg-primary/90 transition-colors"
              >
                Sign In to Add
              </button>
            )}
          </div>
        </div>
      )}

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 relative z-10 -mt-20">
        {isLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 sm:gap-6 mt-20">
            {Array.from({ length: 10 }).map((_, i) => (
              <Skeleton key={i} className="aspect-[2/3] w-full rounded-md bg-muted" />
            ))}
          </div>
        ) : gridMovies.length > 0 ? (
          <>
            <h2 className="text-2xl font-bold text-white mb-6" style={{ fontFamily: "var(--font-display)" }}>
              Trending Now
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 sm:gap-6">
              {gridMovies.map((movie, index) => (
                <MovieCard key={movie.id} movie={movie} index={index} />
              ))}
            </div>
          </>
        ) : null}
      </main>
    </div>
  );
}
