// Glass-box mode: ask every agent to say WHY before it acts, so the audience can follow its decisions.
// (This is the model's own explanation of its choice. It costs a few extra output tokens per turn.)
export const NARRATE =
  'Before you call any tool, first write ONE short sentence in the first person saying what you need and why ' +
  '(e.g. "I need real flight prices, so I will search flights for Dec 1."). Then make the call.';
