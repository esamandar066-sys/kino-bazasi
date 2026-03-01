import { Link } from "wouter";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import { PlayCircle } from "lucide-react";
import type { MovieResponse } from "@shared/schema";
import { motion } from "framer-motion";

interface MovieCardProps {
  movie: MovieResponse;
  index?: number;
}

export default function MovieCard({ movie, index = 0 }: MovieCardProps) {
  // If no image is provided, use an atmospheric movie placeholder
  {/* dramatic cinematic dark empty theater placeholder */}
  const fallbackImage = "https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=800&q=80";
  const imageUrl = movie.imageUrl || fallbackImage;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.05 }}
    >
      <Link href={`/movie/${movie.id}`} className="group block relative rounded-md overflow-hidden bg-card border border-border/50 shadow-lg transition-all duration-300 hover:shadow-2xl hover:shadow-primary/20 hover:-translate-y-2 hover:border-primary/50 cursor-pointer">
        <AspectRatio ratio={2 / 3} className="bg-muted">
          <img
            src={imageUrl}
            alt={movie.title}
            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
            loading="lazy"
          />
          {/* Netflix style gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent opacity-80 group-hover:opacity-100 transition-opacity duration-300" />
          
          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 transform scale-50 group-hover:scale-100">
            <div className="w-16 h-16 rounded-full bg-primary/90 text-white flex items-center justify-center shadow-[0_0_30px_rgba(229,9,20,0.6)] backdrop-blur-sm">
              <PlayCircle className="w-8 h-8 ml-1" />
            </div>
          </div>

          <div className="absolute bottom-0 left-0 right-0 p-4 transform translate-y-2 group-hover:translate-y-0 transition-transform duration-300">
            <h3 className="text-white font-bold text-lg leading-tight line-clamp-2 text-shadow-md" style={{ fontFamily: "var(--font-display)" }}>
              {movie.title}
            </h3>
            {movie.releaseYear && (
              <p className="text-primary font-medium text-sm mt-1">{movie.releaseYear}</p>
            )}
          </div>
        </AspectRatio>
      </Link>
    </motion.div>
  );
}
