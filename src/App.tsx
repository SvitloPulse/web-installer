import * as React from "react";
import Avatar from "@mui/material/Avatar";
import CssBaseline from "@mui/material/CssBaseline";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Container from "@mui/material/Container";
import { createTheme, ThemeProvider } from "@mui/material/styles";
import { Button, Step, StepLabel, Stepper } from "@mui/material";
import SerialConnectStep from "./SerialConnectStep";
import { Settings } from "@mui/icons-material";
import WiFiConfigStep from "./WiFiConfigStep";
import FlashingStep from "./FlashingStep";

const defaultTheme = createTheme();

type StepTypes =
  "serial_connect"
  | "wifi"
  | "flashing"
  | "done";

export default function App() {
  const [activeStep, setActiveStep] = React.useState<StepTypes>("serial_connect");
  const steps = ["serial_connect", "wifi", "flashing", "done"];
  const [isNextActive, setIsNextActive] = React.useState(true);
  const [isBackActive, setIsBackActive] = React.useState(false);
  const handleNext = () => {
    const newStepIndex = steps.indexOf(activeStep) + 1;
    if (newStepIndex < steps.length) {
      setActiveStep(steps[newStepIndex] as StepTypes);
    }
    setIsBackActive(true);
  };
  const handleBack = () => {
    const newStepIndex = steps.indexOf(activeStep) - 1;
    if (newStepIndex >= 0) {
      setActiveStep(steps[newStepIndex] as StepTypes);
    }
    setIsNextActive(true);
  };
  return (
    <ThemeProvider theme={defaultTheme}>
      <Container component="main" maxWidth="md">
        <CssBaseline />
        <Box
          sx={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
          }}
        >
          <Avatar sx={{ m: 1, bgcolor: "secondary.main" }}>
            <Settings />
          </Avatar>
          <Typography component="h1" variant="h5">
            Налаштування Svitlo Pulse
          </Typography>
        </Box>
        <Box sx={{ width: "100%", mt: (theme) => theme.spacing(2)  }}>
          <Stepper>
            <Step active={activeStep == "serial_connect"}>
              <StepLabel>Підключення пристрою</StepLabel>
            </Step>
            <Step active={activeStep == "wifi"}>
              <StepLabel>Налаштування WiFi</StepLabel>
            </Step>
            <Step active={activeStep == "flashing"}>
              <StepLabel>Завантаження ПЗ</StepLabel>
            </Step>
            <Step active={activeStep == "done"}>
              <StepLabel>Готово!</StepLabel>
            </Step>
          </Stepper>
          {activeStep == "serial_connect" && (
            <SerialConnectStep
              setIsBackActive={setIsBackActive}
              setIsNextActive={setIsNextActive}
              onDeviceSelected={(esploader) => {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                (window as any).esploader = esploader;
              }}
            />
          )}
          {activeStep == "wifi" && (
            <WiFiConfigStep
              setIsBackActive={setIsBackActive}
              setIsNextActive={setIsNextActive}
              onFormSubmit={(data) => {
                window.config = data;
              }}
            />
          )}
          {activeStep == "flashing" && (
            <FlashingStep
              setIsBackActive={setIsBackActive}
              setIsNextActive={setIsNextActive}
              onFlashingFinished={() => {
                console.log('Flashing finished');
              }}
            />
          )}
          
          <Box
            sx={{
              display: "flex",
              flexDirection: "row",
              pt: 2,
              justifyContent: "space-between",
            }}
          >
            <Button
              color="inherit"
              sx={{ mr: 1 }}
              onClick={handleBack}
              disabled={!isBackActive}
            >
              Назад
            </Button>
            <Button onClick={handleNext} disabled={!isNextActive} color="primary">
              Далі
            </Button>
          </Box>
        </Box>
      </Container>
    </ThemeProvider>
  );
}
