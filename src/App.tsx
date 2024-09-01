import Avatar from "@mui/material/Avatar";
import CssBaseline from "@mui/material/CssBaseline";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Container from "@mui/material/Container";
import { createTheme, ThemeProvider } from "@mui/material/styles";
import { Button, Step, StepLabel, Stepper } from "@mui/material";
import { SerialConnectStep } from "./SerialConnectStep";
import { Settings } from "@mui/icons-material";
import WiFiConfigStep from "./WiFiConfigStep";
import FlashingStep from "./FlashingStep";
import { observer } from "mobx-react-lite";
import { stepsController } from "./services/StepsController";
import { espFlasher } from "./services/EspFlasher";
import { useRef } from "react";

const defaultTheme = createTheme();

const App = observer(() => {
  const {
    activeStep,
    canGoBack,
    canGoNext,
    goBack,
    goNext,
    isCompleted,
    setCanGoBack,
    setCanGoNext,
  } = stepsController;
  const nextButton = useRef<HTMLButtonElement>(null);
  const backButton = useRef<HTMLButtonElement>(null);
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
            Прошивка та налаштування SvitloPulse
          </Typography>
        </Box>
        <Box sx={{ width: "100%", mt: (theme) => theme.spacing(2) }}>
          <Stepper>
            <Step
              active={activeStep == "serial_connect"}
              completed={isCompleted("serial_connect")}
            >
              <StepLabel>Підключення пристрою</StepLabel>
            </Step>
            <Step active={activeStep == "wifi"} completed={isCompleted("wifi")}>
              <StepLabel>Налаштування WiFi</StepLabel>
            </Step>
            <Step
              active={activeStep == "flashing"}
              completed={isCompleted("flashing")}
            >
              <StepLabel>Завантаження ПЗ</StepLabel>
            </Step>
          </Stepper>
          {activeStep == "serial_connect" && (
            <SerialConnectStep nextButton={nextButton} />
          )}
          {activeStep == "wifi" && (
            <WiFiConfigStep
              setIsBackActive={setCanGoBack}
              setIsNextActive={setCanGoNext}
              onFormSubmit={(data) => {
                espFlasher.setConfig(data);
              }}
            />
          )}
          {activeStep == "flashing" && <FlashingStep />}

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
              onClick={goBack}
              disabled={!canGoBack}
              ref={backButton}
            >
              Назад
            </Button>
            <Button
              onClick={goNext}
              disabled={!canGoNext}
              color="primary"
              ref={nextButton}
            >
              Далі
            </Button>
          </Box>
        </Box>
      </Container>
    </ThemeProvider>
  );
});

export default App;
