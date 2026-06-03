import { useEffect } from 'react';

const ADMIN_FAVICON = '/admin-favicon.svg';

export function useAdminFavicon() {
  useEffect(() => {
    const links = [...document.querySelectorAll('link[rel="icon"]')];
    const previous = links.map((link) => ({
      el: link,
      href: link.getAttribute('href'),
      type: link.getAttribute('type'),
    }));

    for (const link of links) {
      link.setAttribute('href', ADMIN_FAVICON);
      link.setAttribute('type', 'image/svg+xml');
    }

    if (!links.length) {
      const link = document.createElement('link');
      link.rel = 'icon';
      link.type = 'image/svg+xml';
      link.href = ADMIN_FAVICON;
      document.head.appendChild(link);
      return () => link.remove();
    }

    return () => {
      for (const { el, href, type } of previous) {
        if (href) el.setAttribute('href', href);
        else el.removeAttribute('href');
        if (type) el.setAttribute('type', type);
        else el.removeAttribute('type');
      }
    };
  }, []);
}
