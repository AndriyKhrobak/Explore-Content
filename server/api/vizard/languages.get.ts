import { VIZARD_LANGUAGES } from '~/server/utils/vizard';

export default defineEventHandler(() => ({
  languages: VIZARD_LANGUAGES,
}));
