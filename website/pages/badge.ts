/**
 * Shared "Built with Sovrium" badge for all website pages.
 *
 * Fixed bottom-right floating badge linking to the GitHub repository.
 * Hidden on small screens (mobile), visible from `sm` breakpoint upward.
 *
 * Usage: import and append to the `sections` array of any Page.
 */
export const builtWithSovriumBadge = {
  type: 'div' as const,
  props: {
    className: 'fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-50 hidden sm:block',
  },
  children: [
    {
      type: 'link' as const,
      props: {
        href: 'https://github.com/sovrium/sovrium',
        className:
          'flex items-center gap-2 bg-sovereignty-gray-900 hover:bg-sovereignty-gray-800 border border-sovereignty-gray-700 hover:border-sovereignty-accent text-sovereignty-gray-400 hover:text-sovereignty-accent px-3 py-2 rounded-lg text-xs font-medium transition-all duration-300 shadow-lg',
        target: '_blank',
        rel: 'noopener noreferrer',
      },
      children: [
        {
          type: 'span' as const,
          content: '\u26A1',
          props: { className: 'text-sm' },
        },
        {
          type: 'span' as const,
          content: 'Built with Sovrium',
        },
      ],
    },
  ],
}
