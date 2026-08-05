import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Theme } from "@earendil-works/pi-coding-agent";
import { type TUI, visibleWidth } from "@earendil-works/pi-tui";
import { afterEach, describe, expect, it } from "vitest";
import { cardsIn } from "../src/board-model.js";
import { BoardStore } from "../src/board-store.js";
import { addCard, addCardLabel, setCardTime } from "../src/markdown-board.js";
import {
  createPanelState,
  KanbanPanel,
  type PanelAction,
} from "../src/kanban-panel.js";

const createdDirectories: string[] = [];

const theme = {
  fg: (_color: string, value: string) => value,
  bg: (_color: string, value: string) => value,
  bold: (value: string) => value,
  italic: (value: string) => value,
  strikethrough: (value: string) => value,
} as unknown as Theme;

function fixtureStore(): BoardStore {
  const directory = mkdtempSync(join(tmpdir(), "pi-kanban0-panel-"));
  createdDirectories.push(directory);
  const path = join(directory, "board.md");
  const source = [
    "---\nkanban-plugin: board\n---\n",
    "## Inbox\n\n- [ ] A very long first card title for narrow terminals\n\tDetails\n\tMore details\n\tThird detail\n\n- [ ] Second\n",
    "## TODO\n\n- [ ] Third\n",
    "## Doing\n\n- [ ] Fourth\n",
    "## Review\n\n",
    "## Done\n\n- [x] Fifth\n",
    "## Archive\n\n%% kanban:settings\n```\n{}\n```\n%%\n",
  ].join("");
  writeFileSync(path, source, "utf8");
  return new BoardStore(path);
}

function fakeTui(rows = 18): TUI {
  return { terminal: { rows } } as unknown as TUI;
}

afterEach(() => {
  for (const directory of createdDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe("KanbanPanel", () => {
  it("renders within the terminal width at narrow and wide sizes", () => {
    const store = fixtureStore();
    const panel = new KanbanPanel(store, createPanelState(), fakeTui(40), theme, () => undefined);

    for (const width of [25, 60, 120, 180]) {
      const lines = panel.render(width);
      expect(lines.length).toBeLessThanOrEqual(34);
      expect(lines.length).toBeLessThan(40);
      expect(lines[0]).toContain("PI KANBAN");
      expect(lines.every((line) => visibleWidth(line) <= width)).toBe(true);
    }
  });

  it("reserves room for Pi chrome so the board header stays visible", () => {
    const store = fixtureStore();
    const panel = new KanbanPanel(store, createPanelState(), fakeTui(10), theme, () => undefined);

    const lines = panel.render(80);

    expect(lines).toHaveLength(6);
    expect(lines[0]).toContain("PI KANBAN");
    expect(lines.at(-1)).toContain("open full keyboard help");
  });

  it("uses complete action labels in the footer instead of compressed key groups", () => {
    const store = fixtureStore();
    const panel = new KanbanPanel(store, createPanelState(), fakeTui(40), theme, () => undefined);

    const footer = panel.render(120).join("\n");

    expect(footer).toContain("a add card");
    expect(footer).toContain("e edit card");
    expect(footer).toContain("d delete card");
    expect(footer).toContain("c manage column");
    expect(footer).toContain("? open keyboard help");
    expect(footer).not.toContain("a/e/d");
  });

  it("renders each card in at most two rows with a body preview and ellipsis", () => {
    const store = fixtureStore();
    const panel = new KanbanPanel(store, createPanelState(), fakeTui(40), theme, () => undefined);

    const lines = panel.render(50);
    const titleRow = lines.findIndex((line) => line.includes("A very long first"));
    const previewRow = lines.findIndex((line) => line.includes("Details…"));
    const secondCardRow = lines.findIndex((line) => line.includes("Second"));

    expect(titleRow).toBeGreaterThan(0);
    expect(previewRow).toBe(titleRow + 1);
    expect(secondCardRow).toBe(previewRow + 1);
    expect(lines.join("\n")).not.toContain("More details");
    expect(lines.join("\n")).not.toContain("Third detail");
  });

  it("includes @ time and # labels in the second item row when space permits", () => {
    const store = fixtureStore();
    const card = cardsIn(store.document.columns[0]!)[0]!;
    store.mutate((document) => {
      setCardTime(document, card.id, "2026-08-04 09:30");
      addCardLabel(document, card.id, "urgent");
    });
    const panel = new KanbanPanel(store, createPanelState(), fakeTui(40), theme, () => undefined);

    const output = panel.render(50).join("\n");

    expect(output).toContain("Details");
    expect(output).toContain("@ 2026-08-04 09:30");
    expect(output).toContain("#urgent");
  });

  it("caps a tall board and keeps its cards scrollable", () => {
    const store = fixtureStore();
    store.mutate((document) => {
      for (let index = 0; index < 30; index += 1) addCard(document, 0, `Extra ${index + 1}`);
    });
    const state = createPanelState();
    const panel = new KanbanPanel(store, state, fakeTui(40), theme, () => undefined);

    const tallBoard = panel.render(100);
    expect(tallBoard.length).toBeGreaterThan(17);
    expect(tallBoard.length).toBeLessThanOrEqual(34);
    panel.handleInput("\x1b[6~");
    expect(state.selectedCards[0]).toBeGreaterThan(0);
    expect(panel.render(100)[0]).toContain("PI KANBAN");
  });

  it("keeps help and detail views keyboard-only and width-safe", () => {
    const store = fixtureStore();
    const panel = new KanbanPanel(store, createPanelState(), fakeTui(16), theme, () => undefined);

    panel.handleInput("?");
    const help = panel.render(48);
    expect(help.length).toBeLessThanOrEqual(12);
    expect(help.every((line) => visibleWidth(line) <= 48)).toBe(true);
    panel.handleInput("?");
    panel.handleInput("\r");
    const detail = panel.render(48);
    expect(detail.length).toBeLessThanOrEqual(12);
    expect(detail.every((line) => visibleWidth(line) <= 48)).toBe(true);
    expect(detail.join("\n")).not.toContain("Navigate:");
    expect(detail.join("\n")).toContain("y copy card");
    panel.handleInput("\x1b");
    expect(panel.render(48)[0]).toContain("PI KANBAN");
  });

  it("copies the open card without time or labels and keeps the detail view open", async () => {
    const store = fixtureStore();
    const card = cardsIn(store.document.columns[0]!)[0]!;
    store.mutate((document) => {
      setCardTime(document, card.id, "2026-08-04 09:30");
      addCardLabel(document, card.id, "urgent");
    });
    let copied = "";
    let renders = 0;
    const tui = {
      terminal: { rows: 24 },
      requestRender: () => {
        renders += 1;
      },
    } as unknown as TUI;
    const panel = new KanbanPanel(
      store,
      createPanelState(),
      tui,
      theme,
      () => undefined,
      async (text) => {
        copied = text;
      },
    );

    panel.handleInput("\r");
    panel.handleInput("y");
    await Promise.resolve();

    expect(copied).toBe([
      "A very long first card title for narrow terminals",
      "Details",
      "More details",
      "Third detail",
    ].join("\n"));
    expect(copied).not.toContain("2026-08-04 09:30");
    expect(copied).not.toContain("urgent");
    expect(renders).toBe(1);
    expect(panel.render(80).join("\n")).toContain("Copied card to clipboard");
  });

  it("restores the card detail after a label or time dialog is cancelled", () => {
    const store = fixtureStore();
    const state = createPanelState();
    const actions: PanelAction[] = [];
    const panel = new KanbanPanel(store, state, fakeTui(), theme, (action) => actions.push(action));

    panel.handleInput("\r");
    panel.handleInput("#");
    expect(actions.at(-1)?.type).toBe("label");
    expect(state.view).toBe("detail");

    const afterCancelledDialog = new KanbanPanel(
      store,
      state,
      fakeTui(),
      theme,
      (action) => actions.push(action),
    );
    expect(afterCancelledDialog.render(80)[0]).toContain("CARD");
    afterCancelledDialog.handleInput("@");
    expect(actions.at(-1)?.type).toBe("time");
    expect(state.view).toBe("detail");
  });

  it("returns from help to the detail view that opened it", () => {
    const store = fixtureStore();
    const state = createPanelState();
    const panel = new KanbanPanel(store, state, fakeTui(), theme, () => undefined);

    panel.handleInput("\r");
    panel.handleInput("?");
    expect(state.view).toBe("help");
    panel.handleInput("\x1b");

    expect(state.view).toBe("detail");
    expect(panel.render(80)[0]).toContain("CARD");
  });

  it("toggles and moves the selected card with single-key actions", () => {
    const store = fixtureStore();
    const state = createPanelState();
    state.message = "Old status";
    state.messageKind = "warning";
    const panel = new KanbanPanel(store, state, fakeTui(), theme, () => undefined);
    const firstId = cardsIn(store.document.columns[0]!)[0]!.id;

    panel.handleInput(" ");
    expect(cardsIn(store.document.columns[0]!)[0]?.checked).toBe(true);
    expect(state.message).toBeUndefined();
    panel.handleInput("]");
    expect(cardsIn(store.document.columns[1]!).map((card) => card.id)).toContain(firstId);
    expect(state.selectedColumn).toBe(1);
  });

  it("returns explicit actions for text entry and closing", () => {
    const store = fixtureStore();
    const actions: PanelAction[] = [];
    const panel = new KanbanPanel(store, createPanelState(), fakeTui(), theme, (action) => actions.push(action));

    panel.handleInput("a");
    expect(actions[0]).toEqual({ type: "add", columnIndex: 0 });

    panel.handleInput("c");
    expect(actions[1]).toEqual({ type: "column", columnIndex: 0 });

    panel.handleInput("@");
    expect(actions[2]).toEqual({ type: "time", cardId: cardsIn(store.document.columns[0]!)[0]!.id });

    panel.handleInput("#");
    expect(actions[3]).toEqual({ type: "label", cardId: cardsIn(store.document.columns[0]!)[0]!.id });

    const closing = new KanbanPanel(store, createPanelState(), fakeTui(), theme, (action) => actions.push(action));
    closing.handleInput("q");
    expect(actions.at(-1)).toEqual({ type: "close" });
  });
});
