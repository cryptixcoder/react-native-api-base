/**
 * Admin panel branding. Edit this file (plus the BRAND TOKENS block in src/app/globals.css and the
 * files in public/brand/) to rebrand the panel for a new project.
 */
export const brand = {
  /** Product name shown in the sidebar, login page, page titles and emails' "from" line. */
  name: 'My App',
  /** Short label shown under the name in the sidebar. */
  tagline: 'Admin',
  description: 'Analytics and user management for My App.',
  logo: {
    /** Square logo mark used in the sidebar, on the login page and as the favicon (SVG or PNG). */
    src: '/brand/logo-mark.svg',
    /** Show the product name next to the mark. Turn off if your logo image already contains the name. */
    showName: true,
  },
  /** Where admins should ask for help; shown on the login page. Set to null to hide. */
  supportEmail: 'support@example.com' as string | null,
} as const;
