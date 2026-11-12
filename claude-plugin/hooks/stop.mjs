// Stop hook: if Claude claimed a tunnel task in this session and posted nothing on it since (add_note, attach_file, ask,
// record_decision, complete_task or release_task), keep the conversation going once so it reports progress on the board.
// Each claim is nudged at most once, even when the user tells Claude not to post.
import { readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Matches the plugin's server (mcp__plugin_tunnel_tunnel__…) and a manually added one (mcp__tunnel__…).
const TOOL = /^mcp__.*tunnel.*__(claim_task|add_note|attach_file|ask|record_decision|complete_task|release_task)$/;

/** Tasks whose latest successful claim has no report after it, as [task id, claim tool_use id]. */
function unreported(transcript) {
  const calls = [];
  const results = new Map();
  for (const line of transcript.split("\n")) {
    if (!line.includes('"tool_use')) continue;
    let entry;
    try {
      entry = JSON.parse(line);
    } catch {
      continue;
    }
    const content = entry.message?.content;
    if (!Array.isArray(content)) continue;
    for (const block of content) {
      if (block.type === "tool_use") {
        const tool = TOOL.exec(block.name)?.[1];
        if (tool) calls.push({ useId: block.id, tool, task: Number(block.input?.id) });
      } else if (block.type === "tool_result") {
        results.set(block.tool_use_id, Boolean(block.is_error));
      }
    }
  }

  const held = new Map();
  for (const { useId, tool, task } of calls) {
    if (results.get(useId) === true) continue;
    if (tool === "claim_task") {
      if (results.has(useId)) held.set(task, useId);
    } else held.delete(task);
  }
  return [...held];
}

function readJson(path, fallback) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return fallback;
  }
}

const input = JSON.parse(readFileSync(0, "utf8"));
if (!input.stop_hook_active && input.transcript_path) {
  let transcript = "";
  try {
    transcript = readFileSync(input.transcript_path, "utf8");
  } catch {
    // No transcript to read: let Claude stop.
  }
  const nudgedFile = join(tmpdir(), `tunnel-stop-${String(input.session_id).replace(/[^\w-]/g, "")}.json`);
  const nudged = readJson(nudgedFile, []);
  const fresh = transcript.includes("claim_task") ? unreported(transcript).filter(([, useId]) => !nudged.includes(useId)) : [];
  if (fresh.length) {
    try {
      writeFileSync(nudgedFile, JSON.stringify([...nudged, ...fresh.map(([, useId]) => useId)]));
    } catch {
      // Without the marker this claim may be nudged again on a later turn; stop_hook_active still prevents loops.
    }
    const ids = fresh.map(([task]) => `#${task}`).join(", ");
    const context = `Você pegou ${ids} no tunnel nesta sessão e ainda não registrou nada lá. Antes de parar, poste o andamento com add_note (o que foi feito, o que falta, bloqueios), ou conclua com complete_task, ou devolva com release_task se não for continuar. Se já fez isso ou o usuário pediu para não postar, só confirme em uma linha.`;
    process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: "Stop", additionalContext: context } }));
  }
}
