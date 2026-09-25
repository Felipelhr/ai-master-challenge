export interface Tag {
  id: string;
  name: string;
  color: string;
  type: "SYSTEM" | "USER";
  createdAt: string;
}

export interface DealTag {
  dealId: string;
  tagId: string;
}
