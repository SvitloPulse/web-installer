import {
  Box,
  Button,
  Typography,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from "@mui/material";
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
import { useEffect, useState } from "react";
import { stepsController } from "./services/StepsController";

const FlashingStep = observer(
  () => {
    // TODO: add multiple mcu / boards support
    const { chipInfo } = espFlasher;
    const { releases, manifest, getFirmwareFileURL, setActiveRelease } =
      firmwareManager;
    const [selectedRelease, setSelectedRelease] = useState<string>("");
    const chipId = chipInfo?.mcu;
    const board = chipId
      ? Object.values(manifest.supportedChips?.[chipId]?.boards ?? {})[0]
      : undefined;
    const firmwareFile = board?.files[0]?.name ?? "";
    const firmwareFileSha256 = board?.files[0]?.sha256 ?? "";
    // const firmwareFileURL =
    //   chipId && board ? getFirmwareFileURL(chipId, board.boardId) : "";
    const { flashingProgress, flashingStatus, flash } = espFlasher;
    const [firmwareFileURL, setFirmwareFileURL] = useState<string>("");

    useEffect(() => {
      if (releases.length > 0 && !selectedRelease) {
        const latest = releases[releases.length - 1];
        setSelectedRelease(latest);
        setActiveRelease(latest);
        if (chipId && board) {
          setFirmwareFileURL(getFirmwareFileURL(latest, chipId, board.boardId));
        }
      }
    }, [board, chipId, getFirmwareFileURL, releases, selectedRelease, setActiveRelease]);

    useEffect(() => {
      const activeStatuses: EspFlasherFlashingStatus[] = ["preparing", "erasing_flash", "flashing_firmware"];
      stepsController.setCanGoNext(flashingStatus == "completed");
      stepsController.setCanGoBack(!activeStatuses.includes(flashingStatus));
      stepsController.setStepCompleted(flashingStatus === "completed");
    }, [flashingStatus]);

    if (!chipId || !board) {
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
            <CircularProgressTextSection text="Завантаження інформації про прошивку." />
          </Box>
        </Box>
      );
    }

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
              <FormControl sx={{ mt: 2, mb: 1, minWidth: 240 }} size="small">
                <InputLabel id="firmware-release-label">
                  Версія ПЗ
                </InputLabel>
                <Select
                  labelId="firmware-release-label"
                  label="Версія ПЗ"
                  value={selectedRelease}
                  onChange={async (event) => {
                    const release = event.target.value as string;
                    setSelectedRelease(release);
                    await setActiveRelease(release);
                    if (chipId && board) {
                      setFirmwareFileURL(getFirmwareFileURL(release, chipId, board.boardId));
                    }
                  }}
                >
                  {[...releases].reverse().map((release) => (
                    <MenuItem key={release} value={release}>
                      {release}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <Typography>
                Файл:{" "}
                <a target="_blank" href={firmwareFileURL}>
                  {firmwareFile}
                </a>
              </Typography>
              <Typography sx={{ mt: 2, mb: 1, fontSize: 12 }}>
                SHA256: {firmwareFileSha256}
              </Typography>
              <Typography sx={{ mt: 2, mb: 1 }}>
                Для завантаження програмного забезпечення та налаштувань на
                пристрій Svitlo Pulse натисніть кнопку "Розпочати". Не
                відключайте пристрій від ПК протягом цього процесу.
              </Typography>
              <Button
                variant="outlined"
                sx={{ mt: 2, mb: 2 }}
                onClick={() => {
                  flash(selectedRelease, board.files[0]);
                }}
                disabled={!selectedRelease}
                autoFocus
              >
                Розпочати
              </Button>
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
