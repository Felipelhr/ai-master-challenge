import type { Note } from "@/domain/notes/note";

export interface NotesRepository {
  list(): Note[];
  find(id: string): Note | null;
  save(note: Note): void;
  delete(id: string): void;
}
