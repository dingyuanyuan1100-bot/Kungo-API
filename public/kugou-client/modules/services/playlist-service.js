const PLAYLIST_TRACK_PAGE_SIZE = 100;

export function createPlaylistService(apiClient) {
  return {
    async getMyPlaylists() {
      const payload = await apiClient.get('/user/playlist', { pagesize: 50 }, { requireAuth: true, injectCookie: true });
      return this.pickList(payload);
    },
    async getPlaylistTracks(id) {
      const payload = await apiClient.get(
        '/playlist/track/all',
        { id, pagesize: PLAYLIST_TRACK_PAGE_SIZE },
        { requireAuth: true, injectCookie: true }
      );
      return this.pickList(payload);
    },
    pickList(payload) {
      const list = this.extractList(payload);
      return this.normalizeItems(list);
    },
    extractList(payload) {
      if (Array.isArray(payload)) return payload;
      if (Array.isArray(payload?.data)) return payload.data;
      if (Array.isArray(payload?.data?.info)) return payload.data.info;
      if (Array.isArray(payload?.data?.data)) return payload.data.data;
      if (Array.isArray(payload?.data?.files)) return payload.data.files;
      if (Array.isArray(payload?.data?.songs)) return payload.data.songs;
      if (Array.isArray(payload?.data?.songlist)) return payload.data.songlist;
      if (Array.isArray(payload?.data?.lists)) return payload.data.lists;
      if (Array.isArray(payload?.data?.list)) return payload.data.list;
      if (Array.isArray(payload?.info)) return payload.info;
      if (Array.isArray(payload?.files)) return payload.files;
      if (Array.isArray(payload?.songlist)) return payload.songlist;
      if (Array.isArray(payload?.list)) return payload.list;
      if (Array.isArray(payload?.lists)) return payload.lists;
      if (Array.isArray(payload?.songs)) return payload.songs;
      return [];
    },
    normalizeItems(items) {
      return (Array.isArray(items) ? items : []).filter((item) => this.isRenderableItem(item));
    },
    isRenderableItem(item) {
      if (!item || typeof item !== 'object') return false;

      const title = item.songname || item.filename || item.name || item.album_name || '';
      const hash = item.hash || item.audio_id || item.album_audio_id || '';
      const shieldOnly = Number(item.shield || 0) === 1 && !title && !hash;
      const placeholderOnly = !title && !hash;

      if (shieldOnly) return false;
      if (placeholderOnly) return false;
      return true;
    }
  };
}
