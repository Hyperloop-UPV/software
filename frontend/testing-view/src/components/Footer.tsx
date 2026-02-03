/**
 * Renders a footer with the app name, current year and the copyright notice
 */
export const Footer = () => {
  const currentYear = new Date().getFullYear();
  const dateRange =
    currentYear <= 2025 ? `${currentYear}` : `2025-${currentYear}`;

  return (
    <footer className="bg-background py-sm flex w-full items-center justify-center">
      <span className="text-foreground text-sm">
        Control Station - Testing View © {dateRange} Hyperloop UPV
      </span>
    </footer>
  );
};

export default Footer;
