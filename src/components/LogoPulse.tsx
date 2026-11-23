import React, { useId } from 'react';

interface LogoPulseProps {
  compact?: boolean;
  showSubtitle?: boolean;
  className?: string;
}

export const LogoPulse: React.FC<LogoPulseProps> = ({
  compact = false,
  showSubtitle = true,
  className = '',
}) => {
  const uid = useId().replace(/:/g, '');
  const gradId = `pulse-arch-grad-${uid}`;
  const bgId = `pulse-arch-bg-${uid}`;
  const glowId = `pulse-arch-glow-${uid}`;

  return (
    <span className={`inline-flex items-center gap-3 select-none ${className}`}>
      <svg
        width={compact ? 34 : 40}
        height={compact ? 34 : 40}
        viewBox="0 0 44 44"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="shrink-0 drop-shadow-[0_4px_12px_rgba(14,165,233,0.14)]"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id={gradId} x1="6" y1="6" x2="38" y2="38" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#0D9488" />
            <stop offset="100%" stopColor="#0EA5E9" />
          </linearGradient>
          <linearGradient id={bgId} x1="2" y1="2" x2="42" y2="42" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#FFFFFF" />
            <stop offset="100%" stopColor="#EAF7FA" />
          </linearGradient>
          <radialGradient
            id={glowId}
            cx="0"
            cy="0"
            r="1"
            gradientUnits="userSpaceOnUse"
            gradientTransform="translate(33.2 16.6) rotate(90) scale(5.6)"
          >
            <stop offset="0%" stopColor="#0EA5E9" stopOpacity="0.55" />
            <stop offset="100%" stopColor="#0EA5E9" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Soft architectural frosted tile */}
        <rect
          x="1.5"
          y="1.5"
          width="41"
          height="41"
          rx="13"
          fill={`url(#${bgId})`}
          stroke="#0EA5E9"
          strokeOpacity="0.2"
          strokeWidth="1"
        />

        {/* Contour 1: Graceful minimalist interior arch / vault */}
        <path
          d="M13 33V20.5C13 14.7 17.03 10.75 22 10.75C26.97 10.75 31 14.7 31 20.5V33"
          stroke={`url(#${gradId})`}
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Subtle architectural threshold hairline */}
        <path
          d="M9.5 33H34.5"
          stroke={`url(#${gradId})`}
          strokeWidth="1.2"
          strokeLinecap="round"
          strokeOpacity="0.3"
        />

        {/* Delicate inner vault echo for depth */}
        <path
          d="M17.2 33V21.8C17.2 18.6 19.35 16.2 22 16.2C24.65 16.2 26.8 18.6 26.8 21.8"
          stroke={`url(#${gradId})`}
          strokeWidth="1.2"
          strokeLinecap="round"
          strokeOpacity="0.24"
        />

        {/* Contour 2: Thin sweeping orbit wave (project rhythm) */}
        <path
          d="M8.5 25.8C14.8 31.4 25.8 28.6 33.2 16.6"
          stroke={`url(#${gradId})`}
          strokeWidth="1.75"
          strokeLinecap="round"
        />

        {/* Delicate glowing accent dot */}
        <circle cx="33.2" cy="16.6" r="5.6" fill={`url(#${glowId})`} />
        <circle cx="33.2" cy="16.6" r="2.2" fill={`url(#${gradId})`} />
      </svg>

      <span className="flex flex-col text-left leading-none">
        <span
          className={`font-medium tracking-[0.03em] text-[#0F2936] whitespace-nowrap ${
            compact ? 'text-[14px]' : 'text-[15px] sm:text-[16px]'
          }`}
        >
          Студия{' '}
          <span className="bg-gradient-to-r from-[#0D9488] to-[#0EA5E9] bg-clip-text font-semibold text-transparent">
            Пульс
          </span>
        </span>
        {showSubtitle && !compact && (
          <span className="mt-1 hidden text-[10px] font-normal tracking-[0.02em] text-[#5B7B8C] sm:block whitespace-nowrap">
            архитектура и дизайн интерьеров
          </span>
        )}
      </span>
    </span>
  );
};
