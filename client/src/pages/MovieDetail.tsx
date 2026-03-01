import { useParams, useLocation } from "wouter";
import { useMovie, useDeleteMovie, useRateMovie } from "@/hooks/use-movies";
import { useAuth } from "@/hooks/use-auth";
import Navbar from "@/components/layout/Navbar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { ArrowLeft, Edit, Trash2, Calendar, User as UserIcon, Clock, Star } from "lucide-react";
import { useState } from "react";
import MovieFormDialog from "@/components/movies/MovieFormDialog";
import { useToast } from "@/hooks/use-toast";
import { motion } from "framer-motion";

export default function MovieDetail() {
  const { id } = useParams();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const { data: movie, isLoading, error } = useMovie(Number(id));
  const { user, isAuthenticated } = useAuth();
  const deleteMutation = useDeleteMovie();
  const rateMutation = useRateMovie();

  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [hoverRating, setHoverRating] = useState(0);

  const isOwner = user?.id === movie?.userId;

  const fallbackImage = "https://images.unsplash.com/photo-1550684848-fac1c5b4e853?w=1920&q=80";

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="w-full h-[60vh] bg-muted animate-pulse" />
        <div className="max-w-5xl mx-auto px-4 py-12">
          <Skeleton className="h-12 w-2/3 mb-4 bg-muted" />
          <Skeleton className="h-6 w-1/3 mb-8 bg-muted" />
          <Skeleton className="h-32 w-full bg-muted" />
        </div>
      </div>
    );
  }

  if (error || !movie) {
    return (
      <div className="min-h-screen bg-background text-foreground flex flex-col">
        <Navbar />
        <div className="flex-1 flex flex-col items-center justify-center">
          <h2 className="text-3xl font-bold mb-4" data-testid="text-not-found">Kino topilmadi</h2>
          <Button variant="outline" onClick={() => setLocation("/")} data-testid="button-go-home">Bosh sahifa</Button>
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
    if (!isAuthenticated) {
      toast({ title: "Baholash uchun tizimga kiring", variant: "destructive" });
      return;
    }
    try {
      await rateMutation.mutateAsync({ id: movie.id, score });
      toast({ title: `${score} yulduz bilan baholandi!` });
    } catch (err: any) {
      toast({ title: "Xatolik", description: err.message, variant: "destructive" });
    }
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <Navbar />

      <div className="relative w-full h-[50vh] sm:h-[60vh]">
        <div className="absolute inset-0">
          <img
            src={movie.imageUrl || fallbackImage}
            alt={movie.title}
            className="w-full h-full object-cover filter blur-[2px] opacity-60"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/80 to-transparent" />
        </div>

        <div className="absolute top-24 left-4 sm:left-8 z-10">
          <Button variant="ghost" className="text-white" onClick={() => setLocation("/")} data-testid="button-back">
            <ArrowLeft className="w-5 h-5 mr-2" />
            Orqaga
          </Button>
        </div>
      </div>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 -mt-32 sm:-mt-48 flex flex-col md:flex-row gap-8 lg:gap-12">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          className="w-48 sm:w-64 md:w-80 flex-shrink-0 mx-auto md:mx-0 rounded-xl overflow-hidden shadow-2xl shadow-black ring-1 ring-border/50"
        >
          <img
            src={movie.imageUrl || fallbackImage}
            alt={movie.title}
            className="w-full h-auto object-cover aspect-[2/3]"
          />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="flex-1 mt-4 md:mt-16"
        >
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-white mb-4 text-shadow-lg leading-tight" data-testid="text-movie-title">
            {movie.title}
          </h1>

          <div className="flex flex-wrap items-center gap-4 sm:gap-6 text-muted-foreground font-medium mb-6">
            {movie.releaseYear && (
              <div className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-primary" />
                <span className="text-white" data-testid="text-year">{movie.releaseYear}</span>
              </div>
            )}

            {movie.category && (
              <Badge variant="secondary" className="bg-primary/20 text-primary border-primary/30" data-testid="text-category">
                {movie.category.name}
              </Badge>
            )}

            <div className="flex items-center gap-2">
              <UserIcon className="w-5 h-5 text-primary" />
              <span className="text-white" data-testid="text-user">
                {movie.user?.firstName ? `${movie.user.firstName} ${movie.user.lastName || ''}` : 'Noma\'lum'}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-primary" />
              <span className="text-white" data-testid="text-date">Qo'shilgan: {new Date(movie.createdAt!).toLocaleDateString()}</span>
            </div>
          </div>

          {/* Rating display and interaction */}
          <div className="flex items-center gap-4 mb-8 p-4 bg-card/50 rounded-lg border border-border/50">
            <div className="flex items-center gap-1">
              <Star className="w-6 h-6 fill-yellow-400 text-yellow-400" />
              <span className="text-2xl font-bold text-white" data-testid="text-rating">
                {movie.rating ? movie.rating.toFixed(1) : "0.0"}
              </span>
              <span className="text-sm text-muted-foreground ml-1" data-testid="text-rating-count">
                ({movie.ratingCount || 0} baho)
              </span>
            </div>
            <div className="border-l border-border/50 pl-4">
              <p className="text-xs text-muted-foreground mb-1">Baholang:</p>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    onClick={() => handleRate(star)}
                    onMouseEnter={() => setHoverRating(star)}
                    onMouseLeave={() => setHoverRating(0)}
                    className="p-1 transition-transform hover:scale-110"
                    disabled={rateMutation.isPending}
                    data-testid={`button-rate-${star}`}
                  >
                    <Star
                      className={`w-5 h-5 transition-colors ${
                        star <= hoverRating
                          ? "fill-yellow-400 text-yellow-400"
                          : "text-muted-foreground"
                      }`}
                    />
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="prose prose-invert max-w-none">
            <h3 className="text-xl font-semibold text-white mb-2 border-l-4 border-primary pl-3">Kino haqida</h3>
            <p className="text-lg text-white/80 leading-relaxed bg-card/30 p-6 rounded-lg border border-border/50 shadow-inner" data-testid="text-description">
              {movie.description}
            </p>
          </div>

          {isOwner && (
            <div className="mt-12 flex items-center gap-4 pt-6 border-t border-border/50">
              <Button
                onClick={() => setIsEditDialogOpen(true)}
                className="bg-secondary text-white font-semibold"
                data-testid="button-edit"
              >
                <Edit className="w-4 h-4 mr-2" />
                Tahrirlash
              </Button>

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" className="font-semibold shadow-lg shadow-destructive/20" data-testid="button-delete">
                    <Trash2 className="w-4 h-4 mr-2" />
                    O'chirish
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent className="bg-card border-border">
                  <AlertDialogHeader>
                    <AlertDialogTitle className="text-xl font-bold">Bu kinoni o'chirasizmi?</AlertDialogTitle>
                    <AlertDialogDescription className="text-muted-foreground text-base">
                      Bu amalni qaytarib bo'lmaydi. "{movie.title}" butunlay o'chiriladi.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel className="border-border text-foreground" data-testid="button-cancel-delete">Bekor qilish</AlertDialogCancel>
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
