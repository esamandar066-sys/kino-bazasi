import { Link } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Clapperboard, LogIn, LogOut, Plus, User as UserIcon, Search } from "lucide-react";
import { useEffect, useState } from "react";
import MovieFormDialog from "../movies/MovieFormDialog";

interface NavbarProps {
  onSearch?: (query: string) => void;
}

export default function Navbar({ onSearch }: NavbarProps) {
  const { user, isAuthenticated, logout } = useAuth();
  const [isScrolled, setIsScrolled] = useState(false);
  const [isAddMovieOpen, setIsAddMovieOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

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

  const displayName = user?.firstName || user?.phoneNumber || user?.email || "User";

  return (
    <header
      className={`fixed top-0 w-full z-50 transition-colors duration-300 ${
        isScrolled ? "bg-background/95 backdrop-blur-md shadow-lg shadow-black/50" : "bg-gradient-to-b from-black/80 to-transparent"
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between gap-4">
        <div className="flex items-center gap-8 flex-shrink-0">
          <Link
            href="/"
            className="flex items-center gap-2 text-primary hover:scale-105 transition-transform"
          >
            <Clapperboard className="w-8 h-8" />
            <span className="text-2xl font-black tracking-wider uppercase hidden sm:inline" data-testid="text-logo">
              Kinolar
            </span>
          </Link>
        </div>

        {onSearch && (
          <form onSubmit={handleSearchSubmit} className="flex-1 max-w-md mx-4 hidden md:block">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Kino qidirish..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  onSearch(e.target.value);
                }}
                className="pl-10 bg-white/10 border-white/20 text-white placeholder:text-white/50"
                data-testid="input-search"
              />
            </div>
          </form>
        )}

        <div className="flex items-center gap-4 flex-shrink-0">
          {isAuthenticated ? (
            <>
              <Button
                variant="outline"
                size="sm"
                className="hidden md:flex bg-transparent border-white/20 text-white"
                onClick={() => setIsAddMovieOpen(true)}
                data-testid="button-add-movie"
              >
                <Plus className="w-4 h-4 mr-2" />
                Kino qo'shish
              </Button>

              <MovieFormDialog
                open={isAddMovieOpen}
                onOpenChange={setIsAddMovieOpen}
              />

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="relative h-10 w-10 rounded-full p-0 ring-2 ring-transparent hover:ring-primary transition-all" data-testid="button-user-menu">
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={user?.profileImageUrl || undefined} alt={displayName} />
                      <AvatarFallback className="bg-primary/20 text-primary">
                        {displayName[0]?.toUpperCase() || <UserIcon className="w-5 h-5" />}
                      </AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56" align="end" forceMount>
                  <DropdownMenuLabel className="font-normal">
                    <div className="flex flex-col space-y-1">
                      <p className="text-sm font-medium leading-none text-foreground" data-testid="text-user-name">{displayName}</p>
                      <p className="text-xs leading-none text-muted-foreground" data-testid="text-user-info">{user?.email || user?.phoneNumber || ""}</p>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => setIsAddMovieOpen(true)} className="md:hidden" data-testid="menu-add-movie">
                    <Plus className="w-4 h-4 mr-2" />
                    Kino qo'shish
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => logout()} className="text-destructive focus:bg-destructive/10 cursor-pointer" data-testid="button-logout">
                    <LogOut className="w-4 h-4 mr-2" />
                    Chiqish
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          ) : (
            <Link href="/login">
              <Button className="bg-primary text-white font-semibold px-6 shadow-lg shadow-primary/25" data-testid="button-login">
                <LogIn className="w-4 h-4 mr-2" />
                Kirish
              </Button>
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
