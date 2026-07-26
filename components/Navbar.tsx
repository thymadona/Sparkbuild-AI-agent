"use client";

import ThemeToggle from "./ThemeToggle";

interface NavbarProps {
  variant?: "marketing" | "app";
  userInitial?: string;
}

export default function Navbar({
  variant = "marketing",
  userInitial,
}: NavbarProps) {
  return (
    <header className="fixed top-0 z-50 w-full border-b border-surface-600/50 bg-surface-900/80 backdrop-blur-md">
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <a
          href={variant === "app" ? "/dashboard" : "/"}
          className="font-display text-xl font-bold text-fg-primary"
        >
          <span className="text-brand-600 dark:text-brand-400">Code</span>
          Builder
        </a>
        <div className="flex items-center gap-4 text-sm">
          {variant === "marketing" && (
            <>
              <a
                href="/lessons"
                className="text-fg-secondary hover:text-fg-primary transition-colors hidden sm:block"
              >
                Lessons
              </a>
              <a
                href="/explore"
                className="text-fg-secondary hover:text-fg-primary transition-colors hidden sm:block"
              >
                Explore
              </a>
              <ThemeToggle />
              <a
                href="/login"
                className="rounded-full bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600 transition-colors"
              >
                Sign in
              </a>
            </>
          )}
          {variant === "app" && (
            <>
              <a
                href="/lessons"
                className="text-fg-secondary hover:text-fg-primary transition-colors hidden sm:block"
              >
                Lessons
              </a>
              <a
                href="/explore"
                className="text-fg-secondary hover:text-fg-primary transition-colors hidden sm:block"
              >
                Explore
              </a>
              <ThemeToggle />
              {userInitial && (
                <a
                  href="/profile"
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-600 text-xs font-bold text-white hover:bg-brand-500 transition-colors"
                >
                  {userInitial}
                </a>
              )}
            </>
          )}
        </div>
      </nav>
    </header>
  );
}
