import { useParams, useLocation } from "wouter";
import { useMovie, useDeleteMovie } from "@/hooks/use-movies";
import { useAuth } from "@/hooks/use-auth";
import Navbar from "@/components/layout/Navbar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { ArrowLeft, Edit, Trash2, Calendar, User as UserIcon, Clock } from "lucide-react";
import { useState } from "react";
import MovieFormDialog from "@/components/movies/MovieFormDialog";
import { useToast } from "@/hooks/use-toast";
import { motion } from "framer-motion";

export default function MovieDetail() {
  const { id } = useParams();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  
  const { data: movie, isLoading, error } = useMovie(Number(id));
  const { user } = useAuth();
  const deleteMutation = useDeleteMovie();
  
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);

  // Use the sub claim id for comparison since the backend schema uses string user_id
  const isOwner = user?.id === movie?.userId || (user as any)?.claims?.sub === movie?.userId;

  {/* dramatic dark abstract pattern placeholder */}
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
          <h2 className="text-3xl font-bold mb-4">Movie Not Found</h2>
          <Button variant="outline" onClick={() => setLocation("/")}>Go Back Home</Button>
        </div>
      </div>
    );
  }

  const handleDelete = async () => {
    try {
      await deleteMutation.mutateAsync(movie.id);
      toast({ title: "Movie deleted successfully" });
      setLocation("/");
    } catch (err: any) {
      toast({ title: "Failed to delete", description: err.message, variant: "destructive" });
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
          <Button variant="ghost" className="text-white hover:bg-white/20" onClick={() => setLocation("/")}>
            <ArrowLeft className="w-5 h-5 mr-2" />
            Back to Browse
          </Button>
        </div>
      </div>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 -mt-32 sm:-mt-48 flex flex-col md:flex-row gap-8 lg:gap-12">
        {/* Poster */}
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

        {/* Details */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="flex-1 mt-4 md:mt-16"
        >
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-white mb-4 text-shadow-lg leading-tight" style={{ fontFamily: "var(--font-display)" }}>
            {movie.title}
          </h1>
          
          <div className="flex flex-wrap items-center gap-4 sm:gap-6 text-muted-foreground font-medium mb-8">
            {movie.releaseYear && (
              <div className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-primary" />
                <span className="text-white">{movie.releaseYear}</span>
              </div>
            )}
            
            <div className="flex items-center gap-2">
              <UserIcon className="w-5 h-5 text-primary" />
              <span className="text-white">
                {movie.user?.firstName ? `${movie.user.firstName} ${movie.user.lastName || ''}` : 'Unknown User'}
              </span>
            </div>
            
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-primary" />
              <span className="text-white">Added {new Date(movie.createdAt!).toLocaleDateString()}</span>
            </div>
          </div>

          <div className="prose prose-invert max-w-none">
            <h3 className="text-xl font-semibold text-white mb-2 border-l-4 border-primary pl-3">Synopsis</h3>
            <p className="text-lg text-white/80 leading-relaxed bg-card/30 p-6 rounded-lg border border-border/50 shadow-inner">
              {movie.description}
            </p>
          </div>

          {/* Owner Actions */}
          {isOwner && (
            <div className="mt-12 flex items-center gap-4 pt-6 border-t border-border/50">
              <Button 
                onClick={() => setIsEditDialogOpen(true)}
                className="bg-secondary text-white hover:bg-secondary/80 font-semibold"
              >
                <Edit className="w-4 h-4 mr-2" />
                Edit Movie
              </Button>
              
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" className="font-semibold shadow-lg shadow-destructive/20">
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent className="bg-card border-border">
                  <AlertDialogHeader>
                    <AlertDialogTitle className="text-xl font-bold" style={{ fontFamily: "var(--font-display)" }}>Delete this movie?</AlertDialogTitle>
                    <AlertDialogDescription className="text-muted-foreground text-base">
                      This action cannot be undone. This will permanently delete "{movie.title}" from the catalog.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel className="hover:bg-muted border-border text-foreground">Cancel</AlertDialogCancel>
                    <AlertDialogAction 
                      onClick={handleDelete}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      Delete Forever
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          )}
        </motion.div>
      </main>

      {/* Edit Dialog */}
      <MovieFormDialog 
        open={isEditDialogOpen} 
        onOpenChange={setIsEditDialogOpen}
        movie={movie}
      />
    </div>
  );
}
