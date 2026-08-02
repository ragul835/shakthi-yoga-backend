import { IsIn, IsString, MaxLength, MinLength } from 'class-validator';

export const SITE_PAGE_KEYS = ['home', 'about', 'pricing', 'contact'] as const;
export type SitePageKey = (typeof SITE_PAGE_KEYS)[number];

export const SITE_CONTENT_FIELDS: Record<SitePageKey, readonly string[]> = {
  home: ['heroEyebrow', 'heroImageUrl', 'heroTitle', 'heroDescription', 'featuresEyebrow', 'featuresTitle', 'classesEyebrow', 'classesTitle', 'testimonialsEyebrow', 'testimonialsTitle'],
  about: ['heroEyebrow', 'storyImageUrl', 'heroTitle', 'storyTitle', 'storyParagraphOne', 'storyParagraphTwo', 'storyParagraphThree', 'teamEyebrow', 'teamTitle', 'contactEyebrow', 'contactTitle'],
  pricing: ['heroEyebrow', 'heroTitle', 'heroDescription', 'footerNote'],
  contact: ['studioName', 'logoImageUrl', 'studioDescription', 'location', 'locationLabel', 'mapUrl', 'phone', 'email', 'instagramUrl', 'facebookUrl', 'youtubeUrl', 'ctaTitle', 'ctaDescription', 'newsletterDescription', 'authImageUrl'],
};

export class UpdateSiteContentDto {
  @IsString()
  @IsIn(SITE_PAGE_KEYS)
  pageKey: SitePageKey;

  @IsString()
  @MinLength(1)
  @MaxLength(100_000)
  content: string;
}
