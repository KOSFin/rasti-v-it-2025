const baseAttrs = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  focusable: 'false',
  'aria-hidden': 'true',
};

const buildSvgProps = (size, props) => ({
  width: size,
  height: size,
  viewBox: '0 0 24 24',
  ...baseAttrs,
  ...props,
});

export const IconSun = ({ size = 18, ...props }) => (
  <svg {...buildSvgProps(size, props)}>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2m0 16v2m10-10h-2M4 12H2m15.07-7.07 1.42-1.42M6.51 5.51 5.09 4.09m0 15.82 1.42-1.42M19.49 19.49l1.42 1.42" />
  </svg>
);

export const IconMoon = ({ size = 18, ...props }) => (
  <svg {...buildSvgProps(size, props)}>
    <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
  </svg>
);

export const IconBell = ({ size = 18, ...props }) => (
  <svg {...buildSvgProps(size, props)}>
    <path d="M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
    <path d="M13.73 21a2 2 0 01-3.46 0" />
  </svg>
);

export const IconUser = ({ size = 18, ...props }) => (
  <svg {...buildSvgProps(size, props)}>
    <path d="M12 12a5 5 0 100-10 5 5 0 000 10z" />
    <path d="M20 21a8 8 0 10-16 0" />
  </svg>
);

export const IconLogout = ({ size = 18, ...props }) => (
  <svg {...buildSvgProps(size, props)}>
    <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
    <path d="M16 17l5-5-5-5" />
    <path d="M21 12H9" />
  </svg>
);

export const IconCheckCircle = ({ size = 16, ...props }) => (
  <svg {...buildSvgProps(size, props)}>
    <path d="M22 11.08V12a10 10 0 11-5.93-9.14" />
    <path d="M22 4L12 14.01l-3-3" />
  </svg>
);
