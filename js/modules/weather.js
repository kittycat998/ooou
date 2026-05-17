// --- WOW 虚拟地点与天气服务模块 (js/modules/weather.js) ---

class WeatherService {
    constructor() {
        this.CACHE_DURATION = 60 * 60 * 1000; // 1小时缓存
        this.cache = {};
        try {
            const savedCache = localStorage.getItem('ovo_weather_cache');
            if (savedCache) this.cache = JSON.parse(savedCache) || {};
        } catch (e) {
            console.warn('读取天气缓存失败:', e);
            this.cache = {};
        }
    }

    normalizeSettings(character) {
        if (!character.weatherSettings || typeof character.weatherSettings !== 'object') {
            character.weatherSettings = {};
        }
        const s = character.weatherSettings;
        if (s.contextEnabled === undefined) s.contextEnabled = true;
        if (s.exposeRealLocation === undefined) s.exposeRealLocation = false;
        if (s.charEnabled === undefined) s.charEnabled = false;
        if (s.userEnabled === undefined) s.userEnabled = false;
        if (s.charVirtualLocation === undefined) s.charVirtualLocation = '';
        if (s.userVirtualLocation === undefined) s.userVirtualLocation = '';
        if (s.charWeatherLocation === undefined) s.charWeatherLocation = '';
        if (s.userWeatherLocation === undefined) s.userWeatherLocation = '';
        if (s.provider === undefined) s.provider = 'openmeteo';
        if (s.apiKey === undefined) s.apiKey = '';
        return s;
    }

    getProviderSettings(character) {
        const s = this.normalizeSettings(character);
        return {
            provider: s.provider || 'openmeteo',
            apiKey: s.apiKey || ''
        };
    }

    buildLocationPrefix(label, virtualLocation, weatherLocation, exposeRealLocation) {
        const virtual = String(virtualLocation || '').trim();
        const real = String(weatherLocation || '').trim();
        const displayLocation = virtual || (exposeRealLocation ? real : '');
        const parts = [];
        if (displayLocation) parts.push(`${label}当前地点：${displayLocation}。`);
        if (exposeRealLocation && virtual && real) parts.push(`映照的真实天气地点：${real}。`);
        return parts.join('');
    }

    async getCharacterWeatherLine(character) {
        const s = this.normalizeSettings(character);
        if (!s.charEnabled) return '';
        const prefix = this.buildLocationPrefix('角色', s.charVirtualLocation, s.charWeatherLocation, !!s.exposeRealLocation);
        if (!s.charWeatherLocation) return prefix;
        const { provider, apiKey } = this.getProviderSettings(character);
        try {
            const data = await this.fetchWeather(provider, s.charWeatherLocation, apiKey);
            return `${prefix}角色当前天气：${data.condition}，气温：${data.temperature}。`;
        } catch (error) {
            console.warn(`获取角色(${character.remarkName || character.realName || character.name || ''})天气失败:`, error);
            return prefix ? `${prefix}天气暂时获取失败。` : '';
        }
    }

    async getUserWeatherLine(character) {
        const s = this.normalizeSettings(character);
        if (!s.userEnabled) return '';
        const prefix = this.buildLocationPrefix('用户', s.userVirtualLocation, s.userWeatherLocation, !!s.exposeRealLocation);
        if (!s.userWeatherLocation) return prefix;
        const { provider, apiKey } = this.getProviderSettings(character);
        try {
            const data = await this.fetchWeather(provider, s.userWeatherLocation, apiKey);
            return `${prefix}用户当前天气：${data.condition}，气温：${data.temperature}。`;
        } catch (error) {
            console.warn('获取用户天气失败:', error);
            return prefix ? `${prefix}天气暂时获取失败。` : '';
        }
    }

    async buildEnvironmentPrompt(character) {
        if (!character) return '';
        const s = this.normalizeSettings(character);
        if (!s.contextEnabled) return '';
        const lines = [];
        const charLine = await this.getCharacterWeatherLine(character);
        const userLine = await this.getUserWeatherLine(character);
        if (charLine) lines.push(charLine);
        if (userLine) lines.push(userLine);
        if (!lines.length) return '';

        return `<environment>\n${lines.join('\n')}\n这些信息是背景感知。除非话题相关，不要机械播报天气；可以自然影响氛围、动作、穿着、窗外环境、距离感和关心方式。\n</environment>\n\n`;
    }

    async fetchWeather(provider, cityOrCoords, apiKey) {
        const normalizedProvider = provider || 'openmeteo';
        const location = String(cityOrCoords || '').trim();
        if (!location) throw new Error('缺少天气地点');

        const cacheKey = `${normalizedProvider}_${location}`;
        const now = Date.now();

        if (this.cache[cacheKey] && (now - this.cache[cacheKey].timestamp < this.CACHE_DURATION)) {
            return this.cache[cacheKey].data;
        }

        let data = null;
        switch (normalizedProvider) {
            case 'wttrin':
                data = await this.fetchWttrin(location);
                break;
            case 'qweather':
                data = await this.fetchQWeather(location, apiKey);
                break;
            case 'seniverse':
                data = await this.fetchSeniverse(location, apiKey);
                break;
            case 'openmeteo':
            default:
                data = await this.fetchOpenMeteo(location);
                break;
        }

        if (data) {
            this.cache[cacheKey] = { data, timestamp: now };
            try {
                localStorage.setItem('ovo_weather_cache', JSON.stringify(this.cache));
            } catch (e) {
                console.warn('保存天气缓存失败:', e);
            }
        }

        return data;
    }

    async fetchWttrin(city) {
        const url = `https://wttr.in/${encodeURIComponent(city)}?format=j1&lang=zh-cn`;
        const res = await fetch(url);
        if (!res.ok) throw new Error('wttr.in 请求失败');
        const json = await res.json();
        const current = json.current_condition && json.current_condition[0];
        if (!current) throw new Error('wttr.in 未返回天气');
        const temp = current.temp_C + '℃';
        const condition = current.lang_zh && current.lang_zh[0] ? current.lang_zh[0].value : current.weatherDesc[0].value;
        return { temperature: temp, condition };
    }

    async fetchOpenMeteo(cityOrCoords) {
        let lat, lon;
        if (/^[-+]?\d+(\.\d+)?,\s*[-+]?\d+(\.\d+)?$/.test(cityOrCoords)) {
            const parts = cityOrCoords.split(',').map(s => s.trim());
            lat = parts[0];
            lon = parts[1];
        } else {
            const geoUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(cityOrCoords)}&count=1&language=zh`;
            const geoRes = await fetch(geoUrl);
            if (!geoRes.ok) throw new Error('Open-Meteo Geocoding 请求失败');
            const geoJson = await geoRes.json();
            if (!geoJson.results || geoJson.results.length === 0) throw new Error('未找到该地点坐标');
            lat = geoJson.results[0].latitude;
            lon = geoJson.results[0].longitude;
        }

        const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true`;
        const res = await fetch(weatherUrl);
        if (!res.ok) throw new Error('Open-Meteo Weather 请求失败');
        const json = await res.json();
        if (!json.current_weather) throw new Error('Open-Meteo 未返回当前天气');
        return {
            temperature: json.current_weather.temperature + '℃',
            condition: this.wmoCodeToText(json.current_weather.weathercode)
        };
    }

    async fetchQWeather(cityOrCoords, apiKey) {
        if (!apiKey) throw new Error('和风天气需要 API Key');
        let location = cityOrCoords;
        if (/^[-+]?\d+(\.\d+)?,\s*[-+]?\d+(\.\d+)?$/.test(cityOrCoords)) {
            const parts = cityOrCoords.split(',').map(s => s.trim());
            location = `${parts[1]},${parts[0]}`;
        } else {
            const geoUrl = `https://geoapi.qweather.com/v2/city/lookup?location=${encodeURIComponent(cityOrCoords)}&key=${apiKey}`;
            const geoRes = await fetch(geoUrl);
            const geoJson = await geoRes.json();
            if (geoJson.code !== '200' || !geoJson.location || geoJson.location.length === 0) {
                throw new Error('和风天气城市搜索失败: ' + geoJson.code);
            }
            location = geoJson.location[0].id;
        }

        const url = `https://devapi.qweather.com/v7/weather/now?location=${encodeURIComponent(location)}&key=${apiKey}`;
        const res = await fetch(url);
        const json = await res.json();
        if (json.code !== '200') throw new Error('和风天气请求失败: ' + json.code);
        return { temperature: json.now.temp + '℃', condition: json.now.text };
    }

    async fetchSeniverse(cityOrCoords, apiKey) {
        if (!apiKey) throw new Error('心知天气需要 API Key');
        let location = cityOrCoords;
        if (/^[-+]?\d+(\.\d+)?,\s*[-+]?\d+(\.\d+)?$/.test(cityOrCoords)) {
            const parts = cityOrCoords.split(',').map(s => s.trim());
            location = `${parts[0]}:${parts[1]}`;
        }

        const url = `https://api.seniverse.com/v3/weather/now.json?key=${apiKey}&location=${encodeURIComponent(location)}&language=zh-Hans&unit=c`;
        const res = await fetch(url);
        if (!res.ok) throw new Error('心知天气请求失败');
        const json = await res.json();
        if (!json.results || json.results.length === 0) throw new Error('心知天气未返回结果');
        const now = json.results[0].now;
        return { temperature: now.temperature + '℃', condition: now.text };
    }

    wmoCodeToText(code) {
        const codes = {
            0: '晴朗',
            1: '大部晴朗', 2: '部分多云', 3: '阴天',
            45: '有雾', 48: '有沉积雾',
            51: '毛毛雨', 53: '毛毛雨', 55: '密集的毛毛雨',
            56: '冰冻的毛毛雨', 57: '密集的冰冻毛毛雨',
            61: '小雨', 63: '中雨', 65: '大雨',
            66: '冻雨', 67: '冻雨',
            71: '小雪', 73: '中雪', 75: '大雪',
            77: '雪粒',
            80: '小阵雨', 81: '中阵雨', 82: '大阵雨',
            85: '小阵雪', 86: '大阵雪',
            95: '雷阵雨',
            96: '雷阵雨伴有冰雹', 99: '强雷阵雨伴有冰雹'
        };
        return codes[code] || '未知';
    }
}

window.WeatherService = new WeatherService();
