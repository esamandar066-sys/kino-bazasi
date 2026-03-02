import { Link } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Search, X } from "lucide-react";
import { useEffect, useState } from "react";
import MovieFormDialog from "../movies/MovieFormDialog";

const ADMIN_ID = "1123019731";

interface NavbarProps {
  onSearch?: (query: string) => void;
}

export default function Navbar({ onSearch }: NavbarProps) {
  const { user } = useAuth();
  const isAdmin = user?.id === ADMIN_ID;
  const [isScrolled, setIsScrolled] = useState(false);
  const [isAddMovieOpen, setIsAddMovieOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSearch?.(searchQuery);
  };

  return (
    <header
      className={`fixed top-0 w-full z-50 transition-all duration-500 safe-area-top ${
        isScrolled
          ? "bg-black/80 backdrop-blur-xl shadow-2xl shadow-black/50 border-b border-white/5"
          : "bg-gradient-to-b from-black/90 via-black/40 to-transparent"
      }`}
    >
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 h-16 sm:h-20 flex items-center justify-between gap-2 sm:gap-4">
        <div className="flex items-center gap-3 sm:gap-8 flex-shrink-0">
          <Link
            href="/"
            className="hover:scale-105 transition-transform"
          >
            <span className="text-xl sm:text-2xl font-black tracking-widest uppercase bg-gradient-to-r from-primary via-red-400 to-primary bg-clip-text text-transparent" data-testid="text-logo">
              Kinolar
            </span>
          </Link>
        </div>

        {onSearch && !mobileSearchOpen && (
          <form onSubmit={handleSearchSubmit} className="flex-1 max-w-md mx-4 hidden md:block">
            <div className="relative group">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-white/40 group-focus-within:text-primary transition-colors" />
              <Input
                type="search"
                placeholder="Kino qidirish..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  onSearch(e.target.value);
                }}
                className="pl-10 bg-white/5 border-white/10 text-white placeholder:text-white/30 focus:bg-white/10 focus:border-primary/50 rounded-full transition-all"
                data-testid="input-search"
              />
            </div>
          </form>
        )}

        {mobileSearchOpen && onSearch && (
          <form onSubmit={handleSearchSubmit} className="flex-1 flex items-center gap-2 md:hidden">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-white/40" />
              <Input
                type="search"
                placeholder="Kino qidirish..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  onSearch(e.target.value);
                }}
                className="pl-10 bg-white/5 border-white/10 text-white placeholder:text-white/30 h-10 rounded-full"
                data-testid="input-search-mobile"
                autoFocus
              />
            </div>
            <button
              type="button"
              onClick={() => {
                setMobileSearchOpen(false);
                setSearchQuery("");
                onSearch("");
              }}
              className="text-white/70 p-2 hover:text-white transition-colors"
              data-testid="button-close-search"
            >
              <X className="w-5 h-5" />
            </button>
          </form>
        )}

        {!mobileSearchOpen && (
          <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
            {onSearch && (
              <button
                onClick={() => setMobileSearchOpen(true)}
                className="md:hidden text-white/70 p-2 hover:text-white transition-colors"
                data-testid="button-open-search"
              >
                <Search className="w-5 h-5" />
              </button>
            )}

            {isAdmin && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  className="hidden md:flex bg-primary/10 border-primary/30 text-primary hover:bg-primary hover:text-white transition-all duration-300"
                  onClick={() => setIsAddMovieOpen(true)}
                  data-testid="button-add-movie"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Kino qo'shish
                </Button>

                <Button
                  variant="ghost"
                  size="icon"
                  className="md:hidden text-primary hover:bg-primary/20"
                  onClick={() => setIsAddMovieOpen(true)}
                  data-testid="button-add-movie-mobile"
                >
                  <Plus className="w-5 h-5" />
                </Button>

                <MovieFormDialog
                  open={isAddMovieOpen}
                  onOpenChange={setIsAddMovieOpen}
                />
              </>
            )}
          </div>
        )}
      </div>
    </header>
  );
}
