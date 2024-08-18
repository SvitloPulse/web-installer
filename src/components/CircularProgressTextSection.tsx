import {
  Box,
  CircularProgress,
  CircularProgressProps,
  Typography,
} from "@mui/material";

interface CircularProgressTextSectionProps {
  text?: string;
  children?: React.ReactNode;
  value?: number;
}

function CircularProgressWithLabel(
  props: CircularProgressProps & { value: number }
) {
  return (
    <Box sx={{ position: "relative", display: "inline-flex" }}>
      <CircularProgress variant="determinate" {...props} />
      <Box
        sx={{
          top: 0,
          left: 0,
          bottom: 0,
          right: 0,
          position: "absolute",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Typography
          variant="caption"
          component="div"
          color="text.secondary"
        >{`${Math.round(props.value)}%`}</Typography>
      </Box>
    </Box>
  );
}

const CircularProgressTextSection: React.FC<
  CircularProgressTextSectionProps
> = ({ text, children, value }: CircularProgressTextSectionProps) => {
  return (
    <>
      <Box sx={{ p: (theme) => theme.spacing(2) }}>
        {value !== undefined ? (
          <CircularProgressWithLabel value={value} size={50} />
        ) : (
          <CircularProgress />
        )}
      </Box>
      {children ? children : null}
      {text && <Typography sx={{ mt: 2, mb: 1 }}>{text}</Typography>}
    </>
  );
};

export default CircularProgressTextSection;
