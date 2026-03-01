import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertMovieSchema, type InsertMovie, type MovieResponse } from "@shared/schema";
import { useCreateMovie, useUpdateMovie, useCategories } from "@/hooks/use-movies";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

interface MovieFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  movie?: MovieResponse;
}

export default function MovieFormDialog({ open, onOpenChange, movie }: MovieFormDialogProps) {
  const { toast } = useToast();
  const createMutation = useCreateMovie();
  const updateMutation = useUpdateMovie();
  const { data: categoriesList } = useCategories();

  const isEditing = !!movie;
  const isPending = createMutation.isPending || updateMutation.isPending;

  const form = useForm<InsertMovie>({
    resolver: zodResolver(insertMovieSchema),
    defaultValues: {
      title: movie?.title || "",
      description: movie?.description || "",
      imageUrl: movie?.imageUrl || "",
      releaseYear: movie?.releaseYear || new Date().getFullYear(),
      categoryId: movie?.categoryId || undefined,
    },
  });

  const onSubmit = async (data: InsertMovie) => {
    try {
      if (isEditing && movie) {
        await updateMutation.mutateAsync({ id: movie.id, ...data });
        toast({ title: "Kino yangilandi!" });
      } else {
        await createMutation.mutateAsync(data);
        toast({ title: "Kino qo'shildi!" });
      }
      onOpenChange(false);
      form.reset();
    } catch (error: any) {
      toast({
        title: "Xatolik",
        description: error.message || "Nimadir noto'g'ri ketdi.",
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
          <DialogTitle className="text-2xl">
            {isEditing ? "Kinoni tahrirlash" : "Yangi kino qo'shish"}
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            {isEditing ? "Kino ma'lumotlarini yangilang." : "Kino ma'lumotlarini kiriting."}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 mt-4">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-foreground">Nomi</FormLabel>
                  <FormControl>
                    <Input placeholder="Kino nomi" className="bg-background border-border/50 focus:border-primary" {...field} data-testid="input-movie-title" />
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
                  <FormLabel className="text-foreground">Tavsif</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Kino haqida qisqacha..."
                      className="bg-background border-border/50 focus:border-primary min-h-[100px] resize-none"
                      {...field}
                      data-testid="input-movie-description"
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
                    <FormLabel className="text-foreground">Yili</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        placeholder="2024"
                        className="bg-background border-border/50 focus:border-primary"
                        {...field}
                        onChange={(e) => field.onChange(parseInt(e.target.value) || "")}
                        data-testid="input-movie-year"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="categoryId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-foreground">Kategoriya</FormLabel>
                    <Select
                      onValueChange={(val) => field.onChange(val ? Number(val) : undefined)}
                      defaultValue={field.value ? String(field.value) : undefined}
                    >
                      <FormControl>
                        <SelectTrigger className="bg-background border-border/50 focus:border-primary" data-testid="select-category">
                          <SelectValue placeholder="Tanlang..." />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {categoriesList?.map((cat) => (
                          <SelectItem key={cat.id} value={String(cat.id)} data-testid={`option-category-${cat.id}`}>
                            {cat.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="imageUrl"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-foreground">Rasm URL (ixtiyoriy)</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="https://..."
                      className="bg-background border-border/50 focus:border-primary"
                      {...field}
                      value={field.value || ""}
                      data-testid="input-movie-image"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-3 pt-4 border-t border-border/50">
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} data-testid="button-cancel">
                Bekor qilish
              </Button>
              <Button type="submit" disabled={isPending} className="bg-primary text-white min-w-[120px]" data-testid="button-submit-movie">
                {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : (isEditing ? "Saqlash" : "Qo'shish")}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
