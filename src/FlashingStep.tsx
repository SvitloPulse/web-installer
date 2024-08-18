import { loadPyodide, PyodideInterface } from "pyodide";
import { Box } from "@mui/material";
import { useCallback, useEffect, useState } from "react";
import {
  CheckCircleOutline,
  Upgrade,
  WarningAmberOutlined,
} from "@mui/icons-material";
import { ESPLoader, FlashOptions } from "esptool-js";
import CircularProgressTextSection from "./components/CircularProgressTextSection";
import IconTextSection from "./components/IconTextSection";
import IconTextButtonSection from "./components/IconTextButtonSection";

type SerialConnectStepProps = {
  setIsBackActive: (active: boolean) => void;
  setIsNextActive: (active: boolean) => void;
  onFlashingFinished: () => void;
};

type FlashingStatus =
  | "idle"
  | "preparing"
  | "flashing_firmware"
  | "completed"
  | "error_flashing_firmware"
  | "error_other";

function FlashingStep({
  onFlashingFinished,
  setIsBackActive,
  setIsNextActive,
}: SerialConnectStepProps) {
  const [flashingStatus, setFlashingStatus] = useState<FlashingStatus>("idle");
  const [flashingProgress, setFlashingProgress] = useState<number>(0);

  const startFlashing = useCallback(async () => {
    setFlashingStatus("preparing");
    setIsBackActive(false);
    setIsNextActive(false);
    let bootloader: Uint8Array;
    let partitions: Uint8Array;
    let firmware: Uint8Array;
    let nvs: Uint8Array;
    let py: PyodideInterface;
    try {
      py = await loadPyodide();
      await py.runPythonAsync(`
        from pyodide.http import pyfetch
        response = await pyfetch("${location.href}/nvs_gen.zip")
        await response.unpack_archive()
      `);
      const nvs_gen = py.pyimport("nvs_gen");

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if (!(window as any).config) {
        console.error("Config not defined");
        setFlashingStatus("error_other");
        setIsBackActive(true);
        return;
      }
      const config = (window as any).config;
      nvs = Uint8Array.from(
        nvs_gen.create_nvs_bin(config.ssid, config.password, config.key)
      );

      let res = await fetch("/firmware.bin");
      const firmwareBlob = await res.blob();
      firmware = new Uint8Array(await firmwareBlob.arrayBuffer());

      res = await fetch("/bootloader.bin");
      const bootloaderBlob = await res.blob();
      bootloader = new Uint8Array(await bootloaderBlob.arrayBuffer());

      res = await fetch("/partitions.bin");
      const partitionsBlob = await res.blob();
      partitions = new Uint8Array(await partitionsBlob.arrayBuffer());
    } catch (e) {
      console.error(e);
      setFlashingStatus("error_other");
      setIsBackActive(true);
      return;
    }

    if (!(window as any).esploader) {
      console.error("ESPLoader not defined");
      setFlashingStatus("error_other");
      setIsBackActive(true);
      return;
    }

    const esploader: ESPLoader = (window as any).esploader as ESPLoader;
    let bootloader_str = "";
    let partitions_str = "";
    let firmware_str = "";
    let nvs_str = "";

    // Convert ArrayBuffer to string
    bootloader_str = bootloader.reduce(
      (str, byte) => str + String.fromCharCode(byte),
      ""
    );
    partitions_str = partitions.reduce(
      (str, byte) => str + String.fromCharCode(byte),
      ""
    );
    firmware_str = firmware.reduce(
      (str, byte) => str + String.fromCharCode(byte),
      ""
    );
    nvs_str = nvs.reduce((str, byte) => str + String.fromCharCode(byte), "");

    const flashOptions: FlashOptions = {
      fileArray: [
        { data: bootloader_str, address: 0x0 },
        { data: partitions_str, address: 0x8000 },
        { data: firmware_str, address: 0x10000 },
        { data: nvs_str, address: 0x9000 },
      ],
      flashSize: "4MB",
      flashFreq: "80m",
      flashMode: "dio",
      eraseAll: false,
      compress: true,
      reportProgress: (_, written, total) => {
        console.log("Flashing progress", (written / total) * 100);
        setFlashingProgress((written / total) * 100);
      },
    } as FlashOptions;

    try {
      // Flash firmware
      setFlashingStatus("flashing_firmware");
      await esploader.writeFlash(flashOptions);
      await esploader.hardReset();
      setFlashingStatus("completed");
      setIsBackActive(true);
      setIsNextActive(true);
      onFlashingFinished();
    } catch (e) {
      console.error(e);
      setFlashingStatus("error_flashing_firmware");
      setIsBackActive(true);
    }
  }, []);

  useEffect(() => {
    setIsBackActive(true);
    setIsNextActive(false);
    setFlashingStatus("idle");
  }, [setIsBackActive, setIsNextActive]);

  return (
    <Box
      sx={{
        width: "100%",
        alignItems: "center",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <Box
        sx={{
          width: "60%",
          alignItems: "center",
          display: "flex",
          flexDirection: "column",
          mt: (theme) => theme.spacing(2),
        }}
      >
        {flashingStatus === "idle" && (
          <IconTextButtonSection
            Icon={Upgrade}
            text="Для завантаження програмного забезпечення та налаштувань на пристрій Svitlo Pulse натисніть кнопку 'Розпочати' Не відключайте пристрій від ПК протягом цього процесу."
            buttonText="Розпочати"
            onClick={startFlashing}
          />
        )}
        {flashingStatus === "preparing" && (
          <CircularProgressTextSection text="Підготовка до завантаження програмного забезпечення..." />
        )}
        {flashingStatus === "flashing_firmware" && (
          <CircularProgressTextSection
            text="Завантаження програмного забезпечення на пристрій... Це може зайняти деякий час. Не відключайте пристрій від ПК."
            value={flashingProgress}
          />
        )}
        {flashingStatus === "completed" && (
          <IconTextSection
            Icon={CheckCircleOutline}
            IconProps={{ color: "success" }}
            text="Програмне забезпечення успішно завантажено на пристрій! Натисніть кнопку 'Далі' для завершення налаштувань."
          />
        )}
        {["error_flashing_firmware", "error_other"].includes(flashingStatus) && (
          <IconTextButtonSection
            Icon={WarningAmberOutlined}
            text="Не вдалося завантаження програмне забезпечення на пристрій. Натисніть кнопку 'Повідомити про помилку', щоб отримати допомогу."
            buttonText="Повідомити про помилку"
            onClick={() => {
              console.log("Report error");
            }}
          />
        )}
      </Box>
    </Box>
  );
}

export default FlashingStep;
