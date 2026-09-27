import Anthropic from "@anthropic-ai/sdk";
import { requiredEnv } from "./env.server";

let client: Anthropic | null = null;

export function getAnthropicClient(): Anthropic {
  if (!client) {
    client = new Anthropic({ apiKey: requiredEnv("ANTHROPIC_API_KEY") });
  }
  return client;
}

export const HAIKU_MODEL = "claude-haiku-4-5";
