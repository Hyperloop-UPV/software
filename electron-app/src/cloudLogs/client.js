/**
 * Integration boundary for Cloud Logs. Replace these four functions with HTTP
 * calls once the remote API contract is available. Never log credentials.
 * See README.md for normalized return values, archive layout and error handling.
 */
function pending() {
  throw new Error(
    "Cloud Logs API is not connected yet. The remote adapter still needs to be implemented.",
  );
}

/** @returns {Promise<{items: Array<{id:string,user:string,notes:string,tags:string[],date:string}>,nextCursor?:string}>} */
export async function listLogs({ credentials, cursor }) {
  void credentials;
  void cursor;
  return pending();
}

/** @returns {Promise<string[]>} API-backed suggestions, never invented locally. */
export async function autocompleteTags({ credentials, query }) {
  void credentials;
  void query;
  return pending();
}

/**
 * Stream archivePath as ZIP. Metadata = {user, notes, tags, date}; authenticate
 * with credentials.apiKey. Resolve only when the server confirms persistence.
 * @returns {Promise<{id:string,user:string,notes:string,tags:string[],date:string}>}
 */
export async function uploadLog({ credentials, archivePath, metadata }) {
  void credentials;
  void archivePath;
  void metadata;
  return pending();
}

/**
 * Download id to destination (a temporary ZIP path). Resolve AFTER closing the
 * file. Enforce maxBytes while streaming, including if Content-Length is absent.
 * Only send credentials to the trusted API, never arbitrary redirect hosts.
 * @returns {Promise<void>}
 */
export async function downloadLog({ credentials, id, destination, maxBytes }) {
  void credentials;
  void id;
  void destination;
  void maxBytes;
  return pending();
}
