import { useEffect, useMemo, useState } from "react";
import "./App.css";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader, Search, Sparkle } from "lucide-react";

type AIStatus = "idle" | "thinking" | "generating" | "searching";

function App() {
  const [status, setStatus] = useState<AIStatus>("idle");

  useEffect(() => {
    const statuses: AIStatus[] = [
      "idle",
      "thinking",
      "generating",
      "searching",
    ];
    let currentIndex = 0;

    const interval = setInterval(() => {
      currentIndex = (currentIndex + 1) % statuses.length;
      setStatus(statuses[currentIndex]);
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  const [input, setInput] = useState("");
  const [focused, setFocused] = useState(false);

  const placeholder = useMemo(() => {
    switch (status) {
      case "thinking":
        return "Thinking...";
      case "generating":
        return "Generating...";
      case "searching":
        return "Searching...";
      default:
        return "Ask something...";
    }
  }, []);

  return (
    <div className="h-svh w-svw relative cursor-pointer">
      <div className="px-2 flex items-center gap-2 h-full">
        <Button type="submit" size="icon" className="rounded-full drag-region">
          {status === "thinking" ? (
            <Loader className="animate-spin size-3.5" />
          ) : status === "generating" ? (
            <Sparkle className="size-3.5" />
          ) : status === "searching" ? (
            <Search className="size-3.5" />
          ) : (
            <Search className="size-3.5" />
          )}
        </Button>
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder={focused ? "Asking anything" : placeholder}
          className="bg-transparent border-none shadow-none flex-1 focus-visible:ring-0 focus-visible:ring-offset-0"
        />
      </div>
    </div>
  );
}

export default App;
