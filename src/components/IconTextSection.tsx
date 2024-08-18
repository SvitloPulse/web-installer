import { Box, SvgIconProps, Typography } from "@mui/material";
import { ComponentType } from "react";

interface IconTextSectionProps {
  Icon: ComponentType<SvgIconProps>;
  IconProps?: SvgIconProps;
  text?: string;
  children?: React.ReactNode;
}

const IconTextSection: React.FC<IconTextSectionProps> = ({
  Icon,
  IconProps,
  text,
  children,
}) => {
  return (
    <>
      <Box sx={{ p: (theme) => theme.spacing(2) }}>
        <Icon sx={{ fontSize: 50 }} {...IconProps}/>
      </Box>
      {children ? children : null}
      {text && <Typography sx={{ mt: 2, mb: 1 }}>{text}</Typography>}
    </>
  );
};

export default IconTextSection;
