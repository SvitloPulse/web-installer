export interface FirmwareFile {
  name: string;
  offset: string;
  sha256: string;
}

export interface BoardEntry {
  boardId: string;
  boardName: string;
  chipId: string;
  files: FirmwareFile[]
}

export interface ChipEntry {
  chipId: string;
  boards: Record<string, BoardEntry>;
}

export type Manifest = {
  version: string;
  supportedChips: Record<string, ChipEntry>;
}
export type BytesString = string;
