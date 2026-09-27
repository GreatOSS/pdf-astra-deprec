import type { DocumentState } from './document';
export type Session = { bytes: Uint8Array; name: string; state: DocumentState; exported: string };
let database: Promise<IDBDatabase> | undefined;
function db() {
  return database ??= new Promise((resolve, reject) => {
    const request = indexedDB.open('foliovale', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('session');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
export async function loadSession(): Promise<Session | undefined> {
  const database = await db();
  return new Promise((resolve, reject) => {
    const request = database.transaction('session').objectStore('session').get('current');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
export async function storeSession(session?: Session) {
  const database = await db();
  return new Promise<void>((resolve, reject) => {
    const transaction = database.transaction('session', 'readwrite');
    const store = transaction.objectStore('session');
    if (session) store.put(session, 'current'); else store.delete('current');
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}
