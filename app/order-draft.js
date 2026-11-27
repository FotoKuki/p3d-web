const draftKey = "pending-print";

async function draftStore(mode, operation) {
  const database = await new Promise((resolve, reject) => {
    const request = indexedDB.open("p3d-checkout", 1);
    request.onupgradeneeded = () => request.result.createObjectStore("drafts");
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  try {
    return await new Promise((resolve, reject) => {
      const transaction = database.transaction("drafts", mode);
      const request = operation(transaction.objectStore("drafts"));
      transaction.oncomplete = () => resolve(request.result);
      transaction.onabort = () => reject(transaction.error);
      transaction.onerror = () => reject(transaction.error);
    });
  } finally {
    database.close();
  }
}

export function saveOrderDraft(draft) {
  return draftStore("readwrite", (store) => store.put({ ...draft, expiresAt: Date.now() + 30 * 60 * 1000 }, draftKey));
}

export async function readOrderDraft() {
  const draft = await draftStore("readonly", (store) => store.get(draftKey));
  if (draft && draft.expiresAt > Date.now()) return draft;
  if (draft) await clearOrderDraft();
  return null;
}

export function clearOrderDraft() {
  return draftStore("readwrite", (store) => store.delete(draftKey));
}