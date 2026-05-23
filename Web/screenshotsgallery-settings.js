(function () {
  'use strict';

  var PluginConfig = {
    pluginId: 'b6f3c1a2-9d4e-4a3b-8f2d-5e9c2a7f4b11'
  };

  function getApiClient() {
    if (window.ApiClient) {
      return window.ApiClient;
    }

    try {
      if (window.parent && window.parent !== window && window.parent.ApiClient) {
        return window.parent.ApiClient;
      }
    } catch (e) {
      // ignore cross-frame access issues and keep trying other sources
    }

    try {
      if (window.top && window.top !== window && window.top.ApiClient) {
        return window.top.ApiClient;
      }
    } catch (e) {
      // ignore cross-frame access issues and keep trying other sources
    }

    if (window.ServerConnections && typeof window.ServerConnections.currentApiClient === 'function') {
      return window.ServerConnections.currentApiClient();
    }

    try {
      if (window.parent && window.parent !== window && window.parent.ServerConnections && typeof window.parent.ServerConnections.currentApiClient === 'function') {
        return window.parent.ServerConnections.currentApiClient();
      }
    } catch (e) {
      // ignore cross-frame access issues and keep trying other sources
    }

    try {
      if (window.top && window.top !== window && window.top.ServerConnections && typeof window.top.ServerConnections.currentApiClient === 'function') {
        return window.top.ServerConnections.currentApiClient();
      }
    } catch (e) {
      // ignore cross-frame access issues and keep trying other sources
    }

    return null;
  }

  function getAuthToken() {
    const directClient = getApiClient();
    if (directClient && directClient.accessToken) {
      return directClient.accessToken;
    }

    const storageKeys = [
      'jellyfin_credentials',
      'emby_credentials',
      'jellyfin_auth',
      'emby_auth',
      'jellyfin-auth',
      'emby-auth'
    ];

    for (let i = 0; i < storageKeys.length; i++) {
      const raw = window.localStorage.getItem(storageKeys[i]);
      if (!raw) {
        continue;
      }

      try {
        const parsed = JSON.parse(raw);

        if (parsed && typeof parsed === 'object') {
          if (parsed.AccessToken) {
            return parsed.AccessToken;
          }

          if (Array.isArray(parsed.Servers) && parsed.Servers.length > 0) {
            const server = parsed.Servers[0];
            if (server && server.AccessToken) {
              return server.AccessToken;
            }
          }
        }
      } catch (e) {
        // ignore malformed storage payloads and keep trying
      }
    }

    return '';
  }

  function buildConfigUrl() {
    const token = getAuthToken();
    const url = new URL('/ScreenShotsGallery/api/config', window.location.origin);

    if (token) {
      url.searchParams.set('api_key', token);
    }

    return url.toString();
  }

  // Wait for the dashboard to inject an ApiClient (helps when the script runs early)
  function waitForApiClient(timeoutMs) {
    timeoutMs = typeof timeoutMs === 'number' ? timeoutMs : 10000;
    const start = Date.now();
    return new Promise(function (resolve) {
      (function check() {
        const api = getApiClient();
        if (api) return resolve(api);
        if (Date.now() - start >= timeoutMs) return resolve(null);
        setTimeout(check, 100);
      })();
    });
  }

  async function getConfig() {
    const apiClient = await waitForApiClient();

    if (apiClient && typeof apiClient.getPluginConfiguration === 'function') {
      return await apiClient.getPluginConfiguration(PluginConfig.pluginId);
    }

    const resp = await fetch(buildConfigUrl(), { credentials: 'include' });
    if (!resp.ok) {
      throw new Error('Unable to load plugin settings: ' + resp.status);
    }

    return await resp.json();
  }

  async function saveConfig(cfg) {
    const apiClient = await waitForApiClient();

    if (apiClient && typeof apiClient.updatePluginConfiguration === 'function') {
      return await apiClient.updatePluginConfiguration(PluginConfig.pluginId, cfg);
    }

    const resp = await fetch(buildConfigUrl(), {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(cfg)
    });

    if (!resp.ok) {
      throw new Error('Unable to save plugin settings: ' + resp.status);
    }

    return resp.status === 204 ? {} : await resp.json();
  }

  function getFolderName(config) {
    return (config.ImagesSubfolderName || (config.ImagesSubfolderNames && config.ImagesSubfolderNames[0]) || 'images').trim();
  }

  function bindPage() {
    const input = document.getElementById('folderName');
    const status = document.getElementById('status');
    const form = document.querySelector('.configForm');

    if (!input || !status || !form) {
      return;
    }

    form.addEventListener('submit', function (event) {
      event.preventDefault();
      status.textContent = 'Saving...';

      if (window.Dashboard && typeof window.Dashboard.showLoadingMsg === 'function') {
        window.Dashboard.showLoadingMsg();
      }

      const folderName = (input.value || 'images').trim() || 'images';

      // Follow Jellyfin pattern: get -> mutate -> update.then(processPluginConfigurationUpdateResult, onError)
      getConfig().then(function (cfg) {
        cfg.ImagesSubfolderName = folderName;
        cfg.ImagesSubfolderNames = [folderName];
        return saveConfig(cfg);
      }).then(function (result) {
        if (window.Dashboard && typeof window.Dashboard.processPluginConfigurationUpdateResult === 'function') {
          try {
            window.Dashboard.processPluginConfigurationUpdateResult(result);
          } catch (e) {
            console.error('processPluginConfigurationUpdateResult error', e);
          }
        }
        status.textContent = 'Saved';
      }, function (error) {
        console.error(error);
        status.textContent = 'Save failed';
        if (window.Dashboard && typeof window.Dashboard.alert === 'function') {
          window.Dashboard.alert({
            title: 'Save failed',
            message: error && error.message ? error.message : 'Unable to save plugin settings.'
          });
        }
      }).finally(function () {
        if (window.Dashboard && typeof window.Dashboard.hideLoadingMsg === 'function') {
          window.Dashboard.hideLoadingMsg();
        }
      });

      return false;
    });
  }

  document.querySelector('.configPage')?.addEventListener('pageshow', async function () {
    const input = document.getElementById('folderName');
    const status = document.getElementById('status');

    if (!input || !status) {
      return;
    }

    try {
      const config = await getConfig();
      input.value = getFolderName(config);
      status.textContent = '';
      input.dispatchEvent(new Event('change', { bubbles: true, cancelable: false }));
    } catch (error) {
      console.error(error);
      status.textContent = 'Load failed';
    }
  });

  bindPage();
})();
