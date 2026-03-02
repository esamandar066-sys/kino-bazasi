import { useParams, useLocation } from "wouter";
import { useMovie, useDeleteMovie, useRateMovie, useEpisodes } from "@/hooks/use-movies";
import { useAuth } from "@/hooks/use-auth";
import Navbar from "@/components/layout/Navbar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { ArrowLeft, Edit, Trash2, Calendar, Clock, Star, Play, SkipBack, SkipForward } from "lucide-react";
import { useState, useEffect } from "react";
import MovieFormDialog from "@/components/movies/MovieFormDialog";
import { useToast } from "@/hooks/use-toast";
import { motion } from "framer-motion";

const ADMIN_ID = "1123019731";

export default function MovieDetail() {
  const { id } = useParams();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const movieId = Number(id);
  const { data: movie, isLoading, error } = useMovie(movieId);
  const { data: episodes = [] } = useEpisodes(movieId);
  const { user } = useAuth();
  const isAdmin = user?.id === ADMIN_ID;
  const deleteMutation = useDeleteMovie();
  const rateMutation = useRateMovie();

  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [hoverRating, setHoverRating] = useState(0);
  const [showVideo, setShowVideo] = useState(false);
  const [currentEpisodeIndex, setCurrentEpisodeIndex] = useState(0);

  const hasEpisodes = episodes.length > 0;
  const currentEpisode = hasEpisodes ? episodes[currentEpisodeIndex] : null;

  useEffect(() => {
    if (hasEpisodes) {
      setShowVideo(true);
    }
  }, [hasEpisodes]);

  const fallbackImage = "https://images.unsplash.com/photo-1550684848-fac1c5b4e853?w=1920&q=80";

  if (isLoading) {
    return (
      <div className="min-h-screen relative z-10">
        <Navbar />
        <div className="w-full h-[60vh] bg-black/50 animate-pulse" />
        <div className="max-w-5xl mx-auto px-4 py-12">
          <Skeleton className="h-12 w-2/3 mb-4 bg-white/5" />
          <Skeleton className="h-6 w-1/3 mb-8 bg-white/5" />
          <Skeleton className="h-32 w-full bg-white/5" />
        </div>
      </div>
    );
  }

  if (error || !movie) {
    return (
      <div className="min-h-screen text-foreground flex flex-col relative z-10">
        <Navbar />
        <div className="flex-1 flex flex-col items-center justify-center">
          <h2 className="text-3xl font-bold mb-4" data-testid="text-not-found">Kino topilmadi</h2>
          <Button variant="outline" onClick={() => setLocation("/")} className="border-white/20 text-white" data-testid="button-go-home">Bosh sahifa</Button>
        </div>
      </div>
    );
  }

  const handleDelete = async () => {
    try {
      await deleteMutation.mutateAsync(movie.id);
      toast({ title: "Kino o'chirildi" });
      setLocation("/");
    } catch (err: any) {
      toast({ title: "Xatolik", description: err.message, variant: "destructive" });
    }
  };

  const handleRate = async (score: number) => {
    try {
      await rateMutation.mutateAsync({ id: movie.id, score });
      toast({ title: `${score} yulduz bilan baholandi!` });
    } catch (err: any) {
      toast({ title: "Xatolik", description: err.message, variant: "destructive" });
    }
  };

  const activeVideoUrl = hasEpisodes ? currentEpisode!.videoUrl : movie.videoUrl;
  const hasVideo = !!activeVideoUrl;

  function getEmbedUrl(url: string): string | null {
    if (url.includes("youtube.com/watch")) {
      const id = new URL(url).searchParams.get("v");
      return id ? `https://www.youtube.com/embed/${id}?autoplay=1` : null;
    }
    if (url.includes("youtu.be/")) {
      const id = url.split("youtu.be/")[1]?.split("?")[0];
      return id ? `https://www.youtube.com/embed/${id}?autoplay=1` : null;
    }
    if (url.includes("vimeo.com/")) {
      const id = url.match(/vimeo\.com\/(\d+)/)?.[1];
      return id ? `https://player.vimeo.com/video/${id}?autoplay=1` : null;
    }
    if (url.includes("dailymotion.com/video/")) {
      const id = url.match(/video\/([a-zA-Z0-9]+)/)?.[1];
      return id ? `https://www.dailymotion.com/embed/video/${id}?autoplay=1` : null;
    }
    if (url.includes("drive.google.com")) {
      const id = url.match(/\/d\/([a-zA-Z0-9_-]+)/)?.[1]
        || url.match(/id=([a-zA-Z0-9_-]+)/)?.[1];
      return id ? `https://drive.google.com/file/d/${id}/preview` : null;
    }
    if (url.includes("ok.ru")) {
      const videoId = url.match(/\/video\/(\d+)/)?.[1];
      if (videoId) return `https://ok.ru/videoembed/${videoId}`;
      const embedMatch = url.match(/\/videoembed\/(\d+)/)?.[1];
      if (embedMatch) return url;
      return null;
    }
    if (url.includes("vk.com") || url.includes("vkvideo.ru")) {
      if (url.includes("/video_ext.php")) return url;
      const oidVideo = url.match(/video(-?\d+)_(\d+)/);
      if (oidVideo) return `https://vk.com/video_ext.php?oid=${oidVideo[1]}&id=${oidVideo[2]}`;
      return null;
    }
    if (url.includes("rutube.ru/video/")) {
      const id = url.match(/video\/([a-f0-9]+)/)?.[1];
      return id ? `https://rutube.ru/play/embed/${id}` : null;
    }
    if (url.includes("iframe") || url.includes("embed")) {
      return url;
    }
    return null;
  }

  const isLocalVideo = activeVideoUrl && activeVideoUrl.startsWith("/uploads/");
  const isDirectVideo = activeVideoUrl && (
    isLocalVideo ||
    activeVideoUrl.endsWith(".mp4") ||
    activeVideoUrl.endsWith(".webm") ||
    activeVideoUrl.endsWith(".ogg")
  );
  const embedUrl = activeVideoUrl ? getEmbedUrl(activeVideoUrl) : null;

  function renderVideoPlayer() {
    if (!activeVideoUrl) return null;
    if (isDirectVideo) {
      return (
        <video
          key={activeVideoUrl}
          controls
          autoPlay
          className="w-full max-h-[70vh]"
          data-testid="video-player"
        >
          <source src={activeVideoUrl} />
          Brauzeringiz video formatini qo'llab-quvvatlamaydi.
        </video>
      );
    }
    if (embedUrl) {
      return (
        <iframe
          key={activeVideoUrl}
          src={embedUrl}
          className="w-full aspect-video"
          allowFullScreen
          allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
          data-testid="video-iframe"
        />
      );
    }
    return (
      <iframe
        key={activeVideoUrl}
        src={activeVideoUrl}
        className="w-full aspect-video"
        allowFullScreen
        allow="autoplay; encrypted-media; fullscreen"
        referrerPolicy="no-referrer"
        data-testid="video-iframe-generic"
      />
    );
  }

  return (
    <div className="min-h-screen pb-20 relative z-10">
      <Navbar />

      <div className="relative w-full h-[50vh] sm:h-[65vh]">
        <div className="absolute inset-0">
          <img
            src={movie.imageUrl || fallbackImage}
            alt={movie.title}
            className="w-full h-full object-cover filter blur-sm"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/70 to-black/40" />
          <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-transparent to-black/40" />
        </div>

        <div className="absolute top-24 left-4 sm:left-8 z-10">
          <Button
            variant="ghost"
            className="text-white/80 hover:text-white hover:bg-white/10 rounded-full backdrop-blur-sm"
            onClick={() => setLocation("/")}
            data-testid="button-back"
          >
            <ArrowLeft className="w-5 h-5 mr-2" />
            Orqaga
          </Button>
        </div>

        {hasVideo && !showVideo && (
          <div className="absolute inset-0 flex items-center justify-center z-10">
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setShowVideo(true)}
              className="w-20 h-20 sm:w-24 sm:h-24 bg-primary/90 rounded-full flex items-center justify-center shadow-[0_0_60px_rgba(229,9,20,0.4)] ring-4 ring-white/10 backdrop-blur-sm"
              data-testid="button-play-video"
            >
              <Play className="w-10 h-10 sm:w-12 sm:h-12 text-white fill-white ml-1" />
            </motion.button>
          </div>
        )}
      </div>

      {showVideo && hasVideo && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 -mt-32 sm:-mt-48 relative z-20 mb-8"
        >
          <div className="bg-black rounded-2xl overflow-hidden shadow-2xl ring-1 ring-white/10">
            <div className="relative">
              {!hasEpisodes && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="absolute top-3 right-3 z-30 text-white bg-black/50 hover:bg-black/70 rounded-full backdrop-blur-sm"
                  onClick={() => setShowVideo(false)}
                  data-testid="button-close-video"
                >
                  Yopish
                </Button>
              )}
              {renderVideoPlayer()}
            </div>
          </div>

          {hasEpisodes && (
            <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
              <Button
                variant="ghost"
                className="text-white/80 border border-white/10 rounded-lg"
                disabled={currentEpisodeIndex === 0}
                onClick={() => setCurrentEpisodeIndex((i) => i - 1)}
                data-testid="button-prev-episode"
              >
                <SkipBack className="w-4 h-4 mr-2" />
                Oldingi qism
              </Button>
              <span className="text-white font-semibold text-sm px-4 py-2 bg-white/5 rounded-lg border border-white/10" data-testid="text-episode-info">
                {currentEpisodeIndex + 1} / {episodes.length}-qism
              </span>
              <Button
                variant="ghost"
                className="text-white/80 border border-white/10 rounded-lg"
                disabled={currentEpisodeIndex === episodes.length - 1}
                onClick={() => setCurrentEpisodeIndex((i) => i + 1)}
                data-testid="button-next-episode"
              >
                Keyingi qism
                <SkipForward className="w-4 h-4 ml-2" />
              </Button>
            </div>
          )}

          {hasEpisodes && (
            <div className="mt-4 max-h-64 overflow-y-auto rounded-xl border border-white/10 bg-white/5 backdrop-blur-sm" data-testid="episode-list">
              <div className="p-2 flex flex-col gap-1">
                {episodes.map((ep, idx) => (
                  <motion.button
                    key={ep.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.03 }}
                    onClick={() => setCurrentEpisodeIndex(idx)}
                    className={`w-full text-left px-4 py-3 rounded-lg flex items-center gap-3 transition-colors ${
                      idx === currentEpisodeIndex
                        ? "bg-primary/20 text-white border border-primary/30"
                        : "text-white/70 hover-elevate"
                    }`}
                    data-testid={`episode-item-${ep.id}`}
                  >
                    <span className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                      idx === currentEpisodeIndex ? "bg-primary text-white" : "bg-white/10 text-white/50"
                    }`}>
                      {ep.episodeNumber}
                    </span>
                    <span className="truncate text-sm font-medium">
                      {ep.title || `${ep.episodeNumber}-qism`}
                    </span>
                    {idx === currentEpisodeIndex && (
                      <Play className="w-4 h-4 ml-auto flex-shrink-0 text-primary fill-primary" />
                    )}
                  </motion.button>
                ))}
              </div>
            </div>
          )}
        </motion.div>
      )}

      <main className={`max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 ${showVideo ? '' : '-mt-32 sm:-mt-48'} flex flex-col md:flex-row gap-8 lg:gap-12`}>
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          className="w-48 sm:w-64 md:w-80 flex-shrink-0 mx-auto md:mx-0 rounded-2xl overflow-hidden shadow-2xl shadow-black ring-1 ring-white/10 relative group"
        >
          <img
            src={movie.imageUrl || fallbackImage}
            alt={movie.title}
            className="w-full h-auto object-cover aspect-[2/3]"
          />
          {hasVideo && (
            <div
              className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer rounded-2xl"
              onClick={() => setShowVideo(true)}
            >
              <Play className="w-12 h-12 text-white fill-white" />
            </div>
          )}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="flex-1 mt-4 md:mt-16"
        >
          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black text-white mb-4 text-shadow-lg leading-tight" data-testid="text-movie-title">
            {movie.title}
          </h1>

          <div className="flex flex-wrap items-center gap-3 sm:gap-5 text-white/60 font-medium mb-6">
            {movie.releaseYear && (
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-primary" />
                <span className="text-white" data-testid="text-year">{movie.releaseYear}</span>
              </div>
            )}

            {movie.category && (
              <Badge variant="secondary" className="bg-primary/15 text-primary border-primary/20 backdrop-blur-sm" data-testid="text-category">
                {movie.category.name}
              </Badge>
            )}

            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-primary" />
              <span className="text-white/80 text-sm" data-testid="text-date">{new Date(movie.createdAt!).toLocaleDateString()}</span>
            </div>

            {hasVideo && (
              <Badge variant="secondary" className="bg-emerald-500/15 text-emerald-400 border-emerald-500/20" data-testid="badge-has-video">
                <Play className="w-3 h-3 mr-1" />
                Video mavjud
              </Badge>
            )}
          </div>

          {hasVideo && !showVideo && (
            <Button
              onClick={() => setShowVideo(true)}
              className="mb-6 bg-primary text-white font-semibold rounded-lg shadow-lg shadow-primary/20 hover:shadow-primary/40 transition-all hover:scale-105 active:scale-95"
              data-testid="button-watch-video"
            >
              <Play className="w-5 h-5 mr-2 fill-white" />
              Kinoni ko'rish
            </Button>
          )}

          <div className="flex items-center gap-4 mb-8 p-4 bg-white/5 rounded-xl border border-white/10 backdrop-blur-sm">
            <div className="flex items-center gap-2">
              <Star className="w-6 h-6 fill-yellow-400 text-yellow-400" />
              <span className="text-2xl font-bold text-white" data-testid="text-rating">
                {movie.rating ? movie.rating.toFixed(1) : "0.0"}
              </span>
              <span className="text-sm text-white/40 ml-1" data-testid="text-rating-count">
                ({movie.ratingCount || 0} baho)
              </span>
            </div>
            <div className="border-l border-white/10 pl-4">
              <p className="text-xs text-white/40 mb-1">Baholang:</p>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    onClick={() => handleRate(star)}
                    onMouseEnter={() => setHoverRating(star)}
                    onMouseLeave={() => setHoverRating(0)}
                    className="p-1 transition-all hover:scale-125"
                    disabled={rateMutation.isPending}
                    data-testid={`button-rate-${star}`}
                  >
                    <Star
                      className={`w-5 h-5 transition-colors ${
                        star <= hoverRating
                          ? "fill-yellow-400 text-yellow-400"
                          : "text-white/20"
                      }`}
                    />
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="prose prose-invert max-w-none">
            <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
              <div className="w-1 h-5 bg-primary rounded-full" />
              Kino haqida
            </h3>
            <p className="text-base text-white/70 leading-relaxed bg-white/5 p-5 sm:p-6 rounded-xl border border-white/5" data-testid="text-description">
              {movie.description}
            </p>
          </div>

          {isAdmin && (
            <div className="mt-10 flex items-center gap-3 pt-6 border-t border-white/10">
              <Button
                onClick={() => setIsEditDialogOpen(true)}
                className="bg-white/10 text-white font-semibold border border-white/10 hover:bg-white/20 rounded-lg"
                data-testid="button-edit"
              >
                <Edit className="w-4 h-4 mr-2" />
                Tahrirlash
              </Button>

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" className="font-semibold shadow-lg shadow-red-900/20 rounded-lg" data-testid="button-delete">
                    <Trash2 className="w-4 h-4 mr-2" />
                    O'chirish
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent className="bg-card border-white/10">
                  <AlertDialogHeader>
                    <AlertDialogTitle className="text-xl font-bold">Bu kinoni o'chirasizmi?</AlertDialogTitle>
                    <AlertDialogDescription className="text-white/50 text-base">
                      Bu amalni qaytarib bo'lmaydi. "{movie.title}" butunlay o'chiriladi.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel className="border-white/10 text-white" data-testid="button-cancel-delete">Bekor qilish</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleDelete}
                      className="bg-destructive text-destructive-foreground"
                      data-testid="button-confirm-delete"
                    >
                      O'chirish
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          )}
        </motion.div>
      </main>

      <MovieFormDialog
        open={isEditDialogOpen}
        onOpenChange={setIsEditDialogOpen}
        movie={movie}
      />
    </div>
  );
}
