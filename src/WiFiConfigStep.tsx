import {
  Box,
  IconButton,
  InputAdornment,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import {
  Key,
  SignalWifi3BarLock,
  Visibility,
  VisibilityOff,
  Wifi,
  WifiPassword,
} from "@mui/icons-material";
import { useEffect } from "react";
import { Formik } from "formik";
import { stepsController } from "./services/StepsController";
import React from "react";

type FormData = {
  ssid: string;
  password: string;
  key: string;
};

type WifiConfigStepProps = {
  setIsBackActive: (active: boolean) => void;
  setIsNextActive: (active: boolean) => void;
  onFormSubmit: (data: FormData) => void;
};

function WiFiConfigStep({
  setIsBackActive,
  setIsNextActive,
  onFormSubmit,
}: WifiConfigStepProps) {

  const [showPassword, setShowPassword] = React.useState(false);
  const [showKey, setShowKey] = React.useState(false);
  
  useEffect(() => {
    setIsBackActive(true);
    setIsNextActive(false);
  }, []);

  return (
    <Box
      sx={{
        width: "100%",
      }}
    >
      <Box
        sx={{
          width: "100%",
          alignItems: "center",
          display: "flex",
          flexDirection: "column",
          mt: (theme) => theme.spacing(2),
        }}
      >
        <Box sx={{ p: (theme) => theme.spacing(2) }}>
          <SignalWifi3BarLock sx={{ fontSize: 40 }} />
        </Box>
        <Typography sx={{ mt: 2, mb: 1, width: "60%" }}>
          Введіть у форму нижче назву мережі та пароль для підключення до WiFi,
          а також ключ для сервісу Світлобот. Уведені дані будуть передані на
          ваш пристрій і нікуди більше.
        </Typography>
        <Box sx={{ width: "60%" }}>
          <Formik
            initialValues={{ ssid: "", password: "", key: "" }}
            validate={(values) => {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const errors = {} as any;
              if (!values.ssid) {
                errors.ssid = "Обов'язкове поле";
              }
              if (!values.password) {
                errors.password = "Обов'язкове поле";
              }
              if (!values.key) {
                errors.key = "Обов'язкове поле";
              }

              if (errors.ssid || errors.password || errors.key) {
                setIsNextActive(false);
              } else {
                setIsNextActive(true);
                onFormSubmit(values);
              }

              return errors;
            }}
            onSubmit={(values, { setSubmitting }) => {
              onFormSubmit(values);
              setSubmitting(false);
              stepsController.goNext();
            }}
          >
            {({
              values,
              errors,
              touched,
              handleChange,
              handleBlur,
              handleSubmit,
              /* and other goodies */
            }) => (
              <form
                onSubmit={handleSubmit}
              >
                <Stack
                  spacing={2}
                  sx={{ width: "100%", mt: 2 }}
                  direction="column"
                >
                  <TextField
                    label="Назва мережі (SSID)"
                    variant="outlined"
                    focused
                    fullWidth
                    required
                    error={!!(errors.ssid && touched.ssid)}
                    helperText={errors.ssid && touched.ssid && errors.ssid}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <Wifi />
                        </InputAdornment>
                      ),
                      name: "ssid",
                      value: values.ssid,
                      onChange: handleChange,
                      onBlur: handleBlur,
                    }}
                  />
                  <TextField
                    label="Пароль мережі"
                    variant="outlined"
                    type={showPassword ? "text": "password"}
                    required
                    fullWidth
                    error={!!(errors.password && touched.password)}
                    helperText={
                      errors.password && touched.password && errors.password
                    }
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <WifiPassword />
                        </InputAdornment>
                      ),
                      endAdornment: (
                        <InputAdornment position="end">
                          <IconButton
                            onClick={() => setShowPassword(!showPassword)}
                            edge="end"
                          >
                            {showPassword ? <VisibilityOff /> : <Visibility />}
                          </IconButton>
                        </InputAdornment>
                      ),
                      name: "password",
                      value: values.password,
                      onChange: handleChange,
                      onBlur: handleBlur,
                    }}
                  />
                  <TextField
                    label="Ключ Світлобота"
                    variant="outlined"
                    type={showKey ? "text" : "password"}
                    required
                    fullWidth
                    error={!!(errors.key && touched.key)}
                    helperText={errors.key && touched.key && errors.key}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <Key />
                        </InputAdornment>
                      ),
                      endAdornment: (
                        <InputAdornment position="end">
                          <IconButton
                            onClick={() => setShowKey(!showKey)}
                            edge="end"
                          >
                            {showKey ? <VisibilityOff /> : <Visibility />}
                          </IconButton>
                        </InputAdornment>
                      ),
                      name: "key",
                      value: values.key,
                      onChange: handleChange,
                      onBlur: handleBlur,
                    }}
                  />
                </Stack>
              </form>
            )}
          </Formik>
        </Box>
      </Box>
    </Box>
  );
}

export default WiFiConfigStep;
