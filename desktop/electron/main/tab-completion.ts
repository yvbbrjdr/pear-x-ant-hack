import { EventEmitter } from "events";

import { Anthropic } from "@anthropic-ai/sdk";
import { MessageParam } from "@anthropic-ai/sdk/resources/messages";
import robot from "@hurdlegroup/robotjs";
import { GlobalKeyboardListener } from "node-global-key-listener";
import screenshot from "screenshot-desktop";
import { JinaSearch } from "./jina";

enum TabCompletionState {
  IDLE = "IDLE",
  OBSERVING = "OBSERVING",
  THINKING = "THINKING",
  SEARCHING = "SEARCHING",
  READY = "READY",
}

export class TabCompletion extends EventEmitter {
  state: TabCompletionState;
  jina: JinaSearch;
  anthropic: Anthropic;
  gkl: GlobalKeyboardListener;
  inputHistory: string[];
  observingTimeout: NodeJS.Timeout | null;
  tabPressed: boolean;
  tabCompletionText: string;
  ignoreNextKey: boolean;
  abortController: AbortController | null;

  constructor() {
    super();
    this.state = TabCompletionState.IDLE;
    this.jina = new JinaSearch({
      apiKey: process.env.JINA_API_KEY as string,
    });
    this.anthropic = new Anthropic();
    this.gkl = new GlobalKeyboardListener();
    this.inputHistory = [];
    this.observingTimeout = null;
    this.tabPressed = false;
    this.tabCompletionText = "";
    this.ignoreNextKey = false;
    this.abortController = null;
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
    if (this.abortController) {
      this.abortController.abort();
    }
    this.observingTimeout = setTimeout(() => {
      this.abortController = new AbortController();
      this.setThinking(this.abortController.signal);
    }, 1000);
    this.setState(TabCompletionState.OBSERVING);
  }

  async setThinking(abortSignal: AbortSignal) {
    try {
      this.setState(TabCompletionState.THINKING);
      const screenshot = await this.captureScreenshot();
      if (abortSignal.aborted) {
        return;
      }
      const messages: MessageParam[] = [
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
      ];
      const response = await this.anthropic.messages.create({
        model: "claude-3-7-sonnet-latest",
        messages,
        max_tokens: 4096,
        tools: [
          {
            name: "web_search",
            description: "Search the web for information",
            input_schema: {
              type: "object",
              properties: {
                query: {
                  type: "string",
                  description: "The query to search for",
                },
              },
              required: ["query"],
            },
          },
        ],
      });
      if (abortSignal.aborted) {
        return;
      }
      const rawOutput = response.content;
      if (rawOutput.length === 1 && rawOutput[0].type === "text") {
        this.tabCompletionText = rawOutput[0].text
          .split("<prediction>\n")[1]
          .split("\n</prediction>")[0];
      } else if (rawOutput.length > 1 && rawOutput[1].type === "tool_use") {
        const toolUse = rawOutput[1];
        const toolName = toolUse.name;
        const toolInput = toolUse.input;
        if (toolName === "web_search") {
          this.setSearching();
          messages.push({
            role: "assistant",
            content: rawOutput,
          });
          console.log("searching", (toolInput as { query: string }).query);
          const results = await this.jina.search(
            (toolInput as { query: string }).query,
          );
          if (abortSignal.aborted) {
            return;
          }
          messages.push({
            role: "user",
            content: [
              {
                type: "tool_result",
                tool_use_id: toolUse.id,
                content: JSON.stringify(results),
              },
            ],
          });
          const response = await this.anthropic.messages.create({
            model: "claude-3-7-sonnet-latest",
            messages,
            max_tokens: 4096,
          });
          if (abortSignal.aborted) {
            return;
          }
          const rawOutput2 = response.content[0];
          if (rawOutput2.type === "text") {
            this.tabCompletionText = rawOutput2.text
              .split("<prediction>\n")[1]
              .split("\n</prediction>")[0];
          }
        }
      }
      this.setReady();
    } catch (e) {
      console.error(e);
    }
  }

  setSearching() {
    this.setState(TabCompletionState.SEARCHING);
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

1. A screenshot of the user's current computer screen.

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

If you need to search the web for information, use the "web_search" tool before making your prediction. You will provide the predictions after the tool returns results. If you don't need to search the web, you can make your prediction without using the tool.

Provide your prediction in the following format:
<prediction>
[Your predicted next input here]
</prediction>

Remember to keep your prediction concise and relevant to the immediate context. If you're not confident in making a specific prediction based on the available information, it's acceptable to state that there's not enough context to make a reliable prediction.`;
  }

  async captureScreenshot() {
    const s = await screenshot({ format: "png" });
    return s.toString("base64");
  }
}

export const tabCompletion = new TabCompletion();
