import {
  FiBell,
  FiCheckCircle,
  FiLogOut,
  FiMoon,
  FiSun,
  FiUser,
} from 'react-icons/fi';

const withIcon = (IconComponent) => ({ size = 18, ...props }) => (
  <IconComponent size={size} {...props} focusable="false" aria-hidden="true" />
);

export const IconSun = withIcon(FiSun);
export const IconMoon = withIcon(FiMoon);
export const IconBell = withIcon(FiBell);
export const IconUser = withIcon(FiUser);
export const IconLogout = withIcon(FiLogOut);
export const IconCheckCircle = withIcon(FiCheckCircle);
