import { storage } from './modules/storage.js';
import { logger } from './modules/logger.js';
import { createUi } from './modules/ui/ui.js';
import { createApiClient } from './modules/api-client.js';
import { createAuth } from './modules/auth.js';
import { createUserService } from './modules/services/user-service.js';
import { createPlaylistService } from './modules/services/playlist-service.js';
import { createAlbumService } from './modules/services/album-service.js';
import { createArtistService } from './modules/services/artist-service.js';
import { createVideoService } from './modules/services/video-service.js';
import { createSearchService } from './modules/services/search-service.js';
import { createSongService } from './modules/services/song-service.js';
import { createPlayerController } from './modules/player/player-controller.js';
import { createSessionRefresh } from './modules/session-refresh.js';
import { createQrLoginController } from './modules/qr-login-controller.js';

const ui = createUi();
if (typeof ui.renderQrLogin !== 'function') {
  ui.renderQrLogin = (state = {}) => {
    if (ui.els.qrImage) ui.els.qrImage.src = state.image || ui.defaultCover();
    if (ui.els.qrStatus) ui.els.qrStatus.textContent = state.statusText || '未生成二维码';
    if (ui.els.qrMeta) {
      const parts = [];
      if (state.key) parts.push(`key: ${state.key}`);
      if (state.url) parts.push(state.url);
      ui.els.qrMeta.textContent = parts.join(' | ');
    }
  };
}
if (typeof ui.renderQrLogin !== 'function') {
  ui.renderQrLogin = (state = {}) => {
    if (ui.els.qrImage) ui.els.qrImage.src = state.image || ui.defaultCover();
    if (ui.els.qrStatus) ui.els.qrStatus.textContent = state.statusText || '未生成二维码';
    if (ui.els.qrMeta) {
      const parts = [];
      if (state.key) parts.push(`key: ${state.key}`);
      if (state.url) parts.push(state.url);
      ui.els.qrMeta.textContent = parts.join(' | ');
    }
  };
}
logger.setRenderer((entries) => ui.renderLogs(entries));

let auth;
const apiClient = createApiClient(() => auth);
auth = createAuth(apiClient, (state) => ui.renderAuth(state));

const userService = createUserService(apiClient);
const playlistService = createPlaylistService(apiClient);
const albumService = createAlbumService(apiClient);
const artistService = createArtistService(apiClient);
const videoService = createVideoService(apiClient);
const searchService = createSearchService(apiClient, playlistService);
const songService = createSongService(apiClient, auth);
const player = createPlayerController(ui, songService);

const playerDefaults = {
  title: '当前未选择歌曲',
  sub: '从搜索结果或歌单列表中点击播放。',
  url: '',
  cover: ''
};

const videoDefaults = {
  title: '当前未选择 MV',
  sub: '从 MV 搜索结果中点击播放 MV。',
  url: '',
  cover: ''
};

const scheduler = createSessionRefresh(auth);
const qrLogin = createQrLoginController({ userService, auth, ui, scheduler });

const app = {
  async run(task) {
    try {
      await task();
    } catch (error) {
      logger.error(error.message || String(error));
    }
  },
  async loadPlaylistTracks(id, source = '歌单') {
    if (!id) {
      logger.warn(`${source} 缺少 id`);
      return;
    }
    const list = await playlistService.getPlaylistTracks(id);
    ui.renderSearchResults(list);
    logger.info(`${source}歌曲已加载，共 ${list.length} 首，已渲染到搜索结果区`);
  },
  async loadAlbumSongs(id, source = '专辑') {
    if (!id) {
      logger.warn(`${source} 缺少 id`);
      return;
    }
    const list = await albumService.getAlbumSongs(id);
    ui.renderSearchResults(list);
    logger.info(`${source}歌曲已加载，共 ${list.length} 首，已渲染到搜索结果区`);
  },
  async loadArtistSongs(id, source = '歌手') {
    if (!id) {
      logger.warn(`${source} 缺少 id`);
      return;
    }
    const list = await artistService.getArtistSongs(id);
    ui.renderSearchResults(list);
    logger.info(`${source}歌曲已加载，共 ${list.length} 首，已渲染到搜索结果区`);
  },
  async playMv(meta) {
    const payload = await videoService.getVideoUrl(meta.hash);
    const url = videoService.extractPlayableUrl(payload, meta.hash);
    logger.info(`MV URL 响应: ${JSON.stringify(payload).slice(0, 260)}`);
    if (!url) {
      throw new Error('未从 /video/url 响应中解析到可播放 MV URL');
    }
    ui.renderVideoPlayer({
      title: meta.title || '未命名 MV',
      sub: meta.artist || '未知歌手',
      url,
      cover: meta.cover || ''
    });
    try {
      await ui.els.videoPlayer.play();
    } catch (error) {
      logger.warn(`MV 自动播放失败: ${error.message}`);
    }
  },
  bind() {
    document.getElementById('save-settings').addEventListener('click', () => {
      const settings = {
        baseUrl: ui.els.baseUrl.value.trim(),
        platform: ui.els.platform.value,
        refreshMinutes: Math.max(5, Number(ui.els.refreshMinutes.value) || 30),
        autoRefreshEnabled: ui.els.autoRefresh.value === 'true'
      };
      storage.setSettings(settings);
      scheduler.start();
      logger.info('配置已保存');
    });

    document.getElementById('ensure-dfid').addEventListener('click', async () => {
      await this.run(async () => {
        await auth.ensureDfid();
      });
    });

    document.getElementById('manual-refresh').addEventListener('click', async () => {
      await this.run(async () => {
        await auth.refreshToken(true);
      });
    });

    document.getElementById('logout').addEventListener('click', () => {
      auth.clear();
      qrLogin.stop(true);
      qrLogin.reset();
      player.reset(playerDefaults);
      ui.renderVideoPlayer(videoDefaults);
      logger.warn('本地登录态已清空');
    });

    document.getElementById('send-code').addEventListener('click', async () => {
      await this.run(async () => {
        const mobile = ui.els.mobile.value.trim();
        if (!mobile) throw new Error('请先输入手机号');
        await userService.sendCode(mobile);
        logger.info('验证码请求已发送');
      });
    });

    document.getElementById('login-btn').addEventListener('click', async () => {
      await this.run(async () => {
        const mobile = ui.els.mobile.value.trim();
        const code = ui.els.smsCode.value.trim();
        if (!mobile || !code) throw new Error('请先填写手机号和验证码');
        await auth.loginByCode(mobile, code);
        scheduler.start();
      });
    });

    document.getElementById('start-qr-login').addEventListener('click', async () => {
      await this.run(async () => {
        await qrLogin.start();
      });
    });

    document.getElementById('refresh-qr-login').addEventListener('click', async () => {
      await this.run(async () => {
        await qrLogin.start();
      });
    });

    document.getElementById('stop-qr-login').addEventListener('click', () => {
      qrLogin.stop();
    });

    document.getElementById('import-auth').addEventListener('click', () => {
      this.run(async () => {
        const raw = ui.els.manualAuth.value.trim();
        if (!raw) throw new Error('请粘贴 token / userid / dfid JSON');
        auth.importManual(raw);
        scheduler.start();
      });
    });

    document.getElementById('search-btn').addEventListener('click', async () => {
      await this.run(async () => {
        const keywords = ui.els.searchKeywords.value.trim();
        const type = ui.els.searchType.value;
        if (!keywords) throw new Error('请输入搜索关键词');
        const list = await searchService.searchSongs(keywords, type);
        ui.renderSearchResults(list);
        logger.info(`搜索完成，返回 ${list.length} 条结果`);
      });
    });

    document.getElementById('clear-results').addEventListener('click', () => {
      ui.renderSearchResults([]);
    });

    document.getElementById('load-playlists').addEventListener('click', async () => {
      await this.run(async () => {
        const list = await playlistService.getMyPlaylists();
        ui.renderPlaylists(list);
        logger.info(`已加载 ${list.length} 个歌单`);
      });
    });

    document.getElementById('clear-playlists').addEventListener('click', () => {
      ui.renderPlaylists([]);
    });

    document.getElementById('clear-logs').addEventListener('click', () => {
      logger.clear();
    });

    ui.els.searchResults.addEventListener('click', async (event) => {
      const urlButton = event.target.closest('button[data-action="song-url"]');
      if (urlButton) {
        await this.run(async () => {
          const payload = await songService.getSongUrl(
            urlButton.dataset.hash,
            urlButton.dataset.albumId,
            urlButton.dataset.albumAudioId
          );
          const url = songService.extractPlayableUrl(payload);
          logger.info(`歌曲 URL 响应: ${JSON.stringify(payload).slice(0, 260)}`);
          if (!url && songService.isMissingPlayableSource(payload)) {
            const reason = songService.explainMissingPlayableSource(payload);
            ui.markSongUnavailable(urlButton.dataset.hash, reason);
            logger.warn(reason);
            return;
          }
          logger.info(`解析到 URL: ${url || '无'}`);
        });
        return;
      }

      const playlistButton = event.target.closest('button[data-action="playlist-tracks"]');
      if (playlistButton) {
        await this.run(async () => {
          await this.loadPlaylistTracks(playlistButton.dataset.id, '搜索歌单');
        });
        return;
      }

      const albumButton = event.target.closest('button[data-action="album-tracks"]');
      if (albumButton) {
        await this.run(async () => {
          await this.loadAlbumSongs(albumButton.dataset.id, '搜索专辑');
        });
        return;
      }

      const authorButton = event.target.closest('button[data-action="author-tracks"]');
      if (authorButton) {
        await this.run(async () => {
          await this.loadArtistSongs(authorButton.dataset.id, '搜索歌手');
        });
        return;
      }

      const mvUrlButton = event.target.closest('button[data-action="mv-url"]');
      if (mvUrlButton) {
        await this.run(async () => {
          const payload = await videoService.getVideoUrl(mvUrlButton.dataset.id);
          const url = videoService.extractPlayableUrl(payload, mvUrlButton.dataset.id);
          logger.info(`MV URL 响应: ${JSON.stringify(payload).slice(0, 260)}`);
          logger.info(`解析到 MV URL: ${url || '无'}`);
        });
        return;
      }

      const mvPlayButton = event.target.closest('button[data-action="play-mv"]');
      if (mvPlayButton) {
        await this.run(async () => {
          await this.playMv({
            hash: mvPlayButton.dataset.id,
            title: mvPlayButton.dataset.title,
            artist: mvPlayButton.dataset.artist,
            cover: mvPlayButton.dataset.cover
          });
        });
        return;
      }

      const playButton = event.target.closest('button[data-action="play-song"]');
      if (!playButton) return;
      await this.run(async () => {
        await player.playSong({
          title: playButton.dataset.title,
          artist: playButton.dataset.artist,
          hash: playButton.dataset.hash,
          albumId: playButton.dataset.albumId,
          albumAudioId: playButton.dataset.albumAudioId,
          duration: playButton.dataset.duration,
          cover: playButton.dataset.cover
        });
      });
    });

    ui.els.playlistResults.addEventListener('click', async (event) => {
      const button = event.target.closest('button[data-action="playlist-tracks"]');
      if (!button) return;
      await this.run(async () => {
        await this.loadPlaylistTracks(button.dataset.id, '歌单');
      });
    });
  },
  init() {
    ui.renderSettings(storage.getSettings());
    ui.renderAuth(storage.getAuth());
    qrLogin.reset();
    ui.renderSearchResults([]);
    ui.renderPlaylists([]);
    ui.renderLogs([]);
    ui.renderPlayer(playerDefaults);
    ui.renderVideoPlayer(videoDefaults);
    player.init();
    player.resetLyrics();
    scheduler.start();
    this.bind();
    logger.info('页面已初始化');
  }
};

app.init();
