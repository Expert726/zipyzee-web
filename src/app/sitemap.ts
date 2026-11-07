import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/config';
import { LANGUAGES } from '@/i18n/languages';
import { TOOLS } from '@/tools/registry';

export default function sitemap(): MetadataRoute.Sitemap {
  const paths = ['', '/tools', '/zee', ...TOOLS.filter((x) => x.web).map((x) => `/tools/${x.id}`)];
  return LANGUAGES.flatMap((l) => paths.map((p) => ({ url: `${SITE_URL}/${l}${p}` })));
}
