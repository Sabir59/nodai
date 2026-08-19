import { useEffect, useState } from "react"
import { Moon, Sun } from "lucide-react"

import { Button } from "@/components/ui/button"

export function ThemeToggle() {
  const [isLight, setIsLight] = useState(false)

  useEffect(() => {
    setIsLight(document.documentElement.classList.contains("light"))
  }, [])

  function toggleTheme() {
    const next = !isLight
    document.documentElement.classList.toggle("light", next)
    localStorage.setItem("theme", next ? "light" : "dark")
    setIsLight(next)
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      onClick={toggleTheme}
      aria-label={isLight ? "Switch to dark theme" : "Switch to light theme"}
    >
      <span className="relative flex size-4 items-center justify-center">
        <Sun className="absolute size-4 scale-0 rotate-90 transition-transform duration-300 light:scale-100 light:rotate-0" />
        <Moon className="absolute size-4 scale-100 rotate-0 transition-transform duration-300 light:scale-0 light:-rotate-90" />
      </span>
    </Button>
  )
}
