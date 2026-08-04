import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { cardsIn } from "../src/board-model.js";
import { BoardStore } from "../src/board-store.js";
import { runKanbanAction } from "../src/kanban-tool.js";
import { readCardMetadata } from "../src/markdown-board.js";
import { ensureProjectBoard } from "../src/project-board.js";

const createdDirectories: string[] = [];

function projectStore(): BoardStore {
  const cwd = mkdtempSync(join(tmpdir(), "pi-kanban0-tool-"));
  createdDirectories.push(cwd);
  return new BoardStore(ensureProjectBoard(cwd).path);
}

afterEach(() => {
  for (const directory of createdDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe("kanban agent actions", () => {
  it("reads and changes the same project board used by the TUI", () => {
    const store = projectStore();

    expect(runKanbanAction(store, { action: "list" })).toContain("Kanban · project");
    expect(runKanbanAction(store, { action: "list" }, "global")).toContain("Kanban · global");
    expect(runKanbanAction(store, {
      action: "add_card",
      column: "Inbox",
      text: "Ship keyboard board\nKeep it local",
    })).toContain("Added");
    expect(runKanbanAction(store, {
      action: "move_card",
      card: "Ship keyboard board",
      targetColumn: "Todo",
    })).toContain("Moved");
    expect(runKanbanAction(store, {
      action: "set_done",
      card: "Ship keyboard board",
      column: "Todo",
      done: true,
    })).toContain("done");
    expect(runKanbanAction(store, {
      action: "set_time",
      card: "Ship keyboard board",
      column: "Todo",
      time: "2026-08-04 10:00",
    })).toContain("Set time");
    expect(runKanbanAction(store, {
      action: "add_label",
      card: "Ship keyboard board",
      column: "Todo",
      label: "release candidate",
    })).toContain("Added label");

    const todo = store.document.columns.find((column) => column.title === "Todo")!;
    expect(cardsIn(todo)[0]?.checked).toBe(true);
    expect(readCardMetadata(cardsIn(todo)[0]!)).toMatchObject({
      time: "2026-08-04 10:00",
      labels: ["release candidate"],
    });
    expect(runKanbanAction(store, { action: "list", query: "keep it local" })).toContain("Ship keyboard board");
  });

  it("supports column management and protects destructive ambiguous actions", () => {
    const store = projectStore();
    runKanbanAction(store, { action: "add_column", title: "Blocked", after: "Todo" });
    runKanbanAction(store, { action: "rename_column", column: "Blocked", title: "Waiting" });
    runKanbanAction(store, { action: "move_column", column: "Waiting", direction: "right" });

    expect(store.document.columns.map((column) => column.title)).toEqual([
      "Inbox",
      "Todo",
      "In Progress",
      "Waiting",
      "Review",
      "Done",
    ]);

    runKanbanAction(store, { action: "add_card", column: "Waiting", text: "External decision" });
    expect(() => runKanbanAction(store, { action: "delete_column", column: "Waiting" })).toThrow(/deleteCards=true/);
    expect(runKanbanAction(store, {
      action: "delete_column",
      column: "Waiting",
      deleteCards: true,
    })).toContain("and 1 card");
  });
});
