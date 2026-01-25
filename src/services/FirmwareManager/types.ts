export interface FirmwareFile {
  name: string;
  offset: string;
  sha256: string;
}

export interface BoardEntry {
  boardId: string;
  boardName: string;
  chipId: string;
  files: FirmwareFile[];
  flashSize?: string;
  hwConfig?: HardwareConfigEntry;
  userConfig?: UserConfigEntry;
}

export interface HardwareConfigEntry {
  led_pin: number;
  led_act_low: number;
  led_str_en: number;
}

export interface UserConfigEntry {
  icmp_en: number;
  icmp_tgt: string;
  sb_url: string;
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
