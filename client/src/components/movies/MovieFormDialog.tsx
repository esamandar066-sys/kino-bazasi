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
import { Loader2, Upload, Video, X } from "lucide-react";
import { useState, useRef } from "react";

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
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isEditing = !!movie;
  const isPending = createMutation.isPending || updateMutation.isPending;

  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [videoFileName, setVideoFileName] = useState<string>("");

  const form = useForm<InsertMovie>({
    resolver: zodResolver(insertMovieSchema),
    defaultValues: {
      title: movie?.title || "",
      description: movie?.description || "",
      imageUrl: movie?.imageUrl || "",
      videoUrl: movie?.videoUrl || "",
      releaseYear: movie?.releaseYear || new Date().getFullYear(),
      categoryId: movie?.categoryId || undefined,
    },
  });

  const handleVideoUpload = async (file: File) => {
    setIsUploading(true);
    setUploadProgress(0);
    setVideoFileName(file.name);

    try {
      const formData = new FormData();
      formData.append("video", file);

      const xhr = new XMLHttpRequest();
      xhr.upload.addEventListener("progress", (e) => {
        if (e.lengthComputable) {
          setUploadProgress(Math.round((e.loaded / e.total) * 100));
        }
      });

      const result = await new Promise<{ videoUrl: string }>((resolve, reject) => {
        xhr.onload = () => {
          if (xhr.status === 200) {
            resolve(JSON.parse(xhr.responseText));
          } else {
            try {
              const err = JSON.parse(xhr.responseText);
              reject(new Error(err.message));
            } catch {
              reject(new Error("Video yuklashda xatolik"));
            }
          }
        };
        xhr.onerror = () => reject(new Error("Tarmoq xatosi"));
        xhr.open("POST", "/api/upload/video");
        xhr.withCredentials = true;
        xhr.send(formData);
      });

      form.setValue("videoUrl", result.videoUrl);
      toast({ title: "Video muvaffaqiyatli yuklandi!" });
    } catch (error: any) {
      toast({ title: "Xatolik", description: error.message, variant: "destructive" });
      setVideoFileName("");
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

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
      setVideoFileName("");
    } catch (error: any) {
      toast({
        title: "Xatolik",
        description: error.message || "Nimadir noto'g'ri ketdi.",
        variant: "destructive",
      });
    }
  };

  const currentVideoUrl = form.watch("videoUrl");

  return (
    <Dialog open={open} onOpenChange={(val) => {
      onOpenChange(val);
      if (!val && !isEditing) {
        form.reset();
        setVideoFileName("");
      }
    }}>
      <DialogContent className="sm:max-w-[500px] bg-card border-border shadow-2xl max-h-[90vh] overflow-y-auto">
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

            <div className="space-y-3">
              <FormField
                control={form.control}
                name="videoUrl"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-foreground">Video</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Video URL kiriting yoki fayl yuklang..."
                        className="bg-background border-border/50 focus:border-primary"
                        {...field}
                        value={field.value || ""}
                        data-testid="input-movie-video-url"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <input
                ref={fileInputRef}
                type="file"
                accept="video/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleVideoUpload(file);
                }}
                data-testid="input-video-file"
              />

              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1 border-dashed border-2 border-border/50"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                  data-testid="button-upload-video"
                >
                  {isUploading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Yuklanmoqda... {uploadProgress}%
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4 mr-2" />
                      Video fayl yuklash
                    </>
                  )}
                </Button>

                {currentVideoUrl && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      form.setValue("videoUrl", "");
                      setVideoFileName("");
                    }}
                    data-testid="button-remove-video"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                )}
              </div>

              {isUploading && (
                <div className="w-full bg-muted rounded-full h-2">
                  <div
                    className="bg-primary h-2 rounded-full transition-all duration-300"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              )}

              {(videoFileName || currentVideoUrl) && !isUploading && (
                <div className="flex items-center gap-2 text-sm text-green-400 bg-green-500/10 p-2 rounded-lg">
                  <Video className="w-4 h-4" />
                  <span data-testid="text-video-status">
                    {videoFileName || "Video mavjud"}
                  </span>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-border/50">
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} data-testid="button-cancel">
                Bekor qilish
              </Button>
              <Button type="submit" disabled={isPending || isUploading} className="bg-primary text-white min-w-[120px]" data-testid="button-submit-movie">
                {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : (isEditing ? "Saqlash" : "Qo'shish")}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
