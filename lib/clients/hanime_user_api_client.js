const { HanimeClient } = require('@nekolab/hanime');

/**
 * Clean API wrapper for Hanime operations
 * Provides methods without console logging for use in other projects
 * Automatically handles session token expiration and refresh
 */
class HanimeUserApi {
  /**
   * Create a new HanimeAPI instance
   * @param {string} sessionToken - Optional existing session token
   * @param {string} email - Optional user email for auto-refresh
   * @param {string} password - Optional user password for auto-refresh
   * @param {number} sessionTokenExpireTimeUnix - Optional expiration time (Unix timestamp)
   */
  constructor(sessionToken = null, email = null, password = null, sessionTokenExpireTimeUnix = null) {
    this.client = new HanimeClient(sessionToken);
    this.email = email;
    this.password = password;
    this.sessionTokenExpireTimeUnix = sessionTokenExpireTimeUnix;
    this.refreshBufferSeconds = 300; // Refresh 5 minutes before expiration
  }

  // ============================================================================
  // Public Methods
  // ============================================================================

  /**
   * Login with email and password
   * @param {string} email - User email
   * @param {string} password - User password
   * @returns {Promise<Object>} Login result with user info and session token
   */
  async login(email, password) {
    const loginResult = await this.client.login(email, password);

    // Store credentials and expiration for auto-refresh
    this.email = email;
    this.password = password;
    this.sessionTokenExpireTimeUnix = loginResult.sessionTokenExpireTimeUnix;

    return {
      user: {
        id: loginResult.user.id,
        email: loginResult.user.email,
        name: loginResult.user.name,
        slug: loginResult.user.slug,
        coins: loginResult.user.coins,
        avatarUrl: loginResult.user.avatarUrl,
        isPremium: loginResult.user.isAbleToAccessPremium,
        premiumStatus: loginResult.user.btPremiumStatus
      },
      sessionToken: loginResult.sessionToken,
      sessionTokenExpireTimeUnix: loginResult.sessionTokenExpireTimeUnix,
      sessionTokenExpiresAt: new Date(loginResult.sessionTokenExpireTimeUnix * 1000),
      fullResponse: loginResult // Include full response if needed
    };
  }

  /**
   * Get video details and streams by video ID
   * Automatically refreshes session token if expired
   * @param {number} videoId - Numeric video ID
   * @returns {Promise<Object>} Video information with streams
   */
  async getVideoDetails(videoId) {
    // Ensure session is valid before making API call
    await this._ensureValidSession();

    const video = await this.client.getHentaiVideo(videoId);

    const result = {
      videoId: videoId,
      videoInfo: {
        name: video.hentaiVideo.name,
        slug: video.hentaiVideo.slug,
        views: video.hentaiVideo.views,
        interests: video.hentaiVideo.interests || null,
        likes: video.hentaiVideo.likes,
        dislikes: video.hentaiVideo.dislikes,
        downloads: video.hentaiVideo.downloads,
        brand: video.hentaiVideo.brand,
        isCensored: video.hentaiVideo.isCensored,
        description: video.hentaiVideo.description?.replace(/<[^>]*>/g, '') || '',
        tags: video.hentaiVideo.hentaiTags?.map(t => t.text) || [],
        releasedAt: new Date(video.hentaiVideo.releasedAtUnix * 1000),
        releasedAtUnix: video.hentaiVideo.releasedAtUnix,
        createdAt: new Date(video.hentaiVideo.createdAtUnix * 1000),
        createdAtUnix: video.hentaiVideo.createdAtUnix,
        duration: video.hentaiVideo.durationInMs
      },
      streams: []
    };

    // Extract streams from all servers
    if (video.videosManifest && video.videosManifest.servers) {
      video.videosManifest.servers.forEach((server) => {
        if (server.streams && server.streams.length > 0) {
          server.streams.forEach((stream) => {
            result.streams.push({
              serverName: server.name,
              serverId: server.id,
              resolution: `${stream.width}x${stream.height}`,
              width: stream.width,
              height: stream.height,
              url: stream.url || null,
              duration: stream.durationInMs,
              durationFormatted: this._formatDuration(stream.durationInMs),
              fileSize: stream.filesizeMbs,
              mimeType: stream.mimeType,
              extension: stream.extension,
              isGuestAllowed: stream.isGuestAllowed,
              isMemberAllowed: stream.isMemberAllowed,
              isPremiumAllowed: stream.isPremiumAllowed,
              isDownloadable: stream.isDownloadable
            });
          });
        }
      });
    }

    return result;
  }

  /**
   * Get current session token
   * @returns {string|null} Session token or null if not logged in
   */
  getSessionToken() {
    return this.client.sessionToken || null;
  }

  /**
   * Get session token expiration time (Unix timestamp)
   * @returns {number|null} Expiration time or null if not set
   */
  getSessionTokenExpireTimeUnix() {
    return this.sessionTokenExpireTimeUnix || null;
  }

  /**
   * Check if user is logged in
   * @returns {boolean} True if logged in
   */
  isLoggedIn() {
    return this.getSessionToken() !== null;
  }

  /**
   * Set credentials for auto-refresh (useful if credentials weren't provided in constructor)
   * @param {string} email - User email
   * @param {string} password - User password
   */
  setCredentials(email, password) {
    this.email = email;
    this.password = password;
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  /**
   * Check if session token is expired or about to expire
   * @private
   * @returns {boolean} True if token needs refresh
   */
  _needsRefresh() {
    if (!this.sessionTokenExpireTimeUnix) {
      return true; // No expiration time means we need to login
    }

    const currentTimeUnix = Math.floor(Date.now() / 1000);
    const timeUntilExpiration = this.sessionTokenExpireTimeUnix - currentTimeUnix;

    // Refresh if expired or within buffer time
    return timeUntilExpiration <= this.refreshBufferSeconds;
  }

  /**
   * Refresh session token if needed
   * @private
   * @returns {Promise<boolean>} True if refresh was successful or not needed
   */
  async _ensureValidSession() {
    if (!this._needsRefresh()) {
      return true; // Token is still valid
    }

    // Check if we have credentials to refresh
    if (!this.email || !this.password) {
      return false; // Cannot refresh without credentials
    }

    try {
      const loginResult = await this.login(this.email, this.password);
      // Update client with new token
      this.client = new HanimeClient(loginResult.sessionToken);
      return true;
    } catch (error) {
      // Refresh failed, but don't throw - let the API call handle it
      return false;
    }
  }

  /**
   * Format duration in milliseconds to MM:SS format
   * @private
   * @param {number} ms - Duration in milliseconds
   * @returns {string} Formatted duration
   */
  _formatDuration(ms) {
    if (!ms) return '0:00';
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}:${String(seconds).padStart(2, '0')}`;
  }
}

module.exports = HanimeUserApi;
