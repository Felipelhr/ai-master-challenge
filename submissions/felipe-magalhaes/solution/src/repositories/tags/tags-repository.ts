import type { DealTag, Tag } from "@/domain/tags/tag";

export interface TagsRepository {
  list(): Tag[];
  listLinks(): DealTag[];
  save(tag: Tag): void;
  attach(link: DealTag): void;
  detach(link: DealTag): void;
  find(id: string): Tag | null;
}
