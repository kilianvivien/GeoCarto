/// <reference lib="webworker" />
import { ImportParseError, parseFile, type ParseErrorCode, type ParsedCollection, type WorkerFormat } from './parse';

export interface ImportWorkerRequest {
  format: WorkerFormat;
  file: Blob;
}

export type ImportWorkerResponse =
  | { ok: true; collections: ParsedCollection[] }
  // `code` is null for failures the decoders did not anticipate.
  | { ok: false; code: ParseErrorCode | null; detail: string };

/** One job per worker: decode the file, reply, and let the caller terminate us. */
self.onmessage = async (event: MessageEvent<ImportWorkerRequest>) => {
  let response: ImportWorkerResponse;
  try {
    response = { ok: true, collections: await parseFile(event.data.format, event.data.file) };
  } catch (error) {
    response =
      error instanceof ImportParseError
        ? { ok: false, code: error.code, detail: error.detail }
        : { ok: false, code: null, detail: error instanceof Error ? error.message : String(error) };
  }
  self.postMessage(response);
};
