export function Icon({ name, size = 20, ...props }) {
  const paths = {
    arrows: <><path d="M4 8h14m-4-4 4 4-4 4M20 16H6m4-4-4 4 4 4" /></>,
    down: <path d="m8 10 4 4 4-4" />,
    plus: <path d="M12 5v14M5 12h14" />,
    close: <path d="m6 6 12 12M6 18 18 6" />,
    refresh: <><path d="M20 7v5h-5M4 17v-5h5" /><path d="M6 7a7 7 0 0 1 11.6-2L20 8M4 16l2.4 3A7 7 0 0 0 18 17" /></>,
    download: <><path d="M12 3v12m-4-4 4 4 4-4M5 16v4h14v-4" /></>,
    search: <><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 4 4" /></>,
    check: <path d="m5 12 4 4L19 6" />,
    calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M7 3v4m10-4v4M3 11h18M8 15h2m4 0h2" /></>,
    logout: <><path d="M9 4H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h4M9 12h12m-4-4 4 4-4 4" /></>,
    left: <path d="m14 6-6 6 6 6" />,
    right: <path d="m10 6 6 6-6 6" />,
  }
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>{paths[name]}</svg>
}
