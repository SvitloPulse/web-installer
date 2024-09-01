export type EspFlasherConnectionStatus =
  | "idle"
  | "selecting"
  | "connecting"
  | "connected"
  | "error_not_selected"
  | "error_device_not_supported"
  | "error_other";

export type EspFlasherFlashingStatus = "idle"
| "preparing"
| "erasing_flash"
| "flashing_firmware"
| "completed"
| "error_flashing_firmware"
| "error_other";

export interface ChipInfo {
  mcu: string;
  displayName: string;
  flashSize: string;
  macAddress: string;
};

export interface SvitloPulseConfig {
  ssid: string;
  password: string;
  key: string;
}
