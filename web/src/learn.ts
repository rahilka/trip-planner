// The "📚 Learn" cheat sheet. Every concept gets:
//   - an everyday scene, mapped piece by piece to the AI terms (for everyone), and
//   - "you already know this": the closest thing developers already use, what's the same, and what's different.
// Kept in one file so it is easy to reword for a different audience.
import { reactive } from 'vue';

export interface Concept {
  id: string;
  icon: string;
  name: string;
  color: string;
  /** The everyday thing it is like (the headline). */
  like: string;
  likeIcon: string;
  /** What it really is, in plain words. */
  really: string;
  /** 🏠 A short real-life scene… */
  story: string;
  /** …and who's who in it: [the everyday thing, the AI term]. */
  mapping: [string, string][];
  /** 👩‍💻 The closest thing developers already know. */
  dev: {
    known: string;
    /** What you write today vs what it looks like with an agent (a few lines each). */
    before: string;
    after: string;
    same: string;
    different: string[];
    /** 🧪 One testing tip for QA (and everyone else). */
    qa: string;
  };
  /** Where to see it in this demo. */
  see: string;
  act?: number;
}

export interface Comparison {
  id: string;
  left: string; // concept ids
  right: string;
  tagline: string;
  /** 🏠 and 👩‍💻 rows come first: the everyday picture and the dev equivalent. */
  life: { left: string; right: string };
  devTerms: { left: string; right: string };
  rows: { label: string; left: string; right: string }[];
  /** One-sentence rule of thumb. */
  rule: string;
  see: string;
  act?: number;
}

export const CONCEPTS: Concept[] = [
  {
    id: 'model',
    icon: '🧠',
    name: 'Model (LLM)',
    color: 'var(--c-system)',
    likeIcon: '📞',
    like: 'A smart friend who answers from memory',
    really: 'The large language model (here: Claude). Text goes in, text comes out. On its own it can’t look anything up or do anything.',
    story:
      'You ask a smart friend: “How much is a flight from Skopje to Paris?” They answer right away: “About €150.” But they didn’t check anything. They answer from memory, so sometimes they are right and sometimes they are wrong.',
    mapping: [
      ['Your friend', 'The model'],
      ['Your question', 'The prompt'],
      ['Their answer', 'The response'],
      ['What they remember', 'What the model learned in training'],
      ['A wrong answer that sounds sure', 'A “hallucination”'],
    ],
    dev: {
      known: 'A stateless API call',
      before: `const res = await fetch('/api/answer', {
  method: 'POST',
  body: JSON.stringify({ question }),
});`,
      after: `const res = await claude.messages.create({
  model: 'claude-sonnet-5-5',
  messages: [{ role: 'user', content: question }],
});`,
      same: 'Request in, response out. Like HTTP, it’s stateless: it remembers nothing between calls, so you re-send the whole conversation every time.',
      different: [
        'The same input can give a different answer each time. It isn’t deterministic.',
        'It doesn’t look anything up. It generates text from what it learned in training.',
        'It can’t call anything by itself. It can only reply with text (or ask you to run a tool).',
      ],
      qa: 'Don’t assert on exact strings. Check the meaning (“mentions a price”, “stays under budget”), or have another model grade it.',
    },
    see: 'Act 1: the model plans the trip with no tools, so every price is a confident guess.',
    act: 1,
  },
  {
    id: 'agent',
    icon: '🤖',
    name: 'Agent',
    color: 'var(--accent)',
    likeIcon: '🧑‍💼',
    like: 'A travel agent at a desk',
    really: 'Agent = model + tools + a loop. Each turn the model either asks for a tool or says “I’m done”. Our code runs the tool and hands back the result. Think → Act → Observe, repeat.',
    story:
      'You go to a travel agent: “Paris, 4 days, €700.” They search for flights on the computer. One lands at 2 a.m., so they search another day. Then they call a hotel. Then they give you a plan. You never told them the steps. They decided each next step by themselves.',
    mapping: [
      ['You, at the counter', 'The user (and the prompt)'],
      ['The travel agent’s thinking', 'The model, deciding what to do next'],
      ['Their computer and phone', 'Tools'],
      ['Search → read → search again', 'The agent loop (Think → Act → Observe)'],
      ['“Here’s your plan”', 'The final answer (the loop stops)'],
    ],
    dev: {
      known: 'A normal program or web app',
      before: `// YOU decide the steps, in code:
const flights = await searchFlights(from, to);
const hotels  = await searchHotels(city);
return buildPlan(flights, hotels);`,
      after: `// The MODEL decides the steps, at runtime:
while (true) {
  const reply = await model(messages);
  if (reply.done) return reply.text;
  messages.push(await runTool(reply.toolCall));
}`,
      same: 'It’s still just code: a loop, some functions, an array of messages. No magic, no special runtime.',
      different: [
        'In a normal program you write the if/else and the order of calls. In an agent, the model is the if/else.',
        'The path can change from run to run (e.g. retry a different date when a search fails), and nobody coded that path.',
        'It stops when the model says “done”, not when the code reaches the end.',
      ],
      qa: 'Test the outcome (is the plan within budget?) and the path (did it call search_flights?). The exact steps may differ each run.',
    },
    see: 'Act 2: watch the loop in the top-left go round, one turn at a time.',
    act: 2,
  },
  {
    id: 'tool',
    icon: '🔧',
    name: 'Tool',
    color: 'var(--c-tool_use)',
    likeIcon: '📱',
    like: 'An app on your phone',
    really: 'A function in our code, described to the model with a name, a description and its inputs. The model asks for it; our code runs it and sends back the result.',
    story:
      'Your phone has apps: Weather, Maps, Calculator. You can only use the apps you have. Each app has a name and an icon, so you know what it does. If an app was called just “App 2”, you would not know when to open it.',
    mapping: [
      ['An app', 'A tool'],
      ['The app’s name and icon', 'The tool name + description'],
      ['Typing “Paris” in the Weather app', 'A tool_use request with inputs'],
      ['The forecast it shows you', 'The tool_result'],
    ],
    dev: {
      known: 'A JavaScript function',
      before: `// You call it directly:
const weather = await getWeather('Paris', '2026-12-01');`,
      after: `// You DESCRIBE it, and the model asks for it:
{ name: 'get_weather',
  description: 'Forecast for a city and date',
  input_schema: { city: 'string', date: 'string' } }
// model → { tool_use: 'get_weather', input: { city: 'Paris', … } }`,
      same: 'It IS a normal function: name, parameters, return value. You write and unit-test it as usual.',
      different: [
        'You don’t call it. The model decides if, when and with what arguments.',
        'The description is part of the code: the model only reads the name + description + schema, never the function body.',
        'Inputs come from the model, so validate them. Return errors as text (“no flights that day”) rather than throwing, so the model can react.',
      ],
      qa: 'Two kinds of test: the function itself (normal unit tests), and “does the model pick the right tool for this prompt?”',
    },
    see: 'Act 2: the agent asks for get_weather. See it light up in 🧰 Tools on the right.',
    act: 2,
  },
  {
    id: 'mcp',
    icon: '🔌',
    name: 'MCP server',
    color: 'var(--c-mcp)',
    likeIcon: '🔋',
    like: 'A USB-C charger',
    really: 'Model Context Protocol: a standard way for a separate program to offer tools. The agent connects, asks “what can you do?”, and gets a tool list back. Build it once; Claude Code, Claude Desktop and your own agent can all plug in.',
    story:
      'Today almost every phone and laptop uses USB-C. Your friend’s charger works with your phone, even if it’s a different brand. The phone maker and the charger maker never talked. They both follow the same standard.',
    mapping: [
      ['The USB-C standard', 'The MCP protocol'],
      ['A charger, headphones, a cable', 'MCP servers (travel data, GitHub, a database…)'],
      ['Your phone', 'The AI app / agent (the MCP client)'],
      ['Plug in, and it just works', 'Connect, get the tool list, use the tools'],
    ],
    dev: {
      known: 'A REST API with Swagger (OpenAPI) docs',
      before: `// Every API is different; you write glue per API:
const spec = await fetch('/openapi.json');
// read the docs → write a client → map the fields…`,
      after: `// One standard client for every MCP server:
const { tools } = await mcp.listTools();
// → search_flights, search_hotels, …
//   hand them straight to the model`,
      same: 'A separate service (own process, own language, own team) with a discoverable list of operations, like an API with its docs.',
      different: [
        'One standard for every AI app, so there’s no glue code per API. Like how LSP lets one TypeScript language server work in VS Code, WebStorm and Vim.',
        'The tool list is discovered at runtime and passed straight to the model.',
        'It often runs locally next to the app (over stdio), not just over HTTP.',
      ],
      qa: 'Test the server on its own: call each tool with good and bad inputs. MCP Inspector is a ready-made UI for this.',
    },
    see: 'Act 3: flights, hotels and activities come from the travel-data MCP server, a separate program.',
    act: 3,
  },
  {
    id: 'skill',
    icon: '📖',
    name: 'Skill',
    color: 'var(--c-skill)',
    likeIcon: '📕',
    like: 'A recipe book',
    really: 'A packaged set of instructions (a SKILL.md file). Only a one-line description sits in the prompt; the full text loads when the task needs it. It adds know-how, not new abilities.',
    story:
      'You don’t know every recipe by heart. You have a recipe book on the shelf. When you want to make a cake, you open the cake page and follow the steps. The rest of the time, the book stays closed on the shelf.',
    mapping: [
      ['The recipe book', 'A skill (SKILL.md)'],
      ['The title on the cover', 'The one-line description (always in the prompt)'],
      ['Opening the cake page', 'load_skill: the full text is loaded'],
      ['Following the steps', 'The agent using the skill’s rules'],
    ],
    dev: {
      known: 'Docs + lazy loading (import())',
      before: `// Code-splitting: load only when needed
const Charts = () => import('./Charts.vue');`,
      after: `// Only the description is always loaded:
skills: [{ name: 'budget-travel-playbook',
  description: 'Rules for planning a trip on a budget' }]
// the full SKILL.md is loaded when the model decides`,
      same: 'Load it only when needed, to keep things small. Exactly the idea behind lazy-loaded routes.',
      different: [
        'It’s instructions in plain English, not code. Think of a team style guide or a runbook.',
        'The model decides when to load it, based only on its one-line description.',
        'It doesn’t give new abilities. It makes the agent use the tools it has better.',
      ],
      qa: 'Run the same prompt with and without the skill and compare. Does the plan follow the playbook rules?',
    },
    see: 'Act 4: the agent reads the budget-travel-playbook before planning. See 📖 Skills.',
    act: 4,
  },
  {
    id: 'subagent',
    icon: '🤝',
    name: 'Subagent',
    color: 'var(--accent)',
    likeIcon: '🛒',
    like: 'Sending someone to the shop',
    really: 'Another agent with its own loop, its own tools and a fresh, empty memory. The main agent delegates a task and gets back only the final report, which keeps its own context small.',
    story:
      'You are cooking dinner and you need milk. You ask a family member: “Get milk and bread, under €5.” They go to the shop, look at the shelves, compare prices, and come back with the bag and the receipt. You don’t hear about every shelf. You just get the result.',
    mapping: [
      ['You, cooking', 'The main agent (the coordinator)'],
      ['The family member', 'A subagent (e.g. the Stay Finder)'],
      ['“Milk and bread, under €5”', 'The task you give it'],
      ['Walking around the shop', 'The subagent’s own loop (you don’t see it)'],
      ['The bag and the receipt', 'The short report that comes back'],
    ],
    dev: {
      known: 'A microservice or a background worker',
      before: `// Send a job, get a result back:
const result = await queue.run('find-hotels', {
  city: 'Paris', maxPrice: 80,
});`,
      after: `// Send a task in plain English:
delegate_task({
  agent: 'stay',
  task: 'Find hotels in Paris under €80/night',
}) // → a short written report`,
      same: 'A separate unit with its own state and its own job. You send a task and get a result; you don’t see its internals.',
      different: [
        'It’s an agent itself: it decides its own steps, instead of running fixed code.',
        'Task in and result out are plain English, not typed JSON.',
        'It starts with an empty memory: it only knows what you put in the task.',
      ],
      qa: 'Test each subagent alone with its own prompts, then test the coordinator’s hand-offs: did it give enough detail in the task?',
    },
    see: 'Act 5: a coordinator hands work to four specialists. See 🤝 Subagents.',
    act: 5,
  },
  {
    id: 'hook',
    icon: '🛡',
    name: 'Hook',
    color: 'var(--c-hook)',
    likeIcon: '💳',
    like: 'Your bank card’s limit',
    really: 'Code that runs before (or after) a tool call and can allow it, block it, or ask a human. A rule written in the prompt can be ignored; a hook cannot.',
    story:
      'Your bank card has rules. A small payment goes through. A big online payment sends a message to your phone: “Is this you? Approve?” A payment over your limit is declined. It doesn’t matter what you tell the cashier. The bank’s rule decides.',
    mapping: [
      ['Paying with the card', 'The agent calling a tool (book_trip)'],
      ['The bank’s rule', 'The hook (code, not a prompt)'],
      ['Small payment: goes through', 'allow'],
      ['“Is this you? Approve?”', 'ask, which shows the approval popup'],
      ['Over the limit: declined', 'block'],
    ],
    dev: {
      known: 'Middleware or a route guard',
      before: `// Vue Router: runs before every navigation
router.beforeEach((to) =>
  isLoggedIn() ? true : '/login');`,
      after: `// Runs before every tool call:
hooks.before('book_trip', (input) =>
  input.total > budget ? block('Over budget')
                       : ask('Book this trip?'));`,
      same: 'Exactly middleware: it runs before the action and can let it through, redirect it, or stop it. Also like a git pre-commit hook.',
      different: [
        'It guards what the model does, not what a user does.',
        'The model cannot skip it or change it. That is the whole point.',
        '“ask” pauses the whole agent until a human clicks Approve or Deny.',
      ],
      qa: 'Hooks are plain code, so they get plain unit tests: over budget → block; under budget → ask.',
    },
    see: 'Act 6: booking over budget is blocked by code, not by asking nicely.',
    act: 6,
  },
  {
    id: 'context',
    icon: '🗂',
    name: 'Context',
    color: 'var(--c-tool_result)',
    likeIcon: '🗒',
    like: 'Your desk',
    really: 'The context window: everything sent to the model on every turn, including instructions, tool descriptions, the conversation and every tool result. It has a size limit, and you pay for every token.',
    story:
      'You can only work with the papers that are on your desk right now. Your desk is not very big. If you put too many papers on it, you start to miss things. When it is full, you have to remove something before you can add more.',
    mapping: [
      ['Your desk', 'The context window'],
      ['The papers on it', 'Instructions, messages, tool results'],
      ['The size of the desk', 'The token limit'],
      ['Papers kept in a drawer until needed', 'Skills (loaded only when needed)'],
      ['Giving work to someone at another desk', 'Subagents (their own context)'],
    ],
    dev: {
      known: 'A request body with a size limit',
      before: `// The whole cart is re-sent on every request
POST /checkout
body: { items: [...everything] }  // max 1 MB`,
      after: `// The whole conversation, on EVERY turn
messages: [system, user, assistant,
           tool_result, tool_result, …]
// limit ≈ 200k tokens, billed per token`,
      same: 'Like a request payload: the server only knows what’s in it, and it has a size limit (think 413 Payload Too Large).',
      different: [
        'There’s no server-side session: every turn re-sends everything, and the history keeps growing.',
        'You pay per token, so a big tool result costs money on every turn after it.',
        'When it gets full, you have to trim or summarise, much like cache eviction.',
      ],
      qa: 'If the agent “forgets” something, check what was actually in the context. Click any box in the diagram to see it.',
    },
    see: 'Click any box in the diagram to see exactly what went in and came out.',
  },
];

export const COMPARISONS: Comparison[] = [
  {
    id: 'model-agent',
    left: 'model',
    right: 'agent',
    tagline: 'Answers vs gets things done',
    life: { left: 'A friend who answers from memory', right: 'A travel agent who searches, calls, and then answers' },
    devTerms: { left: 'One API call', right: 'A while-loop around API calls + functions' },
    rows: [
      { label: 'Can look things up?', left: 'No, it answers from memory', right: 'Yes, through tools' },
      { label: 'How many steps?', left: 'One answer, then it stops', right: 'Loops until the job is done' },
      { label: 'Who runs the steps?', left: 'Nobody', right: 'Our code: the model decides what, the code does it' },
    ],
    rule: 'Agent = model + tools + a loop.',
    see: 'Run Act 1, then Act 2, with the same prompt.',
    act: 2,
  },
  {
    id: 'tool-mcp',
    left: 'tool',
    right: 'mcp',
    tagline: 'Same tool, it just comes from somewhere else',
    life: { left: 'An old charger that fits only one phone', right: 'A USB-C charger that fits any phone' },
    devTerms: { left: 'A function in your codebase', right: 'A separate service with a standard, discoverable API' },
    rows: [
      { label: 'What the model sees', left: 'A name, a description, inputs', right: 'Exactly the same' },
      { label: 'Where the code lives', left: 'Inside your app', right: 'In a separate program, maybe by another team' },
      { label: 'Who can use it', left: 'Only your app', right: 'Any app that speaks MCP' },
      { label: 'Use it when…', left: 'It’s specific to this app and simple', right: 'You want to share it, or reuse one someone built (GitHub, Slack, a database…)' },
    ],
    rule: 'MCP is a way to deliver tools. To the model, an MCP tool is just a tool.',
    see: 'Act 3: get_weather is local and search_flights comes over MCP. In 🧰 Tools the only difference is the MCP tag.',
    act: 3,
  },
  {
    id: 'tool-skill',
    left: 'tool',
    right: 'skill',
    tagline: 'Does the job vs tells you how',
    life: { left: 'The oven: it does the cooking', right: 'The recipe: it tells you how to cook' },
    devTerms: { left: 'A function', right: 'The docs / style guide on how to use your functions' },
    rows: [
      { label: 'What it adds', left: 'A new ability (fetch prices, book)', right: 'Better judgment (split the budget, avoid late flights)' },
      { label: 'Runs code?', left: 'Yes, our code runs it', right: 'No, it’s text the model reads' },
      { label: 'Memory it uses', left: 'Its description is always there', right: 'Only one line, until it’s loaded' },
      { label: 'Use it when…', left: 'The agent needs data, or to change something', right: 'The agent can do the job but needs your playbook' },
    ],
    rule: 'Tools are hands; skills are know-how. A skill often says which tools to use, and how.',
    see: 'Act 4: compare the plan with and without the playbook.',
    act: 4,
  },
  {
    id: 'tool-subagent',
    left: 'tool',
    right: 'subagent',
    tagline: 'A button vs a helper',
    life: { left: 'Pressing “Start” on the microwave', right: 'Sending someone to do the shopping' },
    devTerms: { left: 'A function call', right: 'A job sent to a worker that has its own logic' },
    rows: [
      { label: 'Who does the work', left: 'Fixed code: same input, same output', right: 'Another model that thinks' },
      { label: 'Steps', left: 'One call', right: 'As many turns as it needs' },
      { label: 'Cost', left: 'Cheap and fast', right: 'More tokens and time' },
      { label: 'Use it when…', left: 'The job is one clear action', right: 'The job needs many steps and thinking, and you want to keep the main agent’s memory short' },
    ],
    rule: 'To the main agent, a subagent IS a tool (delegate_task). Behind that button is a whole agent.',
    see: 'Act 5: tick 🔍 Inside subagents to see each colleague’s own loop.',
    act: 5,
  },
  {
    id: 'hook-prompt',
    left: 'prompt-rule',
    right: 'hook',
    tagline: 'Asking nicely vs a hard limit',
    life: { left: 'A note on the fridge: “Don’t spend more than €100”', right: 'A bank card that declines anything over the limit' },
    devTerms: { left: 'A code comment: // never call with total > budget', right: 'An if that throws before the call' },
    rows: [
      { label: 'Who enforces it', left: 'The model (usually obeys)', right: 'Your code, every single time' },
      { label: 'Can it be broken?', left: 'Yes: if the user insists, or in an unusual case', right: 'No: the model cannot change it' },
      { label: 'Use it when…', left: 'It’s a preference or a style', right: 'It’s a must: money, safety, deleting, sending' },
    ],
    rule: 'If breaking the rule would cost money or trust, make it a hook.',
    see: 'Act 6: replay “budget hook” and “budget prompt only” to compare them.',
    act: 6,
  },
];

/** "A rule in the prompt" has no card of its own, but it appears in a comparison. */
const PROMPT_RULE = {
  id: 'prompt-rule',
  icon: '📝',
  name: 'Rule in the prompt',
  color: 'var(--c-wrong)',
  likeIcon: '🗒',
  like: 'A note on the fridge',
};

export const conceptById = (id: string): Pick<Concept, 'id' | 'icon' | 'name' | 'color' | 'likeIcon' | 'like'> =>
  CONCEPTS.find((c) => c.id === id) ?? PROMPT_RULE;

/** Which tab, card and lens the cheat sheet shows; any component can open it at a topic. */
export const learn = reactive({ open: false, tab: 'what' as 'what' | 'vs', topic: 'agent', lens: 'life' as 'life' | 'dev' });

export function openLearn(topic = learn.topic) {
  learn.tab = COMPARISONS.some((c) => c.id === topic) ? 'vs' : 'what';
  learn.topic = topic;
  learn.open = true;
}

/** The comparisons that involve a concept (to offer “how is it different from…?” links). */
export const comparisonsFor = (id: string) => COMPARISONS.filter((c) => c.left === id || c.right === id);
