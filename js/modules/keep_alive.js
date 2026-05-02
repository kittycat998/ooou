
/**
 * OVO 后台保活实验模块
 * 目标：参考 330 的前端保活思路，给 OVO 加一个轻量保活层。
 * 说明：纯前端无法保证“网页完全关闭后仍主动生成消息”；这个模块主要用于：
 * 1) 在页面/PWA仍存活时尽量延缓后台休眠；
 * 2) 保持定时器心跳；
 * 3) 提供系统通知权限检测和测试通知；
 * 4) 页面返回前台时恢复保活音频。
 */
(function () {
    'use strict';

    const STORE_KEY = 'ovo_keepalive_settings_v1';
    const DEFAULT_SETTINGS = {
        enabled: false,
        notifyEnabled: false,
        audioMode: true,
        heartbeatMs: 30000,
        lastHeartbeat: 0
    };

    let settings = loadSettings();
    let heartbeatTimer = null;
    let keepAudio = null;
    let wakeLock = null;
    let statusEl = null;

    function loadSettings() {
        try {
            return Object.assign({}, DEFAULT_SETTINGS, JSON.parse(localStorage.getItem(STORE_KEY) || '{}'));
        } catch (e) {
            return Object.assign({}, DEFAULT_SETTINGS);
        }
    }

    function saveSettings() {
        try {
            localStorage.setItem(STORE_KEY, JSON.stringify(settings));
        } catch (e) {}
    }

    function toast(msg, type) {
        if (typeof showToast === 'function') {
            showToast(msg, type || 'info');
        } else {
            console.log('[OVO保活]', msg);
        }
    }

    function isIOS() {
        return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
            (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    }

    function isStandalone() {
        return window.matchMedia('(display-mode: standalone)').matches ||
            window.navigator.standalone === true;
    }

    function silentWavDataUri() {
        // 很短的静音 wav，循环播放用于维持音频会话。用户点击开启后才播放。
        return 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAESsAACJWAAACABAAZGF0YQAAAAA=';
    }

    async function ensureServiceWorker() {
        if (!('serviceWorker' in navigator)) return null;
        try {
            const reg = await navigator.serviceWorker.register('./sw.js');
            await navigator.serviceWorker.ready;
            return reg;
        } catch (e) {
            console.warn('[OVO保活] ServiceWorker 注册失败:', e);
            return null;
        }
    }

    async function requestNotifyPermission() {
        if (!('Notification' in window)) {
            toast('当前浏览器不支持系统通知', 'warning');
            return false;
        }
        if (isIOS() && !isStandalone()) {
            toast('iPhone 上建议先添加到主屏幕，再开通知', 'warning');
        }
        try {
            const p = await Notification.requestPermission();
            settings.notifyEnabled = p === 'granted';
            saveSettings();
            updateStatus();
            toast(settings.notifyEnabled ? '通知已授权' : '通知未授权', settings.notifyEnabled ? 'success' : 'warning');
            return settings.notifyEnabled;
        } catch (e) {
            console.warn('[OVO保活] 请求通知权限失败:', e);
            return false;
        }
    }

    async function showSystemNotification(title, body, data) {
        if (!('Notification' in window) || Notification.permission !== 'granted') {
            return false;
        }
        const options = {
            body: body || '后台保活测试',
            icon: './manifest.json',
            badge: './manifest.json',
            tag: 'ovo-keepalive',
            data: data || {},
            requireInteraction: false
        };
        try {
            const reg = await ensureServiceWorker();
            if (reg && reg.showNotification) {
                await reg.showNotification(title || 'OVO', options);
                return true;
            }
        } catch (e) {
            console.warn('[OVO保活] SW 通知失败，尝试普通通知:', e);
        }
        try {
            new Notification(title || 'OVO', options);
            return true;
        } catch (e) {
            console.warn('[OVO保活] 普通通知失败:', e);
            return false;
        }
    }

    async function requestWakeLock() {
        if (!('wakeLock' in navigator)) return;
        try {
            wakeLock = await navigator.wakeLock.request('screen');
            wakeLock.addEventListener('release', () => {
                console.log('[OVO保活] Wake Lock 已释放');
            });
        } catch (e) {
            console.warn('[OVO保活] Wake Lock 不可用:', e);
        }
    }

    async function releaseWakeLock() {
        try {
            if (wakeLock) await wakeLock.release();
        } catch (e) {}
        wakeLock = null;
    }

    async function startAudioKeepAlive() {
        if (!settings.audioMode) return;
        if (!keepAudio) {
            keepAudio = document.getElementById('ovo-keepalive-audio');
            if (!keepAudio) {
                keepAudio = document.createElement('audio');
                keepAudio.id = 'ovo-keepalive-audio';
                keepAudio.loop = true;
                keepAudio.preload = 'auto';
                keepAudio.playsInline = true;
                keepAudio.src = silentWavDataUri();
                keepAudio.style.display = 'none';
                document.body.appendChild(keepAudio);
            }
        }
        try {
            keepAudio.volume = 0.001;
            await keepAudio.play();
            console.log('[OVO保活] 静音音频保活已启动');
        } catch (e) {
            console.warn('[OVO保活] 静音音频播放失败，浏览器可能禁止后台音频:', e);
            // 不再反复弹提示。通知和心跳仍可继续工作。
        }
    }

    function stopAudioKeepAlive() {
        if (!keepAudio) return;
        try {
            keepAudio.pause();
            keepAudio.currentTime = 0;
        } catch (e) {}
    }

    function startHeartbeat() {
        stopHeartbeat();
        const tick = () => {
            settings.lastHeartbeat = Date.now();
            saveSettings();
            updateStatus();
            document.dispatchEvent(new CustomEvent('ovo-keepalive-heartbeat', { detail: { timestamp: settings.lastHeartbeat }}));
        };
        tick();
        heartbeatTimer = setInterval(tick, settings.heartbeatMs || 30000);
    }

    function stopHeartbeat() {
        if (heartbeatTimer) {
            clearInterval(heartbeatTimer);
            heartbeatTimer = null;
        }
    }

    async function startKeepAlive() {
        settings.enabled = true;
        saveSettings();
        await ensureServiceWorker();
        await startAudioKeepAlive();
        await requestWakeLock();
        startHeartbeat();
        bindVisibility();
        updateStatus();
        toast('后台保活已开启', 'success');
    }

    async function stopKeepAlive() {
        settings.enabled = false;
        saveSettings();
        stopHeartbeat();
        stopAudioKeepAlive();
        await releaseWakeLock();
        updateStatus();
        toast('后台保活已关闭', 'info');
    }

    function bindVisibility() {
        document.removeEventListener('visibilitychange', handleVisibility);
        document.addEventListener('visibilitychange', handleVisibility);
        window.removeEventListener('pageshow', handlePageShow);
        window.addEventListener('pageshow', handlePageShow);
    }

    async function handleVisibility() {
        if (!settings.enabled) return;
        if (!document.hidden) {
            await startAudioKeepAlive();
            await requestWakeLock();
            startHeartbeat();
            updateStatus();
        } else {
            // 进入后台时不停止音频和心跳，交给浏览器决定是否暂停
            console.log('[OVO保活] 页面进入后台，尝试继续保活');
        }
    }

    async function handlePageShow() {
        if (!settings.enabled) return;
        await startAudioKeepAlive();
        startHeartbeat();
        updateStatus();
    }

    function formatTime(ts) {
        if (!ts) return '无';
        const d = new Date(ts);
        return d.toLocaleTimeString('zh-CN', { hour12: false });
    }

    function updateStatus() {
        if (!statusEl) return;
        const perm = ('Notification' in window) ? Notification.permission : 'unsupported';
        const mode = settings.enabled ? '运行中' : '未开启';
        const hidden = document.hidden ? '后台' : '前台';
        statusEl.innerHTML = `
            <div><b>状态：</b>${mode} / ${hidden}</div>
            <div><b>通知：</b>${perm}</div>
            <div><b>心跳：</b>${formatTime(settings.lastHeartbeat)}</div>
            <div style="opacity:.65;margin-top:4px;">纯前端保活不能保证关闭网页后仍推送；音频失败也不影响测试通知/消息通知。</div>
        `;
    }

    function createPanel() {
        if (document.getElementById('ovo-keepalive-panel')) return;

        const panel = document.createElement('div');
        panel.id = 'ovo-keepalive-panel';
        panel.className = 'show';
        panel.innerHTML = `
            <div class="ovo-ka-head">
                <div>
                    <div class="ovo-ka-title">后台保活</div>
                    <div class="ovo-ka-sub">参考 330 移植的轻量保活层</div>
                </div>
                <button class="ovo-ka-close">×</button>
            </div>
            <div class="ovo-ka-body">
                <div id="ovo-keepalive-status" class="ovo-ka-status"></div>
                <label class="ovo-ka-row">
                    <span>启用保活</span>
                    <input id="ovo-keepalive-enabled" type="checkbox">
                </label>
                <label class="ovo-ka-row">
                    <span>静音音频保活</span>
                    <input id="ovo-keepalive-audio-mode" type="checkbox">
                </label>
                <div class="ovo-ka-actions">
                    <button id="ovo-keepalive-permission">授权通知</button>
                    <button id="ovo-keepalive-test">测试通知</button>
                </div>
            </div>
        `;
        const mount = document.getElementById('ovo-keepalive-settings-mount');
        if (mount) mount.appendChild(panel);
        else document.body.appendChild(panel);

        statusEl = panel.querySelector('#ovo-keepalive-status');
        const enabled = panel.querySelector('#ovo-keepalive-enabled');
        const audioMode = panel.querySelector('#ovo-keepalive-audio-mode');

        enabled.checked = !!settings.enabled;
        audioMode.checked = !!settings.audioMode;

        const closeBtn = panel.querySelector('.ovo-ka-close');
        if (closeBtn) closeBtn.style.display = 'none';

        enabled.addEventListener('change', async () => {
            if (enabled.checked) await startKeepAlive();
            else await stopKeepAlive();
        });

        audioMode.addEventListener('change', async () => {
            settings.audioMode = audioMode.checked;
            saveSettings();
            if (settings.enabled && settings.audioMode) await startAudioKeepAlive();
            if (!settings.audioMode) stopAudioKeepAlive();
            updateStatus();
        });

        panel.querySelector('#ovo-keepalive-permission').addEventListener('click', requestNotifyPermission);
        panel.querySelector('#ovo-keepalive-test').addEventListener('click', async () => {
            const ok = await showSystemNotification('OVO 后台保活', '这是一条测试通知');
            toast(ok ? '测试通知已发送' : '通知发送失败，请检查权限', ok ? 'success' : 'warning');
        });

        updateStatus();
    }

    async function init() {
        await ensureServiceWorker();
        createPanel();
        bindVisibility();
        if (settings.enabled) {
            // 自动恢复时不一定能播放音频，iOS 可能需要再次点击开关
            startHeartbeat();
            startAudioKeepAlive();
        }
        updateStatus();
    }

    window.OVOKeepAliveMountPanel = function() {
        const old = document.getElementById('ovo-keepalive-panel');
        if (old) old.remove();
        createPanel();
    };

    window.OVOKeepAlive = {
        start: startKeepAlive,
        stop: stopKeepAlive,
        notify: showSystemNotification,
        requestPermission: requestNotifyPermission,
        getSettings: () => Object.assign({}, settings)
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
