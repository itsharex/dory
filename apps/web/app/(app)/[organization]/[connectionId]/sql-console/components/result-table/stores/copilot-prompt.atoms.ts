import { atom } from 'jotai';

export type CopilotPromptRequest = {
    id: string;
    prompt: string;
};

export const copilotPromptRequestAtom = atom<CopilotPromptRequest | null>(null);
