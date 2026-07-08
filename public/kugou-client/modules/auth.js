import { storage } from './storage.js';
import { logger } from './logger.js';

export function createAuth(apiClient, onAuthChange) {
  return {
    refreshLock: null,
    get state() {
      return storage.getAuth();
    },
    save(partial) {
      storage.setAuth(partial);
      onAuthChange(storage.getAuth());
    },
    clear() {
      storage.clearAuth();
      onAuthChange(storage.getAuth());
    },
    isLoggedIn() {
      const s = this.state;
      return Boolean(s.token && s.userid);
    },
    buildCookie() {
      const s = this.state;
      const parts = [];
      if (s.token) parts.push(`token=${s.token}`);
      if (s.userid) parts.push(`userid=${s.userid}`);
      if (s.dfid) parts.push(`dfid=${s.dfid}`);
      return parts.join(';');
    },
    normalizeLoginPayload(payload) {
      const direct = payload?.data || payload || {};
      return {
        token: direct.token || direct.user_token || direct.login_token || '',
        userid: String(direct.userid || direct.user_id || ''),
        dfid: direct.dfid || this.state.dfid || ''
      };
    },
    async ensureDfid() {
      const current = this.state;
      if (current.dfid) return current.dfid;
      const res = await apiClient.rawGet('/register/dev', { timestamp: Date.now() });
      const data = res?.data || res || {};
      const dfid = data.dfid || data.data?.dfid || data.device_id || data.dfid_str || '';
      if (!dfid) throw new Error('未能从 /register/dev 响应中解析出 dfid');
      this.save({ dfid });
      logger.info('已获取 dfid');
      return dfid;
    },
    async refreshToken(force = false) {
      if (this.refreshLock && !force) return this.refreshLock;
      this.refreshLock = (async () => {
        const s = this.state;
        if (!s.token || !s.userid) {
          throw new Error('当前没有可刷新的 token / userid');
        }
        logger.info('开始刷新 token');
        const res = await apiClient.rawGet('/login/token', { token: s.token, userid: s.userid, timestamp: Date.now() });
        const payload = this.normalizeLoginPayload(res);
        const next = {
          token: payload.token || s.token,
          userid: payload.userid || s.userid,
          dfid: payload.dfid || s.dfid,
          lastRefreshAt: new Date().toISOString()
        };
        this.save(next);
        logger.info('token 刷新成功');
        return next;
      })();
      try {
        return await this.refreshLock;
      } finally {
        this.refreshLock = null;
      }
    },
    async loginByCode(mobile, code) {
      await this.ensureDfid().catch(() => null);
      const res = await apiClient.rawGet('/login/cellphone', { mobile, code, timestamp: Date.now() });
      const payload = this.normalizeLoginPayload(res);
      if (!payload.token || !payload.userid) {
        throw new Error('登录成功响应中未找到 token 或 userid，请检查接口返回');
      }
      this.save({
        token: payload.token,
        userid: payload.userid,
        dfid: payload.dfid || this.state.dfid || '',
        lastRefreshAt: new Date().toISOString()
      });
      logger.info('短信登录成功');
    },
    applyLoginPayload(payload) {
      const normalized = this.normalizeLoginPayload(payload);
      if (!normalized.token || !normalized.userid) {
        throw new Error('登录态数据不完整，缺少 token 或 userid');
      }
      this.save({
        token: normalized.token,
        userid: normalized.userid,
        dfid: normalized.dfid || this.state.dfid || '',
        lastRefreshAt: new Date().toISOString()
      });
      logger.info('登录态已写入本地');
    },
    importManual(input) {
      const parsed = JSON.parse(input);
      if (!parsed.token || !parsed.userid) {
        throw new Error('导入失败，至少需要 token 和 userid');
      }
      this.save({
        token: String(parsed.token),
        userid: String(parsed.userid),
        dfid: String(parsed.dfid || ''),
        lastRefreshAt: parsed.lastRefreshAt || ''
      });
      logger.info('已导入本地凭证');
    }
  };
}
