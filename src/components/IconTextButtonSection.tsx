import { Box, Button, SvgIconProps, Typography } from "@mui/material";
import { ComponentType } from "react";

interface IconTextButtonSectionProps {
  Icon: ComponentType<SvgIconProps>;
  IconProps?: SvgIconProps;
  text?: string;
  buttonText: string;
  onClick?: () => void;
  children?: React.ReactNode;
}

const IconTextButtonSection: React.FC<IconTextButtonSectionProps> = ({
  Icon,
  IconProps,
  text,
  buttonText,
  onClick,
  children,
}) => {
  return (
    <>
      <Box sx={{ p: (theme) => theme.spacing(2) }}>
        <Icon sx={{ fontSize: 50 } } {...IconProps}/>
      </Box>
      { text && <Typography sx={{ mt: 2, mb: 1 }}>{text}</Typography>}
      {children ? children : null}
      <Button
        autoFocus
        variant="outlined"
        sx={{ mt: 2 }}
        onClick={() => {
          if (onClick) {
            onClick();
          }
        }}
      >
        {buttonText}
      </Button>
    </>
  );
};

export default IconTextButtonSection;
