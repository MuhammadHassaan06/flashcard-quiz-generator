// Offline-First IndexedDB Cache Utility for Recall.ai

const DB_NAME = "RecallAiOfflineDB";
const DB_VERSION = 1;
const STORE_DECKS = "decks";

export interface OfflineDeck {
  id: string;
  title: string;
  cards: Array<{
    id: string;
    front: string;
    back: string;
    interval: number;
    ease_factor: number;
    repetitions: number;
    next_review_date: string;
  }>;
  cachedAt: string;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined" || !("indexedDB" in window)) {
      reject("IndexedDB not supported");
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event: any) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_DECKS)) {
        db.createObjectStore(STORE_DECKS, { keyPath: "id" });
      }
    };

    request.onsuccess = (event: any) => resolve(event.target.result);
    request.onerror = (event: any) => reject(event.target.error);
  });
}

export async function cacheDeckLocally(deck: OfflineDeck): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_DECKS, "readwrite");
    const store = tx.objectStore(STORE_DECKS);
    store.put(deck);
  } catch (e) {
    console.error("Failed to cache deck offline:", e);
  }
}

export async function getOfflineDeck(deckId: string): Promise<OfflineDeck | null> {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_DECKS, "readonly");
      const store = tx.objectStore(STORE_DECKS);
      const request = store.get(deckId);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => resolve(null);
    });
  } catch (e) {
    return null;
  }
}

export async function getAllOfflineDecks(): Promise<OfflineDeck[]> {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_DECKS, "readonly");
      const store = tx.objectStore(STORE_DECKS);
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => resolve([]);
    });
  } catch (e) {
    return [];
  }
}
