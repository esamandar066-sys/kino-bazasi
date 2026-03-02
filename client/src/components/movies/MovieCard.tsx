import { Link } from "wouter";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import { Badge } from "@/components/ui/badge";
import { PlayCircle, Star, Video } from "lucide-react";
import type { MovieResponse } from "@shared/schema";
import { motion } from "framer-motion";

interface MovieCardProps {
  movie: MovieResponse;
  index?: number;
}

export default function MovieCard({ movie, index = 0 }: MovieCardProps) {
  const fallbackImage = "https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=800&q=80";
  const imageUrl = movie.imageUrl || fallbackImage;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.04 }}
    >
      <Link href={`/movie/${movie.id}`} className="group block relative rounded-xl overflow-hidden bg-white/5 shadow-lg transition-all duration-500 hover:shadow-2xl hover:shadow-primary/10 hover:-translate-y-2 hover:ring-1 hover:ring-primary/30 cursor-pointer" data-testid={`card-movie-${movie.id}`}>
        <AspectRatio ratio={2 / 3} className="bg-black/50 overflow-hidden">
          <img
            src={imageUrl}
            alt={movie.title}
            className="w-full h-full object-cover transition-all duration-700 group-hover:scale-110 group-hover:brightness-110"
            loading="lazy"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/30 to-transparent opacity-70 group-hover:opacity-90 transition-opacity duration-300" />

          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 transform scale-50 group-hover:scale-100">
            <div className="w-14 h-14 rounded-full bg-primary/90 text-white flex items-center justify-center shadow-[0_0_40px_rgba(229,9,20,0.5)] backdrop-blur-sm ring-2 ring-white/20">
              <PlayCircle className="w-7 h-7 ml-0.5" />
            </div>
          </div>

          {movie.category && (
            <div className="absolute top-2 left-2">
              <Badge variant="secondary" className="bg-black/50 text-white/90 border-0 text-[10px] sm:text-xs backdrop-blur-md px-2 py-0.5" data-testid={`badge-category-${movie.id}`}>
                {movie.category.name}
              </Badge>
            </div>
          )}

          {movie.videoUrl && (
            <div className="absolute bottom-12 right-2">
              <Badge variant="secondary" className="bg-emerald-500/70 text-white border-0 text-[10px] backdrop-blur-sm px-1.5 py-0.5" data-testid={`badge-video-${movie.id}`}>
                <Video className="w-2.5 h-2.5 mr-0.5" />
                Video
              </Badge>
            </div>
          )}

          {movie.rating && movie.rating > 0 && (
            <div className="absolute top-2 right-2 flex items-center gap-1 bg-black/50 rounded-full px-2 py-1 backdrop-blur-md">
              <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
              <span className="text-[10px] sm:text-xs font-bold text-white" data-testid={`text-rating-${movie.id}`}>{movie.rating.toFixed(1)}</span>
            </div>
          )}

          <div className="absolute bottom-0 left-0 right-0 p-3 sm:p-4 transform translate-y-1 group-hover:translate-y-0 transition-transform duration-300">
            <h3 className="text-white font-bold text-sm sm:text-base leading-tight line-clamp-2 text-shadow-md" data-testid={`text-movie-title-${movie.id}`}>
              {movie.title}
            </h3>
            {movie.releaseYear && (
              <p className="text-primary/90 font-semibold text-xs sm:text-sm mt-1" data-testid={`text-movie-year-${movie.id}`}>{movie.releaseYear}</p>
            )}
          </div>
        </AspectRatio>
      </Link>
    </motion.div>
  );
}
