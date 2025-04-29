import { Ollama } from 'ollama'
import { readFile } from 'node:fs/promises'

const ollama = new Ollama()

const buffer = await readFile('./images/baseline_01.png')

performance.mark('start')
const stream = await ollama.generate({
  stream: true,

  model: 'gemma3:27b',
  prompt: `You are an AI assistant designed to help users auto-complete their current task on their computer. Your job is to analyze the current screenshot of the user's computer and their recent keystrokes to predict what the user wants to input next.

You will be provided with two pieces of information:

1. A screenshot of the user's current computer screen.

2. The user's recent keystrokes:
<keystrokes>
${JSON.stringify([
    'E', 'n', 'g', 'i', 'n', 'e', 'e', 'r', ' ',
  ])}
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

If you need to search the web for information, such as current events, news, or stock prices, use the "web_search" tool before making your prediction. You will provide the predictions after the tool returns results. For easy queries, you should never use the tool.

Provide your prediction in the following format:
<prediction>
[Your predicted next input here]
</prediction>

Remember to keep your prediction concise and relevant to the immediate context. If you're not confident in making a specific prediction based on the available information, it's acceptable to state that there's not enough context to make a reliable prediction.
`,
  images: [buffer]
})
performance.mark('end')
console.log(performance.measure('stream', 'start', 'end'))

performance.mark('start')
for await (const chunk of stream) {
  process.stdout.write(chunk.response)
}
console.log('done')
performance.mark('end')
console.log(performance.measure('stream', 'start', 'end'))