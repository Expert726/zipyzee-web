// Resize image presets on the web, by platform (the app has 4: Instagram post, WhatsApp DP, Facebook cover, A4 print,
// kept here with the same values). Each preset is filled exactly, cut from the centre (resizeTarget 'cover').
// Sizes are the platforms' recommended pixels; print sizes at 300 dpi.

export type Preset = { value: string; label: string; w: number; h: number };
export type PresetGroup = { label: string; presets: Preset[] };

export const PRESET_GROUPS: PresetGroup[] = [
  {
    label: 'Instagram',
    presets: [
      { value: 'instagram', label: 'Instagram post', w: 1080, h: 1350 },
      { value: 'ig-square', label: 'Square post', w: 1080, h: 1080 },
      { value: 'ig-story', label: 'Story or Reel', w: 1080, h: 1920 },
      { value: 'ig-profile', label: 'Profile photo', w: 320, h: 320 },
    ],
  },
  {
    label: 'WhatsApp',
    presets: [
      { value: 'whatsapp', label: 'WhatsApp DP', w: 500, h: 500 },
      { value: 'wa-status', label: 'Status', w: 1080, h: 1920 },
    ],
  },
  {
    label: 'Facebook',
    presets: [
      { value: 'facebook', label: 'Facebook cover', w: 820, h: 312 },
      { value: 'fb-post', label: 'Post', w: 1200, h: 630 },
      { value: 'fb-story', label: 'Story', w: 1080, h: 1920 },
      { value: 'fb-profile', label: 'Profile photo', w: 320, h: 320 },
    ],
  },
  {
    label: 'YouTube',
    presets: [
      { value: 'yt-thumb', label: 'Thumbnail', w: 1280, h: 720 },
      { value: 'yt-banner', label: 'Channel banner', w: 2560, h: 1440 },
      { value: 'yt-short', label: 'Shorts', w: 1080, h: 1920 },
      { value: 'yt-profile', label: 'Profile photo', w: 800, h: 800 },
    ],
  },
  {
    label: 'TikTok',
    presets: [
      { value: 'tt-video', label: 'Video cover', w: 1080, h: 1920 },
      { value: 'tt-profile', label: 'Profile photo', w: 200, h: 200 },
    ],
  },
  {
    label: 'X (Twitter)',
    presets: [
      { value: 'x-post', label: 'Post', w: 1600, h: 900 },
      { value: 'x-header', label: 'Header', w: 1500, h: 500 },
      { value: 'x-profile', label: 'Profile photo', w: 400, h: 400 },
    ],
  },
  {
    label: 'LinkedIn',
    presets: [
      { value: 'li-post', label: 'Post', w: 1200, h: 627 },
      { value: 'li-cover', label: 'Cover', w: 1584, h: 396 },
      { value: 'li-profile', label: 'Profile photo', w: 400, h: 400 },
    ],
  },
  {
    label: 'Pinterest and Snapchat',
    presets: [
      { value: 'pin', label: 'Pin', w: 1000, h: 1500 },
      { value: 'snap', label: 'Snapchat', w: 1080, h: 1920 },
    ],
  },
  {
    label: 'Print and documents',
    presets: [
      { value: 'a4', label: 'A4 print', w: 2480, h: 3508 },
      { value: 'a5', label: 'A5', w: 1748, h: 2480 },
      { value: 'letter', label: 'Letter', w: 2550, h: 3300 },
      { value: '4x6', label: '6 × 4 in photo', w: 1800, h: 1200 },
      { value: '5x7', label: '7 × 5 in photo', w: 2100, h: 1500 },
      { value: 'passport', label: 'Passport 35 × 45 mm', w: 413, h: 531 },
      { value: 'us-passport', label: 'US passport 2 × 2 in', w: 600, h: 600 },
    ],
  },
  {
    label: 'Screens',
    presets: [
      { value: 'hd', label: 'HD 720p', w: 1280, h: 720 },
      { value: 'fhd', label: 'Full HD 1080p', w: 1920, h: 1080 },
      { value: '4k', label: '4K', w: 3840, h: 2160 },
      { value: 'phone-wall', label: 'Phone wallpaper', w: 1080, h: 2340 },
      { value: 'app-icon', label: 'App icon', w: 1024, h: 1024 },
    ],
  },
];

export const ALL_PRESETS: Preset[] = PRESET_GROUPS.flatMap((g) => g.presets);
export const presetOf = (value: string) => ALL_PRESETS.find((p) => p.value === value) ?? ALL_PRESETS[0];
