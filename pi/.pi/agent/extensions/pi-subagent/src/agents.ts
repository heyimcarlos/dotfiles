import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { AGENT_NAMES, type AgentName, type BuiltInAgent } from "./types.ts";

const EXT_DIR = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const AGENTS_DIR = path.join(EXT_DIR, "agents");

type FrontmatterValue = string | undefined;
type Frontmatter = Record<string, FrontmatterValue>;

export interface FrontmatterBlock {
  frontmatter: Frontmatter;
  body: string;
}

function parseTools(raw: unknown): string[] {
  if (typeof raw !== "string") return [];
  return raw.split(",").map((tool) => tool.trim()).filter(Boolean);
}

export function parseFrontmatterBlock(content: string): FrontmatterBlock {
  if (!content.startsWith("---")) return { frontmatter: {}, body: content };
  const end = content.indexOf("\n---", 3);
  if (end === -1) return { frontmatter: {}, body: content };
  const raw = content.slice(3, end).trim();
  const body = content.slice(end + "\n---".length).replace(/^\r?\n/, "");
  const frontmatter: Frontmatter = {};
  for (const line of raw.split(/\r?\n/)) {
    const idx = line.indexOf(":");
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    const value = line.slice(idx + 1).trim();
    if (key) frontmatter[key] = value;
  }
  return { frontmatter, body };
}

export function loadBuiltInAgents(agentsDir = AGENTS_DIR): Map<AgentName, BuiltInAgent> {
  const agents = new Map<AgentName, BuiltInAgent>();
  for (const name of AGENT_NAMES) {
    const filePath = path.join(agentsDir, `${name}.md`);
    const content = fs.readFileSync(filePath, "utf8");
    const { frontmatter, body } = parseFrontmatterBlock(content);
    const agentName = typeof frontmatter.name === "string" ? frontmatter.name.trim() : name;
    if (agentName !== name) {
      throw new Error(`Built-in agent file ${filePath} declares name ${agentName}, expected ${name}`);
    }
    agents.set(name, {
      name,
      description: typeof frontmatter.description === "string" ? frontmatter.description.trim() : "",
      tools: parseTools(frontmatter.tools),
      // Optional model/thinking frontmatter lets a role pin a child model later
      // without changing the extension API or the tool schema.
      model: typeof frontmatter.model === "string" && frontmatter.model.trim() ? frontmatter.model.trim() : undefined,
      thinking: typeof frontmatter.thinking === "string" && frontmatter.thinking.trim() ? frontmatter.thinking.trim() : undefined,
      systemPrompt: body.trim(),
      filePath,
    });
  }
  return agents;
}

export function getAgent(agents: ReadonlyMap<AgentName, BuiltInAgent>, name: AgentName): BuiltInAgent | undefined {
  return agents.get(name);
}

export function describeAgents(agents: ReadonlyMap<string, BuiltInAgent>): string {
  return Array.from(agents.values())
    .map((agent) => `${agent.name}: ${agent.description}`)
    .join("; ");
}
