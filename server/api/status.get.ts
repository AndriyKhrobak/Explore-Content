export default defineEventHandler(() => {
  return {
    vizardReady: isVizardConfigured(),
    youtubeReady: isEnvOAuthConfigured(),
  };
});
