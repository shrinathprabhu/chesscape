import { CANONICAL_URL, SITE_DESCRIPTION, SITE_TITLE } from './site';

export const faqs = [
  {
    id: 'what-is-chesscape',
    question: 'What is Chesscape?',
    answer:
      'Chesscape is a free daily chess escape puzzle. You have 30 seconds per try to find one of one or two legal moves that avoids checkmate on the opponent’s next turn. It is a short defensive chess exercise, with retries and a shareable result.',
  },
  {
    id: 'how-to-play',
    question: 'How do I play a Chesscape puzzle?',
    answer:
      'Press start to reveal the position and begin a 30-second timer. Tap or click your piece, then a highlighted destination; you can also drag on desktop. One legal move is your answer. A correct escape wins the round; a wrong move shows the opponent’s checkmate reply. Illegal moves do not end the round.',
  },
  {
    id: 'retry',
    question: 'Can I retry after a wrong move or timeout?',
    answer:
      'Yes. Every retry uses the same starting position and a fresh 30 seconds. Your unfinished puzzle stays saved in this browser across visits, even after midnight. Refreshing an active round keeps its original deadline.',
  },
  {
    id: 'win-mode',
    question: 'What is Win it mode?',
    answer:
      'After you solve the daily escape, Win it lets you play the same position to the end against a computer opponent running on your device. The clock starts at 0:00, runs only while it is your move and has no limit. Checkmate wins; a loss, draw or resignation lets you restart from the escape position. Your fastest win for each puzzle is saved in this browser. Some positions leave you down material after the escape, so not every day is an easy win.',
  },
  {
    id: 'next-puzzle',
    question: 'When does the next Chesscape puzzle unlock?',
    answer:
      'After you solve your current puzzle, the next one unlocks at the following midnight UTC. The page shows a countdown. Players starting fresh on the same UTC date receive the same puzzle; anyone with an unfinished puzzle keeps it until solved.',
  },
  {
    id: 'puzzle-source',
    question: 'Where do Chesscape puzzles come from?',
    answer:
      'Chesscape selects a verified original puzzle from a bundled collection using the UTC date. The current 16-position rotation repeats every 16 days. Each position has one or two moves that avoid immediate checkmate; this does not guarantee a winning position or rule out a longer forced mate. The source is shown below the game.',
  },
  {
    id: 'mobile-offline',
    question: 'Does Chesscape work on mobile or offline?',
    answer:
      'Yes. Play with touch controls on a phone or tablet, or with a mouse and keyboard on desktop. You can install Chesscape as a progressive web app. Once a puzzle is loaded, starts, moves and retries work offline in that tab. Reopening the app or loading the next puzzle needs a connection.',
  },
  {
    id: 'progress-privacy',
    question: 'Where are my progress and results stored?',
    answer:
      'Progress and personal history are stored in this browser. Clearing site data or switching browsers starts fresh. Moves and elapsed time are checked on your device, and solutions remain in the active page’s memory. Results are personal, with no competitive leaderboard or server-certified timing.',
  },
  {
    id: 'creator',
    question: 'Who created Chesscape?',
    answer:
      'Chesscape is made by Shrinath Prabhu as part of lowkey.tools, a collection of small browser tools. Shrinath also creates OwlEye Analytics, a hosted, cookie-free web analytics product for founders and product teams.',
    links: [
      { label: 'Shrinath Prabhu’s portfolio', url: 'https://shrinath.me' },
      { label: 'OwlEye Analytics', url: 'https://owleye.dev' },
    ],
  },
];

export const structuredData = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'Person',
      '@id': 'https://shrinath.me/#person',
      name: 'Shrinath Prabhu',
      url: 'https://shrinath.me',
      sameAs: ['https://x.com/shrinath_prabhu'],
      subjectOf: { '@id': `${CANONICAL_URL}#webpage` },
    },
    {
      '@type': 'Organization',
      '@id': 'https://lowkey.tools/#organization',
      name: 'Lowkey Tools',
      url: 'https://lowkey.tools',
      founder: { '@id': 'https://shrinath.me/#person' },
    },
    {
      '@type': 'WebSite',
      '@id': 'https://lowkey.tools/#website',
      name: 'Lowkey Tools',
      url: 'https://lowkey.tools',
      publisher: { '@id': 'https://lowkey.tools/#organization' },
    },
    {
      '@type': 'WebSite',
      '@id': `${CANONICAL_URL}#website`,
      name: 'Chesscape',
      url: CANONICAL_URL,
      description: SITE_DESCRIPTION,
      inLanguage: 'en',
      publisher: { '@id': 'https://lowkey.tools/#organization' },
      isPartOf: { '@id': 'https://lowkey.tools/#website' },
    },
    {
      '@type': 'ImageObject',
      '@id': `${CANONICAL_URL}#social-image`,
      url: `${CANONICAL_URL}og.png`,
      contentUrl: `${CANONICAL_URL}og.png`,
      width: 1730,
      height: 909,
      caption: 'Chesscape — find your escape in thirty seconds.',
    },
    {
      '@type': 'WebPage',
      '@id': `${CANONICAL_URL}#webpage`,
      url: CANONICAL_URL,
      name: SITE_TITLE,
      description: SITE_DESCRIPTION,
      inLanguage: 'en',
      isPartOf: { '@id': `${CANONICAL_URL}#website` },
      primaryImageOfPage: { '@id': `${CANONICAL_URL}#social-image` },
      mainEntity: { '@id': `${CANONICAL_URL}#game` },
      author: { '@id': 'https://shrinath.me/#person' },
      hasPart: { '@id': `${CANONICAL_URL}#faq` },
      mentions: { '@id': 'https://owleye.dev/#software' },
    },
    {
      '@type': ['WebApplication', 'VideoGame'],
      '@id': `${CANONICAL_URL}#game`,
      name: 'Chesscape',
      url: CANONICAL_URL,
      description: SITE_DESCRIPTION,
      applicationCategory: 'GameApplication',
      operatingSystem: 'Any',
      browserRequirements:
        'Requires JavaScript. Browser storage keeps progress across visits.',
      gamePlatform: 'Web browser',
      playMode: 'https://schema.org/SinglePlayer',
      genre: ['Chess', 'Puzzle'],
      inLanguage: 'en',
      isAccessibleForFree: true,
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
      creator: { '@id': 'https://shrinath.me/#person' },
      publisher: { '@id': 'https://lowkey.tools/#organization' },
      image: `${CANONICAL_URL}icon-512.png`,
    },
    {
      '@type': 'SoftwareApplication',
      '@id': 'https://owleye.dev/#software',
      name: 'OwlEye Analytics',
      url: 'https://owleye.dev',
      description:
        'Hosted, cookie-free web analytics for founders and product teams.',
      applicationCategory: 'BusinessApplication',
      creator: { '@id': 'https://shrinath.me/#person' },
    },
    {
      '@type': 'FAQPage',
      '@id': `${CANONICAL_URL}#faq`,
      url: `${CANONICAL_URL}#faq`,
      isPartOf: { '@id': `${CANONICAL_URL}#webpage` },
      mainEntity: faqs.map((faq) => ({
        '@type': 'Question',
        name: faq.question,
        acceptedAnswer: { '@type': 'Answer', text: faq.answer },
      })),
    },
  ],
};
export const robotsText = `User-agent: *\nAllow: /\nDisallow: /api/\nDisallow: /__\n\nSitemap: ${CANONICAL_URL}sitemap.xml\n`;
export const sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>${CANONICAL_URL}</loc></url></urlset>\n`;
export const llmsText = `# Chesscape\n\n> A free daily chess escape puzzle by Shrinath Prabhu, part of lowkey.tools and from the creator of OwlEye Analytics.\n\nFind one of 1–2 moves that avoids immediate checkmate within 30 seconds. Retry the same puzzle until solved, then return after the following midnight UTC. Progress is local to one browser. A loaded puzzle works offline in the active tab; reopening or fetching another puzzle needs a connection.\n\nCanonical site: ${CANONICAL_URL}\n\n## Game and rules\n- [Chesscape](${CANONICAL_URL}): Canonical game page, instructions, puzzle sources and FAQs.\n- [Chesscape guide in Markdown](${CANONICAL_URL}index.md): Complete rules, retry and reset behavior, mobile use, privacy and creator attribution.\n- [Sitemap](${CANONICAL_URL}sitemap.xml): Canonical indexable page.\n\n## More from Lowkey\n- [SuperBrain](https://lowkey.tools/superbrain): Save notes, links and ideas in a private, local-first notebook.\n\n## Creator and related products\n- [Shrinath Prabhu](${'https://shrinath.me'}): Creator of Chesscape and OwlEye Analytics; portfolio and engineering work.\n- [OwlEye Analytics](https://owleye.dev): Hosted, cookie-free web analytics for founders and product teams.\n- [Lowkey Tools](https://lowkey.tools): The collection of small browser tools that includes Chesscape.\n`;
export const guideMarkdown = `# Chesscape — Daily Chess Escape Puzzle\n\n${SITE_DESCRIPTION}\n\nCanonical page: ${CANONICAL_URL}\n\n## Questions and answers\n\n${faqs.map((faq) => `### ${faq.question}\n\n${faq.answer}${faq.links ? '\n\n' + faq.links.map((link) => `[${link.label}](${link.url})`).join(' · ') : ''}`).join('\n\n')}\n\n## From the creator\n\nMade by [Shrinath Prabhu](https://shrinath.me), creator of [OwlEye Analytics](https://owleye.dev). OwlEye provides hosted, cookie-free web analytics for founders and product teams. Explore more small browser tools at [lowkey.tools](https://lowkey.tools). Follow [@shrinath_prabhu](https://x.com/shrinath_prabhu) on X.\n\n## Good moves, off the board\n\nSave the idea behind your escape in [SuperBrain](https://lowkey.tools/superbrain), a private, local-first notebook.\n`;
