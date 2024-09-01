import { Box, Typography } from "@mui/material";
import { useEffect } from "react";
import {
  CheckCircleOutline,
  OpenInBrowser,
  Usb,
  WarningAmberOutlined,
} from "@mui/icons-material";
import IconTextSection from "./components/IconTextSection";
import CircularProgressTextSection from "./components/CircularProgressTextSection";
import IconTextButtonSection from "./components/IconTextButtonSection";
import { observer } from "mobx-react-lite";
import { espFlasher, EspFlasherConnectionStatus } from "./services/EspFlasher";
import { stepsController } from "./services/StepsController";

interface SerialConnectStepProps {
  nextButton: React.RefObject<HTMLButtonElement>;
}

export const SerialConnectStep = observer(
  ({ nextButton }: SerialConnectStepProps) => {
    const { connectionStatus, chipInfo, selectAndConnect } = espFlasher;

    useEffect(() => {
      const activeStatuses: EspFlasherConnectionStatus[] = [
        "selecting",
        "connecting",
      ];
      stepsController.setCanGoNext(connectionStatus === "connected");
      stepsController.setCanGoBack(!activeStatuses.includes(connectionStatus));
      stepsController.setStepCompleted(connectionStatus === "connected");
      if (connectionStatus === "connected") {
        nextButton.current?.focus();
      }
    }, [connectionStatus]);

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
          {connectionStatus === "idle" && (
            <IconTextButtonSection
              Icon={Usb}
              text='Підключіть пристрій SvitloPulse до ПК за допомогою USB кабеля, а потім натисніть кнопку "Розпочати". У спливаючому вікні оберіть відповідний COM порт.'
              buttonText="Розпочати"
              onClick={selectAndConnect}
            />
          )}
          {connectionStatus === "selecting" && (
            <IconTextSection
              Icon={OpenInBrowser}
              text="Оберіть пристрій для підключення у вікні, що з'явиться."
            />
          )}
          {connectionStatus === "connecting" && (
            <CircularProgressTextSection text="Підключаємося до пристрою..." />
          )}
          {connectionStatus === "connected" && (
            <IconTextSection
              Icon={CheckCircleOutline}
              IconProps={{ color: "success" }}
            >
              <>
                <Typography sx={{ mt: 2, mb: 1 }}>
                  {chipInfo!.displayName}, {chipInfo!.flashSize}
                </Typography>
                <Typography sx={{ mt: 2, mb: 1 }}>
                  Підключено до пристрою! Натисніть "Далі" для продовження.
                </Typography>
              </>
            </IconTextSection>
          )}
          {connectionStatus === "error_not_selected" && (
            <IconTextButtonSection
              Icon={WarningAmberOutlined}
              text='Вы не обрали пристрій. Натисніть "Спробувати ще раз", щоб відкрити
              список знову, або "Назад", щоб повернутися на попередній крок.'
              buttonText="Спробувати ще раз"
              onClick={selectAndConnect}
            />
          )}
          {connectionStatus === "error_device_not_supported" && (
            <IconTextButtonSection
              Icon={WarningAmberOutlined}
              buttonText="Спробувати ще раз"
              onClick={selectAndConnect}
            >
              <Typography sx={{ mt: 2, mb: 1 }}>
                {chipInfo!.displayName}, {chipInfo!.flashSize}
              </Typography>
              <Typography sx={{ mt: 2, mb: 1 }}>
                Підключений пристрій не підтримується. Підключить пристрій на
                базі чипу ESP32-C3 та натисніть "Спробувати ще раз", щоб
                відкрити список знову.
              </Typography>
            </IconTextButtonSection>
          )}
        </Box>
      </Box>
    );
  }
);
