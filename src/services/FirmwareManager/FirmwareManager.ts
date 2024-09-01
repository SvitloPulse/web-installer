import { makeObservable, observable, action, runInAction } from "mobx";
import { BoardEntry, BytesString, Manifest } from "./types";

// TODO: move to env file
const BASE_URL =
  "https://s3.eu-west-1.amazonaws.com/svitlopulse.prod.releases/";

class FirmwareManager {
  manifest: Manifest = {} as Manifest;
  releases: string[] = [];
  initialized: boolean = false;

  constructor() {
    makeObservable(this, {
      manifest: observable,
      releases: observable,
      initialized: observable,
      fetchManifest: action,
    });

    (async () => {
      const releases = await this.fetchAvailableReleases();
      const manifest = await this.fetchManifest(releases[releases.length - 1]);
      runInAction(() => {
        this.initialized = true;
        this.releases = releases;
        this.manifest = manifest;
      });
    })();
  }

  fetchAvailableReleases = async () => {
    try {
      const res = await fetch(BASE_URL + "releases.json");
      return await res.json();
    } catch (e) {
      console.error(e);
    }
  };

  fetchManifest = async (release: string) => {
    try {
      const res = await fetch(BASE_URL + release + "/manifest.json");
      return await res.json();
    } catch (e) {
      console.error(e);
    }
  };

  isChipSupported = (chipId: string) => {
    return this.manifest.supportedChips[chipId] !== undefined;
  };

  getBoardsList = (chipId: string): BoardEntry[] => {
    return Object.values(this.manifest.supportedChips[chipId].boards);
  };

  getFirmwareFileName = (chipId: string, boardId: string): string => {
    return this.manifest.supportedChips[chipId].boards[boardId].files[0].name;
  };

  getFirmwareFileURL = (chipId: string, boardId: string): string => {
    const release = this.manifest.version;
    return BASE_URL + release + "/" + this.getFirmwareFileName(chipId, boardId);
  }

  downloadBoardFirmware = async (
    chipId: string,
    boardId: string
  ): Promise<BytesString> => {
    const release = this.manifest.version;
    const firmwareFileName = this.manifest.supportedChips[chipId].boards[boardId].files[0].name;
    const res = await fetch(BASE_URL + release + "/" + firmwareFileName);
    // TODO: add checksum verification
    const firmwareBlob = await res.blob();
    const firmware = new Uint8Array(await firmwareBlob.arrayBuffer());
    return firmware.reduce((str, byte) => str + String.fromCharCode(byte), "");
  };

  downloadFirmwareFile = async (release: string, firmwareFileName: string): Promise<BytesString> => {
    const res = await fetch(BASE_URL + release + "/" + firmwareFileName);
    const firmwareBlob = await res.blob();
    const firmware = new Uint8Array(await firmwareBlob.arrayBuffer());
    return firmware.reduce((str, byte) => str + String.fromCharCode(byte), "");
  }
}

export const firmwareManager = new FirmwareManager();
