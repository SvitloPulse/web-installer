import { makeObservable, observable, runInAction, when } from "mobx";
import {
  ChipInfo,
  EspFlasherConnectionStatus,
  EspFlasherFlashingStatus,
  SvitloPulseConfig,
} from "./types";
import { serial, SerialPort } from "web-serial-polyfill";
import { ESPLoader, FlashOptions, LoaderOptions, Transport } from "esptool-js";
import { FirmwareFile, firmwareManager, HardwareConfigEntry, UserConfigEntry } from "../FirmwareManager";
import { loadPyodide, PyodideInterface } from "pyodide";

// @ts-expect-error Navigator should have Web Serial support
// eslint-disable-next-line @typescript-eslint/no-explicit-any
if (!navigator.serial && navigator.usb) (navigator as any).serial = serial;

class EspFlasher {
  connectionStatus: EspFlasherConnectionStatus = "idle";
  flashingStatus: EspFlasherFlashingStatus = "idle";
  serialPort: SerialPort | null = null;
  transport: Transport | null = null;
  espLoader: ESPLoader | null = null;
  chipInfo: ChipInfo | null = null;
  baudrate: number = 115200;
  py: PyodideInterface | null = null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  nvsGenModule: any = null;
  flashingProgress: number = 0;
  config: SvitloPulseConfig | null = null;

  constructor() {
    makeObservable(this, {
      connectionStatus: observable,
      flashingStatus: observable,
      espLoader: observable,
      chipInfo: observable,
      flashingProgress: observable,
    });
  }

  selectAndConnect = async () => {
    try {
      await when(() => firmwareManager.initialized, { timeout: 5000 });
    } catch (e) {
      console.error(e);
      runInAction(() => {
        this.connectionStatus = "error_other";
      });
      return;
    }

    runInAction(() => {
      this.connectionStatus = "selecting";
    });
    if (this.transport) {
      await this.transport.disconnect();
      this.serialPort = null;
      this.transport = null;
      runInAction(() => {
        this.espLoader = null;
        this.chipInfo = null;
      });
    }
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      this.serialPort = await (navigator as any).serial.requestPort({});
    } catch (e) {
      console.error(e);
      runInAction(() => {
        this.connectionStatus = "error_not_selected";
      });
      return;
    }
    this.transport = new Transport(this.serialPort);
    runInAction(() => {
      this.connectionStatus = "connecting";
    });
    const flashOptions = {
      transport: this.transport,
      baudrate: this.baudrate,
    } as LoaderOptions;
    runInAction(() => {
      this.espLoader = new ESPLoader(flashOptions);
    });
    try {
      const chip = await this.espLoader!.main();
      const rom = await this.espLoader!.runStub();
      const mac = await rom.readMac(this.espLoader!);
      const flashSize = await this.espLoader!.getFlashSize();
      runInAction(() => {
        const chipId = chip.split(" ")[0].toLowerCase().replace("-", "");
        this.chipInfo = {
          mcu: chipId,
          displayName: chip,
          flashSize: `${flashSize / 1024} MB`,
          macAddress: mac,
        };
        if (!firmwareManager.isChipSupported(chipId)) {
          this.connectionStatus = "error_device_not_supported";
          return;
        }
        this.connectionStatus = "connected";
      });
    } catch (e) {
      console.error(e);
      runInAction(() => {
        this.connectionStatus = "error_other";
      });
    }
  };

  setConfig = (config: SvitloPulseConfig) => {
    this.config = config;
  }

  _loadPyodide = async () => {
    // TODO: transpile python code to js/ts
    this.py = await loadPyodide();
    await this.py.runPythonAsync(`
        from pyodide.http import pyfetch
        response = await pyfetch("${location.href}/nvs_gen.zip")
        await response.unpack_archive()
    `);
    this.nvsGenModule = this.py.pyimport("nvs_gen");
  };

  _generateNvsPartition = (
    config: SvitloPulseConfig,
    hwConfig?: HardwareConfigEntry,
    userConfig?: UserConfigEntry
  ) => {
    const args = {
      ssid: config.ssid,
      password: config.password,
      sb_cfg: {
        key: { value: config.key, type: "string" },
        led_pin: {value: hwConfig?.led_pin ?? 8, type: "u8"},
        led_act_low: {value: hwConfig?.led_act_low ?? 1, type: "u8"},
        led_str_en: {value: hwConfig?.led_str_en ?? 0, type: "u8"},
        icmp_en: {value: Number(userConfig?.icmp_en ?? 0), type: "u8"},
        icmp_tgt: {value: userConfig?.icmp_tgt ?? "", type: "string"},
        sb_url: {value: userConfig?.sb_url ?? "", type: "string"},
      }
    };

    // Convert JS object to Python dict for Pyodide
    const pyArgs = this.py ? (this.py as unknown as { toPy: (value: unknown) => unknown }).toPy(args) : args;
    try {
      return Uint8Array.from(
        this.nvsGenModule.create_nvs_bin(pyArgs)
      ).reduce(
        (str, byte) => str + String.fromCharCode(byte),
        ""
      );
    } finally {
      const maybeDestroy = pyArgs as { destroy?: () => void } | null;
      if (maybeDestroy?.destroy) {
        maybeDestroy.destroy();
      }
    }
  }

  flash = async (release: string, boardId: string, firmwareFile: FirmwareFile) => {
    runInAction(() => {
      this.flashingStatus = "preparing";
    });
    let nvsPartitionBlob = "";
    let firmwareBlob = "";
    try {
      console.log("Flashing board", boardId);
      const board = firmwareManager.getBoard(this.chipInfo!.mcu, boardId);
      if (!board) {
        throw new Error("Board config not found");
      }
      await this._loadPyodide();
      nvsPartitionBlob = this._generateNvsPartition(
        this.config!,
        board.hwConfig,
        board.userConfig
      );
      firmwareBlob = await firmwareManager.downloadFirmwareFile(release, firmwareFile.name);
    } catch (e) {
      console.error(e);
      runInAction(() => {
        this.flashingStatus = "error_other";
      });
      return;
    }
    // TODO: remove  hardcode from there
    const flashOptions: FlashOptions = {
      fileArray: [
        {data: firmwareBlob, address: 0x0},
        {data: nvsPartitionBlob, address: 0x9000},
      ],
      flashSize: this.chipInfo!.flashSize,
      flashMode: "dio", // this should be taken from the board config
      flashFreq: "80m", // this should be taken from the board config
      eraseAll: false,
      compress: true,
      reportProgress: (fileIndex, written, total) => {
        console.log(`Flashing ${fileIndex + 1} of 2: ${written}/${total}`);
        runInAction(() => {
          this.flashingProgress = (written / total) * 100;
        });
      },
    } as FlashOptions;
    runInAction(() => {
      this.flashingStatus = "erasing_flash";
    });
    try {
      await this.espLoader!.eraseFlash();
    } catch (e) {
      console.error(e);
      runInAction(() => {
        this.flashingStatus = "error_flashing_firmware";
      });
      return;
    }
    runInAction(() => {
      this.flashingStatus = "flashing_firmware";
    });
    try {
      await this.espLoader!.writeFlash(flashOptions);
      await this.espLoader!.hardReset();
      runInAction(() => {
        this.flashingStatus = "completed";
      });
    } catch (e) {
      console.error(e);
      runInAction(() => {
        this.flashingStatus = "error_flashing_firmware";
      });
    }
  };
}

export const espFlasher = new EspFlasher();
