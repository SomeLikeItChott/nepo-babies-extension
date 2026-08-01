type RelationType = "father" | "mother";

interface Relation {
  type: RelationType;
  name: string;
  occupations: string[];
  letterboxdSlug?: string;
  wikipediaUrl: string;
}

interface NepoEntry {
  name: string;
  tmdbId: number;
  relations: Relation[];
}

type NepoDataset = Record<string, NepoEntry>;
