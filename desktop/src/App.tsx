import { useEffect, useState } from "react";
import UpdateElectron from "@/components/update";
import logoVite from "./assets/logo-vite.svg";
import logoElectron from "./assets/logo-electron.svg";
import "./App.css";
import { cn } from "@/libs/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type AIStatus = "idle" | "thinking" | "generating" | "searching";

function App() {
  const [status, setStatus] = useState<AIStatus>("idle");
  const [input, setInput] = useState("");

  // Demo effect to cycle through statuses
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    // Demo: Set to thinking when input is submitted
    setStatus("thinking");
    console.log("User input:", input);
    setInput("");

    // Demo: Return to idle after 2 seconds
    setTimeout(() => setStatus("idle"), 2000);
  };

  const getStatusColor = () => {
    switch (status) {
      case "thinking":
        return "bg-amber-500";
      case "generating":
        return "bg-green-500";
      case "searching":
        return "bg-blue-500";
      default:
        return "bg-gray-500";
    }
  };

  return (
    <div className="h-svh w-svw relative">
      <div className="absolute top-0 left-4 flex items-center">
        <div
          className={cn("w-3 h-3 rounded-full mr-2", getStatusColor())}
        ></div>
        <p className="text-sm font-medium capitalize">
          {status === "idle" ? "Ready" : status}
        </p>
      </div>
    </div>
  );
}

export default App;
