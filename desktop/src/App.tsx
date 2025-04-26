import { useMemo, useState, useSyncExternalStore } from "react";
import "./App.css";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader, Search, Sparkle } from "lucide-react";

enum TabCompletionState {
  IDLE = "IDLE",
  OBSERVING = "OBSERVING",
  THINKING = "THINKING",
  READY = "READY",
}

let state: TabCompletionState = TabCompletionState.IDLE;

window.ipcRenderer.on(
  "tab-completion-state-changed",
  (_, _state: "IDLE" | "OBSERVING" | "THINKING" | "READY") => {
    state = _state as TabCompletionState;
  },
);

export const useTabCompletionState = (): TabCompletionState => {
  return useSyncExternalStore(
    (onStoreChange) => {
      window.ipcRenderer.on("tab-completion-state-changed", onStoreChange);
      return () => {
        window.ipcRenderer.off("tab-completion-state-changed", onStoreChange);
      };
    },
    () => state,
  );
};

function App() {
  const status = useTabCompletionState();

  const [input, setInput] = useState("");
  const [focused, setFocused] = useState(false);

  const placeholder = useMemo(() => {
    switch (status) {
      case TabCompletionState.THINKING:
        return "Thinking...";
      case TabCompletionState.OBSERVING:
        return "Observing...";
      case TabCompletionState.READY:
        return "Ready...";
      default:
        return "Ask something...";
    }
  }, [focused, status]);

  return (
    <div className="h-svh w-svw relative cursor-pointer">
      <div className="px-2 flex items-center gap-2 h-full">
        <Button type="submit" size="icon" className="rounded-full drag-region">
          {status === TabCompletionState.THINKING ? (
            <Loader className="animate-spin size-3.5" />
          ) : status === TabCompletionState.OBSERVING ? (
            <Sparkle className="size-3.5" />
          ) : status === TabCompletionState.READY ? (
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
          placeholder={placeholder}
          className="bg-transparent border-none shadow-none flex-1 focus-visible:ring-0 focus-visible:ring-offset-0"
        />
      </div>
    </div>
  );
}

export default App;
