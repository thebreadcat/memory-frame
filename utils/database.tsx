// database.ts
import Database from 'better-sqlite3';

const db = new Database('./data.db');

type GameState = {
  mode: 'GAME' | 'GALLERY';
  currentPosition: { x: number, y: number };
  grid: Grid;
  matchesFound: number;
  galleryImage: number;
  firstFlipped: string;
  statusMessage: string;
  errorMessage: string;
};

type Card = {
  id: number;
  flipped: boolean;
  matched: boolean;
};

type Grid = Card[][];

const initializeGrid = (): Grid => {
  const pairs = Array.from({ length: 8 }, (_, i) => i).flatMap((id) => [{ id, flipped: false, matched: false }, { id, flipped: false, matched: false }]);
  const shuffledPairs = shuffle(pairs);
  return Array.from({ length: 4 }, (_, i) => shuffledPairs.slice(i * 4, (i + 1) * 4));
};

const initialState: GameState = {
  mode: 'GAME',
  currentPosition: { x: 0, y: 0 },
  grid: initializeGrid(),
  matchesFound: 0,
  galleryImage: 0,
  firstFlipped: null,
  statusMessage: "Pick a card to flip!",
  errorMessage: null,
};

function shuffle(array: any[]) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]]; // Swap elements
  }
  return array;
}

export const initializeDb = () => {
  db.exec(`CREATE TABLE IF NOT EXISTS gameData (
    farcasterId TEXT PRIMARY KEY,
    gameData TEXT,
    lastUpdated INTEGER
  )`);
};

// Insert or update game state
export const upsertGameState = (farcasterId: string, gameData: string) => {
  const now = Date.now();
  db.prepare(`
    INSERT INTO gameData (farcasterId, gameData, lastUpdated)
    VALUES (?, ?, ?)
    ON CONFLICT(farcasterId)
    DO UPDATE SET gameData = ?, lastUpdated = ?`)
    .run(farcasterId, gameData, now, gameData, now);
};

export const getGameState = (farcasterId: string): string | null => {
  const row = db.prepare(`SELECT gameData FROM gameData WHERE farcasterId = ?`).get(farcasterId);
  return row ? row.gameData : null;
};

export const initializeGameState = (): string => {
  const grid = initializeGrid();
  const initialState = {
    mode: 'GAME',
    currentPosition: { x: 0, y: 0 },
    grid,
    matchesFound: 0,
    galleryImage: 0,
    firstFlipped: '',
    statusMessage: "Pick a card to flip!",
    errorMessage: '',
  };

  return JSON.stringify(initialState);
};

export const resetDb = () => {
  db.exec("DROP TABLE IF EXISTS gameData");
  initializeDb(); // Recreate the table
};

initializeDb();
resetDb();