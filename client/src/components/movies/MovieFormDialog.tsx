import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertMovieSchema, type InsertMovie, type MovieResponse } from "@shared/schema";
import { useCreateMovie, useUpdateMovie } from "@/hooks/use-movies";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

interface MovieFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  movie?: MovieResponse; // If provided, we are editing
}

export default function MovieFormDialog({ open, onOpenChange, movie }: MovieFormDialogProps) {
  const { toast } = useToast();
  const createMutation = useCreateMovie();
  const updateMutation = useUpdateMovie();

  const isEditing = !!movie;
  const isPending = createMutation.isPending || updateMutation.isPending;

  const form = useForm<InsertMovie>({
    resolver: zodResolver(insertMovieSchema),
    defaultValues: {
      title: movie?.title || "",
      description: movie?.description || "",
      imageUrl: movie?.imageUrl || "",
      releaseYear: movie?.releaseYear || new Date().getFullYear(),
    },
  });

  const onSubmit = async (data: InsertMovie) => {
    try {
      if (isEditing && movie) {
        await updateMutation.mutateAsync({ id: movie.id, ...data });
        toast({ title: "Movie updated successfully!" });
      } else {
        await createMutation.mutateAsync(data);
        toast({ title: "Movie added successfully!" });
      }
      onOpenChange(false);
      form.reset();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Something went wrong.",
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={(val) => {
      onOpenChange(val);
      if (!val && !isEditing) form.reset();
    }}>
      <DialogContent className="sm:max-w-[500px] bg-card border-border shadow-2xl">
        <DialogHeader>
          <DialogTitle className="text-2xl" style={{ fontFamily: "var(--font-display)" }}>
            {isEditing ? "Edit Movie" : "Add New Movie"}
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            {isEditing ? "Update the details of your movie below." : "Fill in the details to add a new movie to the catalog."}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 mt-4">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-foreground">Title</FormLabel>
                  <FormControl>
                    <Input placeholder="Inception" className="bg-background border-border/50 focus:border-primary" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-foreground">Description</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="A thief who steals corporate secrets through the use of dream-sharing technology..."
                      className="bg-background border-border/50 focus:border-primary min-h-[100px] resize-none"
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="releaseYear"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-foreground">Release Year</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        placeholder="2010" 
                        className="bg-background border-border/50 focus:border-primary"
                        {...field} 
                        onChange={(e) => field.onChange(parseInt(e.target.value) || "")}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="imageUrl"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-foreground">Poster Image URL (Optional)</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="https://..." 
                        className="bg-background border-border/50 focus:border-primary"
                        {...field} 
                        value={field.value || ""}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-border/50">
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isPending} className="bg-primary hover:bg-primary/90 text-white min-w-[120px]">
                {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : (isEditing ? "Save Changes" : "Add Movie")}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
