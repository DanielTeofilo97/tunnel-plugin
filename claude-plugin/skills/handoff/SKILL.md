---
description: Hand work to a teammate, or to another of the user's own agents, as a tunnel task with a self-contained context packet (create_task), in the right project and with its deadline, or as a whole chain from a playbook. Use when the user asks to hand off, delegate, pass or assign work through tunnel, to turn this session into a task, or to run or save a playbook. Also covers writing tunnel notes, results and decisions.
argument-hint: "[member]"
allowed-tools: mcp__plugin_tunnel_tunnel__list_tasks mcp__plugin_tunnel_tunnel__list_projects mcp__plugin_tunnel_tunnel__list_playbooks mcp__plugin_tunnel_tunnel__search_memory
---

# Hand off through tunnel

Turn the work in this session into a task on the tunnel board, written so that someone with none of this conversation can pick it up and finish it.

## Who it is for

Tasks go to people, not agents: any agent a member connects (Claude Code, Codex, Cursor…) can take tasks assigned to them. If the user named someone, as the command argument or in their message, use that name. Otherwise call `list_tasks` (its header lists the members) and ask the user who it is for: a teammate, themself (to continue in another of their agents, for example plan here and implement in Codex), or nobody in particular, which lets anyone claim it.

## What the team already knows

Before writing the packet, call `search_memory` with the work's key terms (and `project`, when it belongs to one). Earlier tasks, results and decisions on the subject change the handoff: cite them in the packet by #id instead of repeating them, don't reopen a recorded decision without saying why, and if a task already covers this work, tell the user before creating another.

## Project, deadline and priority

- **Project**: call `list_projects` and put the task in the project its work belongs to, passing the slug as `project`. If none fits, ask the user whether to start one with `create_project` (reuse an existing one rather than make a near-duplicate) or to leave the task without a project.
- **Deadline**: set `due` (YYYY-MM-DD) when there is a real one, and say in the context what happens if it slips.
- **Priority**: leave it normal unless the user says it is high or urgent; then pass `priority`.
- **Outside wait**: if the work already waits on someone outside the board (a client, legal, a supplier), name them in `waiting_on`, like "Jurídico da Tamborete".

## Repeated work: playbooks

If the handoff is a chain the team repeats (onboarding a client, a release, a monthly close), call `list_playbooks` first. When one fits, tell the user which roles and variables it needs, confirm who does each role (a member, or anyone) and the values, and create the whole chain with `run_playbook` instead of creating tasks one by one.

When the user sets up such a chain for the first time, offer to save it with `create_playbook`: one step per task, each context written as a packet like the one below, `{{variables}}` for what changes between runs (a client's name, a date) and a role (like dev or juridico) for who does each step.

## The context packet

Write `context` in the user's language, with these sections:

1. **Goal**: what the work is for and the outcome wanted.
2. **Decisions already made, and why**: including options that were ruled out, so nobody reopens them.
3. **Current state**: what is done, what is not, what was tried and failed, known blockers.
4. **Files, links and commits**: exact paths, branches, commit hashes, PRs, URLs, and the commands to build, run or test.
5. **Done when**: concrete checks the next agent can verify.

Rules:

- **The reader starts cold.** They can't see this conversation, your memory, your plan or your scratch files. Replace "the bug above", "as discussed" or "the new approach" with the actual names, paths, numbers and error messages.
- **Never include secrets**: tokens, passwords, API keys, private keys, connection strings, cookies or `.env` values, not even partially. Say where they live instead ("the `DATABASE_URL` variable on Railway").
- **Keep it as short as it can be while standing on its own.** Bullets over prose, no recap of how the conversation went.
- **State uncommitted work.** If the next person needs changes that only exist on this machine, say so and suggest committing or pushing them first.
- `title` is a short imperative summary, at most 120 characters.
- If the work can only start after other tasks are done, pass their ids in `depends_on`.
- Pass `project`, `due`, `priority` and `waiting_on` as described above.
- Point to earlier work and decisions by their #id (from `search_memory`) instead of repeating them.
- **Files the reader needs that only exist here** (a log, a screenshot, a report, a sample of data) go onto the task with `attach_file` once it is created, and the packet says what each one is. Don't paste a long log into the context.

For example, a `context` might read:

```
## Goal
Login fails on Safari since #12 changed the session cookie. Restore login on Safari without reverting #12.

## Decisions already made
- Keep SameSite=None: the embedded checkout needs it (see #12).
- Not switching to localStorage tokens: ruled out for XSS exposure.

## Current state
- Reproduced on Safari 18: the cookie is dropped because `Secure` is missing in staging.
- Nothing changed yet.

## Files, links and commits
- src/auth/cookies.ts, `sessionCookie()`; commit a1b2c3d (#12) introduced the change.
- Run: `npm run dev`, then log in at http://localhost:3000/login in Safari.

## Done when
- Login works on Safari and Chrome in staging.
- `npm run smoke` passes.
```

## Create it

Call `create_task` with the title, context, assignee and dependencies, plus the project and, when there are any, the deadline, priority and outside wait. Attach the files the packet names with `attach_file`: `text` for a text file, `base64` for any other, up to 2 MB each (bigger ones, up to 10 MB, go through the task's page on the web). Then tell the user the task id, who it is for and which project it is in. Its reply lists related earlier tasks: if one already covers this work, say so. If something turns out wrong or missing afterwards, fix the same task with `update_task` instead of creating another.

If this conversation settled decisions others should follow beyond this task (a choice between options, a rule, a trade-off), record each on the new task with `record_decision`: one or two sentences with the why.

## Notes and results

The same standard applies to everything you post on the board:

- **`add_note`**: progress, a question or an answer, readable by someone who only sees the task. Say what changed since the last note and what you need, if anything. The task's creator, assignee and holder are notified; write `@name` to bring in another member.
- **`attach_file`**: for what is a file by nature or too long for a note: a log, a test report, a CSV, a screenshot, a spec. Say in the note or the result what you attached. Text files are refused when they look like they hold a secret, like any other text, and go into the team's memory. `get_task` lists a task's attachments, and `read_attachment` reads one: read those that matter before working from a task.
- **`update_task`**: when the work stalls on someone outside the board, set `waiting_on` to who it is, and clear it with null once they reply; it doesn't change the task's state, it tells the team why it isn't moving. Move the deadline with `due` if it changes.
- **`ask`**: for a decision you shouldn't make alone (an approval, a choice, missing information), instead of a note. Pass `options` when the answers are few, so they can answer with one tap on their phone, then call `wait_for_answer`. The question has to stand on its own too.
- **`record_decision`**: when you or the user decide something others should follow while working on a task, record it right away, in a sentence or two with the why ("Refunds go through the API only: the dashboard can't do partial ones"). To change an earlier decision, record the new one with `replaces` set to the old one's id (`search_memory` and `get_task` show it); the old one stays in the log, marked as superseded.
- **`complete_task` result**: a packet for whoever builds on it: what changed, where (files, commits, PRs), how to verify, and what is still open. Pass the decisions made along the way in `decisions`, one per item. On a task someone else created, it goes to them for review first.
- **Pull requests**: when you open a pull request for a task, write `Closes tunnel#<id>` (the task's id, like `Closes tunnel#12`) in its description, once per task it does. The board links it, shows its state on the task and, once it is merged, completes the task as its holder, with the pull request as the result (on a task someone else created, it goes to their review); when several pull requests close the task, the last merge completes it. Write the description so it works as that result. A bare `tunnel#<id>` only links, so use it to mention other tasks without completing them. Opening the pull request is progress, not completion: add a note with its link and leave the task in progress, and let the merge complete it. If the work also needs things outside the pull request, finish it yourself with `complete_task`. For a pull request that doesn't name the task, call `link_pull_request` with the task `id` and the pull request's `url`.
