import { Box, Button, Typography } from "@mui/material";
import {
  CheckCircleOutline,
  UsbOutlined,
  WarningAmberOutlined,
} from "@mui/icons-material";
import CircularProgressTextSection from "./components/CircularProgressTextSection";
import IconTextSection from "./components/IconTextSection";
import IconTextButtonSection from "./components/IconTextButtonSection";
import { observer } from "mobx-react-lite";
import { firmwareManager } from "./services/FirmwareManager";
import { espFlasher, EspFlasherFlashingStatus } from "./services/EspFlasher";
import { useEffect } from "react";
import { stepsController } from "./services/StepsController";

const FlashingStep = observer(
  () => {
    // TODO: add multiple mcu / boards support
    const { chipInfo } = espFlasher;
    const { releases, manifest, getFirmwareFileURL } = firmwareManager;
    const latestRelease = releases[releases.length - 1];
    const chipId = chipInfo!.mcu;
    const board = Object.values(manifest.supportedChips[chipId].boards)[0];
    const firmwareFile = board.files[0].name;
    const firmwareFileSha256 = board.files[0].sha256;
    const firmwareFileURL = getFirmwareFileURL(chipId, board.boardId);
    const {flashingProgress, flashingStatus, flash} = espFlasher;

    useEffect(() => {
      const activeStatuses: EspFlasherFlashingStatus[] = ["preparing", "erasing_flash", "flashing_firmware"];
      stepsController.setCanGoNext(flashingStatus == "completed");
      stepsController.setCanGoBack(!activeStatuses.includes(flashingStatus));
      stepsController.setStepCompleted(flashingStatus === "completed");
    }, [flashingStatus]);

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
            <IconTextSection Icon={UsbOutlined}>
              <Typography sx={{ mt: 2, mb: 1 }}>
                Для завантаження програмного забезпечення та налаштувань на
                пристрій Svitlo Pulse натисніть кнопку "Розпочати". Не
                відключайте пристрій від ПК протягом цього процесу.
              </Typography>
              <Button
                variant="outlined"
                sx={{ mt: 2, mb: 2 }}
                onClick={() => {
                  flash(latestRelease, board.files[0]);
                }}
                autoFocus
              >
                Розпочати
              </Button>
              <Typography sx={{ mt: 2 }}>
                Версія ПЗ:{" "}
                <a
                  target="_blank"
                  href={`https://github.com/SvitloPulse/esp32-firmware/releases/tag/${latestRelease}`}
                >
                  {latestRelease}
                </a>
              </Typography>
              <Typography>
                Файл:{" "}
                <a target="_blank" href={firmwareFileURL}>
                  {firmwareFile}
                </a>
              </Typography>
              <Typography sx={{ mt: 2, mb: 1, fontSize: 12 }}>
                SHA256: {firmwareFileSha256}
              </Typography>
            </IconTextSection>
          )}
          {flashingStatus === "preparing" && (
            <CircularProgressTextSection text="Підготовка до завантаження програмного забезпечення." />
          )}
          {flashingStatus === "erasing_flash" && (
            <CircularProgressTextSection text="Очистка флеш пам'яті пристрою. Це може зайняти деякий час. Не відключайте пристрій від ПК." />
          )}
          {flashingStatus === "flashing_firmware" && (
            <CircularProgressTextSection
              text="Завантаження програмного забезпечення на пристрій. Це може зайняти деякий час. Не відключайте пристрій від ПК."
              value={flashingProgress}
            />
          )}
          {flashingStatus === "completed" && (
            <IconTextSection
              Icon={CheckCircleOutline}
              IconProps={{ color: "success" }}
              text="Програмне забезпечення успішно завантажено на пристрій! SvitloPulse готовий до роботи."
            />
          )}
          {["error_flashing_firmware", "error_other"].includes(
            flashingStatus
          ) && (
            <IconTextButtonSection
              Icon={WarningAmberOutlined}
              text='Не вдалося завантаження програмне забезпечення на пристрій. Натисніть кнопку "Повідомити про помилку", щоб отримати допомогу.'
              buttonText="Повідомити про помилку"
              onClick={() => {
                window.open("https://github.com/SvitloPulse/esp32-firmware/issues/new", "_blank");
              }}
            />
          )}
        </Box>
      </Box>
    );
  }
);

export default FlashingStep;
