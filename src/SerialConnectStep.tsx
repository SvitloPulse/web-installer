import { Box, Typography } from "@mui/material";
import { ESPLoader, LoaderOptions, Transport } from "esptool-js";
import { useCallback, useEffect, useState } from "react";
import { serial } from "web-serial-polyfill";
import {
  CheckCircleOutline,
  OpenInBrowser,
  Usb,
  WarningAmberOutlined,
} from "@mui/icons-material";
import IconTextSection from "./components/IconTextSection";
import CircularProgressTextSection from "./components/CircularProgressTextSection";
import IconTextButtonSection from "./components/IconTextButtonSection";

// @ts-expect-error Navigator should have Web Serial support
// eslint-disable-next-line @typescript-eslint/no-explicit-any
if (!navigator.serial && navigator.usb) (navigator as any).serial = serial;

const BAUDRATE = 115200;

type SerialConnectStepProps = {
  setIsBackActive: (active: boolean) => void;
  setIsNextActive: (active: boolean) => void;
  onDeviceSelected: (loader: ESPLoader) => void;
};

type PortStatus =
  | "idle"
  | "selecting"
  | "connecting"
  | "connected"
  | "error_not_selected"
  | "error_device_not_supported"
  | "error_other";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let device: any = null;
let transport: Transport | null = null;

function SerialConnectStep({
  onDeviceSelected,
  setIsBackActive,
  setIsNextActive,
}: SerialConnectStepProps) {
  const [portStatus, setPortStatus] = useState<PortStatus>("idle");
  const [chipInfo, setChipInfo] = useState<string>("");

  const selectPort = useCallback(async () => {
    setPortStatus("selecting");
    setIsBackActive(false);
    setIsNextActive(false);
    if (transport) {
      await transport.disconnect();
      transport = null;
    }
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      device = await (navigator as any).serial.requestPort({});
    } catch (e) {
      console.error(e);
      setPortStatus("error_not_selected");
      setIsBackActive(true);
      return;
    }
    setPortStatus("connecting");
    let esploader: ESPLoader;
    try {
      transport = new Transport(device, true);
      const flashOptions = {
        transport,
        baudrate: BAUDRATE,
      } as LoaderOptions;
      esploader = new ESPLoader(flashOptions);
    } catch (e) {
      console.error(e);
      setPortStatus("error_other");
      setIsBackActive(true);
      return;
    }
    try {
      const chip = await esploader.main();
      const rom = await esploader.runStub();
      const mac = await rom.readMac(esploader);
      const features = await rom.getChipFeatures(esploader);
      const flashSize = await esploader.getFlashSize();
      setChipInfo(`${chip} (Flash size: ${flashSize / 1024} MB, MAC: ${mac})`);
      console.log("Chip description", await rom.getChipDescription(esploader));
      console.log("Chip detected:", chip);
      console.log("Features:", features);
      console.log("MAC:", mac);
      if (!chip.startsWith("ESP32-C3")) {
        setPortStatus("error_device_not_supported");
        setIsBackActive(true);
        return;
      }
    } catch (e) {
      console.error(e);
      setPortStatus("error_other");
      setIsBackActive(true);
      return;
    }
    setIsBackActive(true);
    setIsNextActive(true);
    setPortStatus("connected");
    onDeviceSelected(esploader);
  }, [onDeviceSelected, setIsBackActive, setIsNextActive, setPortStatus]);

  useEffect(() => {
    setIsBackActive(false);
    setIsNextActive(false);
    setPortStatus("idle");
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
        {portStatus === "idle" && (
          <IconTextButtonSection
            Icon={Usb}
            text="Підключіть пристрій Svitlo Pulse до ПК за допомогою USB кабеля, а потім натисніть кнопку 'Розпочати'."
            buttonText="Розпочати"
            onClick={selectPort}
          />
        )}
        {portStatus === "selecting" && (
          <IconTextSection
            Icon={OpenInBrowser}
            text="Оберіть пристрій для підключення у вікні, що з'явиться."
          />
        )}
        {portStatus === "connecting" && (
          <CircularProgressTextSection text="Підключаємося до пристрою..." />
        )}
        {portStatus === "connected" && (
          <IconTextSection Icon={CheckCircleOutline} IconProps={{color: "success"}}>
            <>
              <Typography sx={{ mt: 2, mb: 1 }}>{chipInfo}</Typography>
              <Typography sx={{ mt: 2, mb: 1 }}>
                Підключено до пристрою! Натисніть "Далі" для продовження.
              </Typography>
            </>
          </IconTextSection>
        )}
        {portStatus === "error_not_selected" && (
          <IconTextButtonSection
            Icon={WarningAmberOutlined}
            text='Вы не обрали пристрій. Натисніть "Спробувати ще раз", щоб відкрити
              список знову, або "Назад", щоб повернутися на попередній крок.'
            buttonText="Спробувати ще раз"
            onClick={() => {
              setPortStatus("idle");
              selectPort();
            }}
          />
        )}
        {portStatus === "error_device_not_supported" && (
          <IconTextButtonSection
            Icon={WarningAmberOutlined}
            buttonText="Спробувати ще раз"
            onClick={() => {
              setPortStatus("idle");
              selectPort();
            }}
          >
            <Typography sx={{ mt: 2, mb: 1 }}>{chipInfo}</Typography>
            <Typography sx={{ mt: 2, mb: 1 }}>
              Підключений пристрій не підтримується. Підключить пристрій на базі
              чипу ESP32-C3 та натисніть "Спробувати ще раз", щоб відкрити
              список знову.
            </Typography>
          </IconTextButtonSection>
        )}
      </Box>
    </Box>
  );
}

export default SerialConnectStep;
