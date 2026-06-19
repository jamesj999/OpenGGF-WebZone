// Promo background videos for the title cards. Each is encoded at the game's native
// resolution (pixel art, here 2x = 640x448) and upscaled nearest-neighbour in CSS
// (image-rendering: pixelated), so files stay small — well under Cloudflare Pages'
// 25 MiB per-file cap — and are served same-origin from /media.
//
// Each card gets its own reel as they're produced; S3K shares the S1 reel until it has
// one. To give a card a distinct video, drop it in public/media and point its constant.
export const PROMO_VIDEO_S1 = '/media/promo-s1.mp4';
export const PROMO_VIDEO_S2 = '/media/promo-s2.mp4';
export const PROMO_VIDEO_S3K = '/media/promo-s1.mp4';
