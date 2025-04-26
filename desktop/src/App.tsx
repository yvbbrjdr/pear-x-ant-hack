import {
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  useTransition,
} from "react";
import "./App.css";
import { Button } from "@/components/ui/button";
import { Eye, Loader, Search } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { TextShimmer } from "@/components/ui/text-shimmer";
import { cn } from "@/lib/utils";

enum TabCompletionState {
  IDLE = "IDLE",
  OBSERVING = "OBSERVING",
  THINKING = "THINKING",
  SEARCHING = "SEARCHING",
  READY = "READY",
}

let state: TabCompletionState = TabCompletionState.IDLE;

declare global {
  var _init: boolean;
}

if (!globalThis["_init"]) {
  globalThis["_init"] = true;
  window.ipcRenderer.on(
    "tab-completion-state-changed",
    (_, _state: "IDLE" | "OBSERVING" | "THINKING" | "SEARCHING" | "READY") => {
      state = _state as TabCompletionState;
    },
  );
}

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
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [isPending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement | null>(null);

  const search = (text: string) => {
    startTransition(async () => {
      await new Promise((resolve) => setTimeout(resolve, 2000));
    });
  };

  const placeholder = useMemo(() => {
    if (focused) {
      return "Ask something...";
    }
    switch (status) {
      case TabCompletionState.THINKING:
        return "Thinking...";
      case TabCompletionState.OBSERVING:
        return "Observing...";
      case TabCompletionState.SEARCHING:
        return "Searching...";
      case TabCompletionState.READY:
        return "Ready...";
      default:
        return "Ask something...";
    }
  }, [focused, status]);

  return (
    <div className="h-svh w-svw cursor-pointer">
      <div
        className="px-2 flex items-center gap-2 h-full relative"
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
      >
        <div className="absolute left-2 flex flex-row items-center gap-2 inset-0 pointer-events-none">
          <Button
            type="submit"
            size="icon"
            className="rounded-full drag-region cursor-pointer"
          >
            {isPending ? (
              <Loader className="animate-spin size-3.5" />
            ) : focused ? (
              <Search className="size-3.5" />
            ) : status === TabCompletionState.THINKING ? (
              <Loader className="animate-spin size-3.5" />
            ) : status === TabCompletionState.OBSERVING ? (
              <Eye className="size-3.5" />
            ) : status === TabCompletionState.SEARCHING ? (
              <Loader className="animate-spin size-3.5" />
            ) : status === TabCompletionState.READY ? (
              <Search className="size-3.5" />
            ) : (
              <Search className="size-3.5" />
            )}
          </Button>
          <motion.div
            animate={{
              scale: hovered ? 1 : 0.95,
            }}
            className={cn(
              "relative inline-block whitespace-nowrap",
              input.trim() !== "" && "hidden",
            )}
          >
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.div
                key={placeholder}
                initial="initial"
                animate="animate"
                exit="exit"
                variants={{
                  initial: { y: 20, opacity: 0 },
                  animate: { y: 0, opacity: 1 },
                  exit: { y: -20, opacity: 0 },
                }}
              >
                {isPending ? (
                  <TextShimmer>Generating...</TextShimmer>
                ) : focused ? (
                  placeholder
                ) : status === TabCompletionState.THINKING ||
                  status === TabCompletionState.SEARCHING ? (
                  <TextShimmer>{placeholder}</TextShimmer>
                ) : (
                  placeholder
                )}
              </motion.div>
            </AnimatePresence>
          </motion.div>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (inputRef.current) {
              inputRef.current.blur();
            }
            if (input.trim() === "") {
              return;
            }
            search(input);
            setInput("");
            setFocused(false);
          }}
        >
          <motion.input
            ref={inputRef}
            value={focused ? input : ""}
            onChange={(e) => setInput(e.target.value)}
            className="ml-10 h-full bg-transparent border-none shadow-none flex-1 focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:outline-none outline-none text-sm text-foreground placeholder:text-muted-foreground"
          />
        </form>
      </div>
    </div>
  );
}

export default App;
