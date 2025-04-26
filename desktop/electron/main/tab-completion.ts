import { EventEmitter } from "events";

import { Anthropic } from "@anthropic-ai/sdk";
import { TextBlock } from "@anthropic-ai/sdk/resources/messages";

import { desktopCapturer, screen } from "electron";
import { GlobalKeyboardListener } from "node-global-key-listener";
import robot from "@hurdlegroup/robotjs";

enum TabCompletionState {
  IDLE = "IDLE",
  OBSERVING = "OBSERVING",
  THINKING = "THINKING",
  READY = "READY",
}

export class TabCompletion extends EventEmitter {
  state: TabCompletionState;
  anthropic: Anthropic;
  gkl: GlobalKeyboardListener;
  inputHistory: string[];
  observingTimeout: NodeJS.Timeout | null;
  tabPressed: boolean;
  tabCompletionText: string;
  ignoreNextKey: boolean;

  constructor() {
    super();
    this.state = TabCompletionState.IDLE;
    this.anthropic = new Anthropic();
    this.gkl = new GlobalKeyboardListener();
    this.inputHistory = [];
    this.observingTimeout = null;
    this.tabPressed = false;
    this.tabCompletionText = "";
    this.ignoreNextKey = false;
  }

  start() {
    this.gkl.addListener((e) => {
      if (this.ignoreNextKey) {
        return;
      }

      if (e.state === "DOWN") {
        if (e.name && !e.name.includes("MOUSE") && !e.name.includes("ALT")) {
          this.inputHistory.push(e.name);
          if (this.inputHistory.length > 100) {
            this.inputHistory.shift();
          }
        }

        if (
          e.name &&
          !e.name.includes("MOUSE") &&
          !e.name.includes("CTRL") &&
          !e.name.includes("SHIFT") &&
          !e.name.includes("ALT") &&
          !e.name.includes("META")
        ) {
          this.setObserving();
        }

        if (e.name !== "LEFT ALT") {
          this.tabPressed = false;
        }

        if (this.state === TabCompletionState.READY && e.name === "LEFT ALT") {
          if (this.tabPressed) {
            this.emit("tab-pressed", this.tabCompletionText);
            this.ignoreNextKey = true;
            robot.typeString(this.tabCompletionText);
            this.ignoreNextKey = false;
            this.tabPressed = false;
            this.tabCompletionText = "";
            this.setIdle();
          } else {
            this.tabPressed = true;
          }
        }
      }
    });
  }

  setIdle() {
    this.setState(TabCompletionState.IDLE);
  }

  setObserving() {
    if (this.observingTimeout) {
      clearTimeout(this.observingTimeout);
    }
    this.observingTimeout = setTimeout(() => {
      this.setThinking();
    }, 1000);
    this.setState(TabCompletionState.OBSERVING);
  }

  setThinking() {
    this.setState(TabCompletionState.THINKING);
    this.captureScreenshot()
      .then((screenshot) => {
        return this.anthropic.messages.create({
          model: "claude-3-7-sonnet-latest",
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "image",
                  source: {
                    type: "base64",
                    media_type: "image/png",
                    data: screenshot,
                  },
                },
                { type: "text", text: this.buildPrompt() },
              ],
            },
          ],
          max_tokens: 4096,
        });
      })
      .then((response) => {
        const rawOutput = (response.content[0] as TextBlock).text;
        this.tabCompletionText = rawOutput
          .split("<prediction>")[1]
          .split("</prediction>")[0]
          .trim();
        this.setReady();
      })
      .catch((error) => {
        console.error(error);
      });
  }

  setReady() {
    this.setState(TabCompletionState.READY);
  }

  setState(state: TabCompletionState) {
    this.state = state;
    this.emit("state-changed", state);
  }

  buildPrompt() {
    return `You are an AI assistant designed to help users auto-complete their current task on their computer. Your job is to analyze the current screenshot of the user's computer and their recent keystrokes to predict what the user wants to input next.

You will be provided with two pieces of information:

1. A screenshot of the user's current computer screen:
<screenshot>
Screenshot included in this message
</screenshot>

2. The user's recent keystrokes:
<keystrokes>
${JSON.stringify(this.inputHistory)}
</keystrokes>

First, carefully analyze the screenshot. Pay attention to:
- The active application or window
- Any text fields or areas where the user might be typing
- The context of the current task (e.g., writing an email, coding, filling out a form)
- Any relevant information displayed on the screen that might inform what the user is likely to type next

Next, examine the recent keystrokes. Consider:
- The words or partial words the user has just typed
- Any patterns or common phrases that might be emerging
- Whether the keystrokes suggest the user is in the middle of a word, at the end of a sentence, or starting a new line

Based on your analysis of both the screenshot and the recent keystrokes, predict what the user is most likely to input next. This could be:
- The completion of a partially typed word
- The next word in a sentence
- A common phrase or expression relevant to the context
- A suggested action based on the current task (e.g., "Send" for an email)

Provide your prediction in the following format:
<prediction>
[Your predicted next input here]
</prediction>

<reasoning>
[Explain your reasoning for this prediction, referencing specific elements from the screenshot and keystrokes that informed your decision]
</reasoning>

Remember to keep your prediction concise and relevant to the immediate context. If you're not confident in making a specific prediction based on the available information, it's acceptable to state that there's not enough context to make a reliable prediction.`;
  }

  async captureScreenshot() {
    try {
      const primaryDisplay = screen.getPrimaryDisplay();
      const { width, height } = primaryDisplay.workAreaSize;

      const sources = await desktopCapturer.getSources({
        types: ["screen"],
        thumbnailSize: { width, height },
      });

      const mainSource = sources[0];

      if (!mainSource) {
        throw new Error("No screen source found");
      }

      const screenshot = mainSource.thumbnail;

      const base64Image = screenshot.toPNG().toString("base64");

      return base64Image;
    } catch (error) {
      console.error("Error capturing screenshot:", error);
      throw error;
    }
  }
}

export const tabCompletion = new TabCompletion();
