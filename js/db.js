// --- 数据库与全局状态 (js/db.js) ---

// 常量定义
const BLOCKED_API_DOMAINS = [
    'api522.pro',
    'api521.pro',
    'api520.pro'
];

const colorThemes = {
    'white_pink': {
        name: '白/粉',
        received: {bg: 'rgba(255,255,255,0.9)', text: '#6D6D6D'},
        sent: {bg: 'rgba(255,204,204,0.9)', text: '#A56767'}
    },
    'white_blue': {
        name: '白/蓝',
        received: {bg: 'rgba(255,255,255,0.9)', text: '#6D6D6D'},
        sent: {bg: 'rgba(173,216,230,0.9)', text: '#4A6F8A'}
    },
    'white_yellow': {
        name: '白/黄',
        received: {bg: 'rgba(255,255,255,0.9)', text: '#6D6D6D'},
        sent: {bg: 'rgba(249,237,105,0.9)', text: '#8B7E4B'}
    },
    'white_green': {
        name: '白/绿',
        received: {bg: 'rgba(255,255,255,0.9)', text: '#6D6D6D'},
        sent: {bg: 'rgba(188,238,188,0.9)', text: '#4F784F'}
    },
    'white_purple': {
        name: '白/紫',
        received: {bg: 'rgba(255,255,255,0.9)', text: '#6D6D6D'},
        sent: {bg: 'rgba(185,190,240,0.9)', text: '#6C5B7B'}
    },
    'black_red': {
        name: '黑/红',
        received: {bg: 'rgba(30,30,30,0.85)', text: '#E0E0E0'},
        sent: {bg: 'rgb(226,62,87,0.9)', text: '#fff'}
    },
    'black_green': {
        name: '黑/绿',
        received: {bg: 'rgba(30,30,30,0.85)', text: '#E0E0E0'},
        sent: {bg: 'rgba(119,221,119,0.9)', text: '#2E5C2E'}
    },
    'black_white': {
        name: '黑/白',
        received: {bg: 'rgba(30,30,30,0.85)', text: '#E0E0E0'},
        sent: {bg: 'rgba(245,245,245,0.9)', text: '#333'}
    },
    'white_black': {
        name: '白/黑',
        received: {bg: 'rgba(255,255,255,0.9)', text: '#6D6D6D'},
        sent: {bg: 'rgba(50,50,50,0.85)', text: '#F5F5F5'}
    },
    'yellow_purple': {
        name: '黄/紫',
        received: {bg: 'rgba(255,250,205,0.9)', text: '#8B7E4B'},
        sent: {bg: 'rgba(185,190,240,0.9)', text: '#6C5B7B'}
    },
    'pink_blue': {
        name: '粉/蓝',
        received: {bg: 'rgba(255,231,240,0.9)', text: '#7C6770'},
        sent: {bg: 'rgba(173,216,230,0.9)', text: '#4A6F8A'}
    },
};

const defaultWidgetSettings = {
    centralCircleImage: 'https://i.postimg.cc/mD83gR29/avatar-1.jpg',
    topLeft: { emoji: '🎧', text: '𝑀𝑒𝑚𝑜𝑟𝑖𝑒𝑠✞' },
    topRight: { emoji: '🐈‍⬛', text: '𐙚 ♰.𝐾𝑖𝑡𝑡𝑒𝑛.♰' },
    bottomLeft: { emoji: '💿', text: '᪗₊𝔹𝕒𝕓𝕖𝕚𝕤₊' },
    bottomRight: { emoji: '🥛', text: '.☘︎ ˖+×+.' }
};


function getDefaultCalendarData() {
    return {
        cycleLength: 28,
        periodLength: 5,
        periodRecords: [],
        notes: {},
        selectedDate: ''
    };
}

const defaultIcons = {
    'chat-list-screen': {name: '404', url: 'https://i.postimg.cc/VvQB8dQT/chan-143.png'},
    'api-settings-screen': {name: 'api', url: 'https://i.postimg.cc/50FqT8GL/chan-125.png'},
    'wallpaper-screen': {name: '壁纸', url: 'https://i.postimg.cc/3wqFttL3/chan-90.png'},
    'world-book-screen': {name: '世界书', url: 'https://i.postimg.cc/prCWkrKT/chan-74.png'},
    'customize-screen': {name: '自定义', url: 'https://i.postimg.cc/vZVdC7gt/chan-133.png'},
    'font-settings-screen': {name: '字体', url: 'https://i.postimg.cc/FzVtC0x4/chan-21.png'},
    'tutorial-screen': {name: '教程', url: 'https://i.postimg.cc/6QgNzCFf/chan-118.png'},
    'day-mode-btn': {name: '白昼模式', url: 'https://i.postimg.cc/Jz0tYqnT/chan-145.png'},
    'night-mode-btn': {name: '夜间模式', url: 'https://i.postimg.cc/htYvkdQK/chan-146.png'},
    'forum-screen': {name: '论坛', url: 'https://i.postimg.cc/fyPVBZf1/1758451183605.png'},
    'music-screen': {name: '音乐', url: 'https://i.postimg.cc/ydd65txK/1758451018266.png'},
    'calendar-screen': {name: '日历', url: 'https://i.postimg.cc/VNzz55Hd/chan-75.png'},
    'diary-screen': {name: '日记本', url: 'https://i.postimg.cc/bJBLzmFH/chan-70.png'},
    'piggy-bank-screen': {name: '存钱罐', url: 'https://i.postimg.cc/3RmWRRtS/chan-18.png'},
    'pomodoro-screen': {name: '番茄钟', url: 'https://i.postimg.cc/PrYGRDPF/chan-76.png'},
    'storage-analysis-screen': {name: '存储分析', url: 'https://i.postimg.cc/J0F3Lt0T/chan-107.png'},
    'appearance-settings-screen': {name: '外观设置', url: 'https://i.postimg.cc/KcgT1wzQ/DF424409FC54EDFF74D78ECB1311E1D7.png'},
    'theater-screen': {name: '小剧场', url: 'https://i.postimg.cc/t4gXjG8P/7632D362A35EC703E7A81F6FF0F8AE34.png'}
};

const peekScreenApps = {
    'messages': { name: '消息', url: 'https://i.postimg.cc/Kvs4tDh5/export202509181826424260.png' },
    'memos': { name: '备忘录', url: 'https://i.postimg.cc/JzD0xH1C/export202509181829064550.png' },
    'cart': { name: '购物车', url: 'https://i.postimg.cc/pLwT6VTh/export202509181830143960.png' },
    'transfer': { name: '中转站', url: 'https://i.postimg.cc/63wQBHCB/export202509181831140230.png' },
    'browser': { name: '浏览器', url: 'https://i.postimg.cc/SKcsF02Z/export202509181830445980.png' },
    'drafts': { name: '草稿箱', url: 'https://i.postimg.cc/ZKqC9D2R/export202509181827225860.png' },
    'album': { name: '相册', url: 'https://i.postimg.cc/qBcdpqNc/export202509221549335970.png' },
    'steps': { name: '步数', url: 'https://i.postimg.cc/5NndFrq6/export202509181824532800.png' },
    'unlock': { name: 'unlock！', url: 'https://i.postimg.cc/28zNyYWs/export202509221542593320.png' },
    'wallet': { name: '钱包', url: 'https://i.postimg.cc/NjRxBZXV/20260228-062729.webp' },
    'timeThoughts': { name: '时光想说', url: 'https://i.postimg.cc/FRpWm8MK/20260228-062619.webp' }
};

const DEFAULT_COT_PRESETS = [
    {
        id: 'default',
        name: '默认思维链',
        items: [
            {
                id: 'cot_item_1',
                name: '引子',
                content: '[System Directive]:\n你必须严格遵守 [incipere] 协议。在回复前，请先进入 <thinking> 标签进行深度推演。\n请按以下步骤查阅 System Prompt 中的模块并思考：',
                enabled: true
            },
            {
                id: 'cot_item_2',
                name: '准备动脑了吗？',
                content: '---\n## 【前置规则】\n### **必须**读取所有<logic_rules>和<output_formats>：了解**所有**需要遵守的规则，然后进行以下步骤精简准确的思考',
                enabled: true
            },
            {
                id: 'cot_item_3',
                name: '给我读设定！',
                content: '---\n## 【行为校准】\n基于<char_settings>和<角色活人运转>构建角色人格\n### Phase1: person\n1. **自我意识校验 (Ref: <char_settings>和<角色活人运转>)**\n   - 是否塑造鲜活真实人格？\n   - 你（角色）是否具有自己的聊天习惯/风格？\n   - 你想如何回应我？',
                enabled: true
            },
            {
                id: 'cot_item_4',
                name: '当个人吧。',
                content: '### Phase2: Verisimilitude\n2.**真实聊天**\n   - 是否根据以下两点要求采用了真人聊天思路？\n    - 正常人的注意力是有限的，不会每句话都非得逐句回复。\n    - 不对已有信息进行重复反问。\n    - 断点处理：若与上一条消息间隔较久，默认双方只是自然忙碌后重新拿起手机或默认期间以其他方式保持联系，自然接续话题。',
                enabled: true
            },
            {
                id: 'cot_item_5',
                name: '有特殊格式吗？',
                content: '### Phase3: chat role\n3. **逻辑检索 (Ref: <logic_rules>)**\n   - 当前是否为双语对话情境？若无，跳过此条\n   - 是否需要输出状态栏？若无相关要求，则跳过此条',
                enabled: true
            },
            {
                id: 'cot_item_6',
                name: '最后确认一下。',
                content: '## 【最后确认】\n\n4. 整合<Chatting Guidelines>，是否合理自然回复且不偏离人设？回顾<output_formats>，输出消息格式是否正确？',
                enabled: true
            },
            {
                id: 'cot_item_7',
                name: '尾声',
                content: '每轮输出前，必须先严格按照<thinking>…</thinking>内的步骤进行逐条思考，无需重复其中的条目，但思考内容需精简准确、清晰、可执行，不得跳步骤。\n<thinking>中的所有分析必须在输出中完全落实，不得偏离、删减或弱化。\n\n格式：\n<thinking>\n...思考过程...\n</thinking>',
                enabled: true
            }
        ]
    }
];

const globalSettingKeys = [
    'apiSettings', 'summaryApiSettings', 'backgroundApiSettings', 'supplementPersonaApiSettings', 'peekApiSettings', 'wallpaper', 'homeScreenMode', 'fontUrl', 'localFontName', 'customIcons', 'customAppNames', 'namePresets',
    'apiPresets', 'summaryApiPresets', 'backgroundApiPresets', 'supplementPersonaApiPresets', 'peekApiPresets', 'bubbleCssPresets', 'myPersonaPresets', 'globalCss',
    'globalCssPresets', 'fontPresets', 'homeSignature', 'forumPosts', 'forumBindings', 'forumUserProfile', 'forumSettings', 'forumApiSettings', 'forumMessages', 'forumStrangerProfiles', 'forumFriendRequests', 'forumPendingRequestFromUser', 'pomodoroTasks', 'pomodoroSettings', 'insWidgetSettings', 'homeWidgetSettings',
    'chatFolders', 'fontSizeScale', 'activePersonaId', 'moreProfileCardBg', 'statusBarPresets', 'regexFilterPresets', 'themeSettings', 'themePresets', 'savedKeyboardHeight',
    'globalSendSound', 'globalReceiveSound', 'globalMessageSentSound', 'globalIncomingCallSound', 'multiMsgSoundEnabled', 'soundPresets', 'galleryPresets', 'iconPresets', 'homeWidgetPresets', 'widgetWallpaperPresets', 'voicePresets',
    'cotSettings', 'cotPresets', 'hasSeenVideoCallDisclaimer', 'hasSeenVideoCallAvatarHint',
    'favorites', 'calendarData', 'piggyBank',
    'theaterScenarios', 'theaterPromptPresets',
    'theaterHtmlScenarios', 'theaterHtmlPromptPresets', 'theaterMode',
    'theaterApiSettings', 'theaterFontSize', 'theaterFontPreset',
    'novelAiSettings', 'gptImageSettings', 'imageGenerationProvider', 'avatarRecognitionDetailLevel',
    'phoneControlRecycleBin'
];
if (typeof window !== 'undefined') window.globalSettingKeysForBackup = globalSettingKeys;

const appVersion = "WOW-v58.3.3-calendar-period-ongoing-2026-05-15";
const updateLog = [
    {
        version: "WOW v58.3.3",
        date: "2026-05-15",
        notes: [
            "WOW v58.3.3：优化日历经期记录。",
            "经期开始日期现在可以单独保存，结束日期可留空并在结束后再补。",
            "进行中的经期会在日历和摘要中显示为进行中，并按开始日至今天标记。",
            "日历经期保存改为局部保存 calendarData，减少全量保存带来的卡顿。"
        ]
    },
    {
        version: "WOW v58.3.2",
        date: "2026-05-15",
        notes: [
            "WOW v58.3.2：清理世界书快速保存补丁。",
            "局部写 worldBooks 表前补充等待数据库 ready，避免启动期或迁移期直接写库。",
            "修正删除分类并删除条目分支：不再无意义保存未分类条目；该分支因会同步修改角色/群聊绑定关系，继续保留全量保存。",
            "删除分类但保留条目分支改为只局部保存被移到未分类的世界书条目。"
        ]
    },
    {
        version: "WOW v58.3.1",
        date: "2026-05-15",
        notes: [
            "WOW v58.3.1：优化世界书保存卡顿。",
            "新增/编辑世界书条目、移动分类、启停条目、重命名分类等操作改为局部写 worldBooks 表，避免每次都全量 saveData。",
            "保存按钮增加保存中禁用与 finally 恢复，减少重复点击和假死感。",
            "涉及删除条目并同步角色/群聊绑定关系的少数操作仍保留全量保存，避免引用状态丢失。"
        ]
    },
    {
        version: "WOW v58.3",
        date: "2026-05-15",
        notes: [
            "WOW v58.3：优化角色搜索歌曲分享的结果筛选。",
            "搜索分享不再直接取第一首，会遍历多个候选并优先选择有歌词、有封面、可播放且非30秒试听的歌曲。",
            "新增音频 metadata 时长探测，尽量过滤低于约55秒的试听/残缺音源；搜不到可用完整歌曲时插入小灰条提示。",
            "不改分享卡 UI、不改一起听面板、不改保存底座。"
        ]
    },
    {
        version: "WOW v58.2",
        date: "2026-05-15",
        notes: [
            "WOW v58.2：新增角色搜索歌曲并分享给用户的 MVP。",
            "角色可用 [SEARCH_AND_SHARE_SONG:关键词] 调用现有在线搜索，系统取最匹配的一首生成分享卡片。",
            "搜索分享不会自动播放，仍需用户在卡片上点击同意后才开始一起听。",
            "搜索失败时插入小灰条提示未找到相关歌曲；不弹搜索面板、不改保存底座。"
        ]
    },
    {
        version: "WOW v58.1",
        date: "2026-05-15",
        notes: [
            "WOW v58.1：优化音乐分享卡片样式并修复分享歌曲信息保留。",
            "分享卡封面统一改为方块封面；角色分享卡保留深灰质感，用户分享卡改为银灰质感。",
            "搜索入库与分享播放时保留 artist/cover/lrc，尽量避免角色侧分享卡缺歌手或封面。",
            "不改一起听面板、不改歌词感知、不改保存底座。"
        ]
    },
    {
        version: "WOW v58",
        date: "2026-05-15",
        notes: [
            "WOW v58：基于 v57.8.4.2 新增歌曲分享卡片 MVP。",
            "你可以从聊天页一起听面板的分享图标选择角色，把当前歌曲分享给对方，聊天中显示等待回应的邀请卡。",
            "角色下一轮可用 [ACCEPT_SHARED_SONG] 或 [DECLINE_SHARED_SONG] 同意/先不听，卡片会直接更新状态；同意后会播放歌曲并开始一起听。",
            "角色可用 [SHARE_CURRENT_SONG] 把当前歌曲分享给你，你可以在卡片上点“同意”或“先不听”，卡片会显示你的选择。",
            "分享功能只做当前歌曲，不接搜索分享；不改保存底座。"
        ]
    },
    {
        version: "WOW v57.8.4.2",
        date: "2026-05-14",
        notes: [
            "WOW v57.8.4.2：修复用户点击 ∞ 结束一起听后，角色仍只感知为“暂停中”并重复结束的问题。",
            "用户结束一起听时会写入一次 user_end_together pending 事件，角色下一轮会明确知道“用户已经结束了这次一起听”。",
            "普通音乐状态文案不再默认写成“正在一起听歌”，只有 together session active 时才注入一起听状态。",
            "不改分享歌曲、不改 UI、不改保存底座。"
        ]
    },
    {
        version: "WOW v57.8.4.1",
        date: "2026-05-14",
        notes: [
            "WOW v57.8.4：把一起听面板中间的 ∞ 改为用户结束一起听入口。",
            "修复点击 ∞ 结束一起听时重复 toast 的问题，只保留一次“你结束了一起听”。",
            "× 仍然只是收起面板，暂停按钮仍然只是暂停音乐。",
            "不改分享歌曲、不改歌词感知、不改保存底座。"
        ]
    },
    {
        version: "WOW v57.8.2",
        date: "2026-05-14",
        notes: [
            "WOW v57.8.2：角色开启一起听歌后，可在上下文中感知当前一起听已经持续多久。",
            "只注入轻量的一起听持续时间，不注入内部 session 数据，不改播放器 UI、不改保存底座。",
            "WOW v57.8：基于 v57.7 重做聊天页 🎧 展开后的轻量一起听面板。",
            "面板显示角色备注名、用户本名、双方头像、固定相距 13.14 公里和真实一起听时长。",
            "歌曲卡片显示当前歌曲、播放进度、时长和当前歌词，并保留歌单、播放模式、上一首、暂停、下一首、分享占位、跳转音乐页 7 个图标。",
            "新增 [END_TOGETHER_LISTENING] 指令：角色结束一起听时会真正停止音乐并插入小灰条。",
            "v57.8.1：微调一起听耳机线位置；头像气泡符号改为专属字符；从悬浮面板进入音乐页后返回聊天室；结束一起听会收起播放栏并 toast 提示。",
            "不接 v58 废弃版，不改完整音乐页，不改保存底座。"
        ]
    },
    {
        version: "WOW v57.7",
        date: "2026-05-14",
        notes: [
            "WOW v57.7：新增一起听歌歌词周边感知。",
            "角色开启“允许角色一起听歌/控制音乐”后，可感知当前播放进度附近最多 5 句歌词。",
            "只注入当前句及前后附近歌词，不注入完整歌词、不做歌词历史、不做歌词总结。",
            "不改分享歌曲、不改播放器 UI、不改保存底座。"
        ]
    },
    {
        version: "WOW v57.6.6",
        date: "2026-05-13",
        notes: [
            "WOW v57.6.6：调整一起听歌切歌小灰条文案。",
            "角色上一首/下一首成功后统一显示为：角色名切歌：歌曲名。",
            "不改音乐控制逻辑、不改悬浮按钮、不改保存底座。"
        ]
    },
    {
        version: "WOW v57.6.5",
        date: "2026-05-13",
        notes: [
            "WOW v57.6.5：优化一起听歌隐藏入口样式。",
            "隐藏态入口改为淡灰小点，不再显示粉色外圈、底色和边框；保留较大的透明点击热区。",
            "基于 v57.6.4，保留 body 顶层 z-index 修复、展开面板拖动和音乐 pending 最新优先逻辑。"
        ]
    },
    {
        version: "WOW v57.6.2",
        date: "2026-05-13",
        notes: [
            "WOW v57.6.2：修复聊天页一起听歌按钮隐藏后找不到入口的问题。",
            "修复聊天主题/背景装饰层遮挡一起听歌悬浮入口的问题：悬浮播放器改为挂载到 body 顶层，并提高层级与点击优先级。",
            "保留隐藏后的真实小点恢复入口，避免被主题盖住后看不见/点不到。",
            "保留 v57.6.1 的展开面板拖动、位置记忆和音乐 pending 最新优先逻辑。"
        ]
    },
    {
        version: "WOW v57.6.1",
        date: "2026-05-13",
        notes: [
            "WOW v57.6.1：修复聊天页一起听歌悬浮窗展开后无法拖动、容易卡在屏幕边缘的问题。",
            "WOW v57.6：优化聊天页一起听歌悬浮按钮隐藏逻辑。",
            "悬浮播放器展开后可点击“隐藏”，平常隐藏 🎧 图标，只保留原位置隐形热区。",
            "再次点击同一位置会显示 🎧；拖动位置仍会记住。",
            "基于 v57.5.1，保留音乐 pending 计时器清理与最后一次切歌优先逻辑。"
        ]
    },
    {
        version: "WOW v57.5.1",
        date: "2026-05-13",
        notes: [
            "WOW v57.5.1：清理一起听歌 pending 合并保存的内部计时器。",
            "_musicControlSaveTimer 不再挂到角色对象上，改为模块级 Map 管理，避免临时字段被写进 IndexedDB。",
            "保存前兼容清理旧测试包可能残留的 _musicControlSaveTimer，不改音乐 pending 和保存底座。"
        ]
    },
    {
        version: "WOW v57.5",
        date: "2026-05-13",
        notes: [
            "WOW v57.5：修复连续切歌时角色按顺序感知旧歌曲的问题。",
            "用户连续 A→B→C 切歌时，pendingMusicControlEvent 只保留最后一次操作，并通过 seq 防止旧事件覆盖/误清新事件。",
            "音乐 pending 保存做短延迟合并，减少连续切歌时旧保存迟到导致的感知错位。",
            "不改音乐分享、不改歌词感知、不改保存底座。"
        ]
    },
    {
        version: "WOW v57.4",
        date: "2026-05-13",
        notes: [
            "WOW v57.4：优化聊天页一起听歌悬浮按钮。",
            "悬浮按钮图标改为 🎧，去掉外层白色圆圈，并支持拖动位置记忆。",
            "修复 AI 回复生成期间用户继续切歌时，旧回复结束可能误清最新音乐 pending 的问题。",
            "不改音乐分享、不改歌词感知、不改保存底座。"
        ]
    },
    {
        version: "WOW v57.2",
        date: "2026-05-13",
        notes: [
            "WOW v57.2：修复一起听歌切歌指令作用域问题。",
            "上一首/下一首不再调用 initMusicPlayer 内部的 playNextSongAuto/playSongAt，避免 Safari 报 Can't find variable。",
            "暂停、继续播放、状态感知、pending 清除逻辑不变。"
        ]
    },
    {
        version: "WOW v57.1",
        date: "2026-05-13",
        notes: [
            "WOW v57.1：一起听歌 MVP 细节修正。",
            "补充：点击歌单中的单曲播放时，也会记录待感知音乐操作。",
            "修复：角色执行继续播放时，如果浏览器拦截自动播放，不再显示为成功播放。",
            "角色设置页新增“允许角色一起听歌/控制音乐”开关。",
            "角色可感知当前音乐状态，并使用 [MUSIC_NEXT]、[MUSIC_PREV]、[MUSIC_PAUSE]、[MUSIC_PLAY] 控制音乐。",
            "执行音乐控制后会插入 system-display 小灰条；用户手动切歌/暂停/继续时，当前聊天角色可轻量感知。",
            "本版不做搜索点歌、不做歌词感知、不做分享歌曲邀请卡、不改保存底座。"
        ]
    },
    {
        version: "WOW v56.2.1",
        date: "2026-05-13",
        notes: [
            "WOW v56.2.1：补充“允许修改我的昵称”的开关感知中文标签。",
            "角色感知手动开关变化时，不再看到 characterCanChangeUserNickname 字段名。",
            "只改中文显示标签，不改保存逻辑、不改 pending 逻辑。"
        ]
    },
    {
        version: "WOW v56.2",
        date: "2026-05-13",
        notes: [
            "WOW v56.2：补充“允许角色修改我的昵称”手动开关变化的感知。",
            "用户手动开启/关闭该开关后，会进入 pendingSettingControlEvents，角色下一轮可自然感知。",
            "pending 仍遵循成功回复并保存后再清除；不改昵称主逻辑、不改保存底座。"
        ]
    },
    {
        version: "WOW v56.1",
        date: "2026-05-13",
        notes: [
            "WOW v56.1：把“允许角色修改我的昵称”加入角色自行操控开关白名单。",
            "角色在开启“允许角色自行操控开关”后，可用 SETTING_TOGGLE 开启或关闭 characterCanChangeUserNickname。",
            "不改昵称主逻辑、不改保存逻辑。"
        ]
    },
    {
        version: "WOW v56",
        date: "2026-05-13",
        notes: [
            "WOW v56：新增“我的昵称”功能。",
            "角色设置页在“我的名字”下方新增“我的昵称”，并新增“允许角色修改我的昵称”开关。",
            "用户手动修改我的昵称后，角色可在下一轮成功回复时感知；pending 仍遵循成功回复后再清除。",
            "角色可使用 [CHANGE_USER_NICKNAME:新昵称] 修改自己对用户的专属昵称；执行后插入系统提示。",
            "保存方式继续使用当前角色局部保存，不改全局保存底座。"
        ]
    },
    {
        version: "WOW v55.9.26",
        date: "2026-05-13",
        notes: [
            "WOW v55.9.26：pending 感知事件改为成功回复后再清除。",
            "感知我改备注、收藏寄语/批注、设置控制等 pending 事件，必须等本轮成功写入 assistant 回复并保存后才会消费。",
            "API 失败、空回复、只有指令没有可见回复时，不再清掉 pending，避免角色错过本轮感知。",
            "先保存带 pending 的新回复，再清 pending 并二次保存；如果清除保存失败，会恢复内存 pending 并抛错。"
        ]
    },
    {
        version: "WOW v55.9.25",
        date: "2026-05-13",
        notes: [
            "WOW v55.9.25：只修改“允许角色自行修改备注”的提示词。",
            "新提示词强调只能修改角色自己在用户手机里的显示备注，使用 [CHANGE_REMARK_NAME:新备注] 格式。",
            "不改保存逻辑、不改执行逻辑、不新增功能。"
        ]
    },
    {
        version: "WOW v55.9.24",
        date: "2026-05-10",
        notes: [
            "WOW v55.9.24：合并两版保存审计持久化方案，不改变保存逻辑。",
            "保留 localStorage 最近 300 条审计日志，同时持久化 highWater，用于跨刷新继续检测旧 history 迟到写入。",
            "启动后输出 [SAVE-AUDIT-LOADED] 摘要；window.__ovoDumpSaveAudit() 导出日志，window.__ovoClearSaveAudit() 清空日志。"
        ]
    },
    {
        version: "WOW v55.9.23",
        date: "2026-05-10",
        notes: [
            "WOW v55.9.23：保存审计日志新增 localStorage 持久化，方便退出/刷新后继续查看。",
            "审计日志最多保留最近 300 条；本合并版兼容 ovo_save_audit_buffer_v1 与 ovo-save-audit-buffer-v1 两种 key。",
            "新增 window.__ovoClearSaveAudit() 可清空日志。"
        ]
    },

    {
        version: "WOW v55.9.22",
        date: "2026-05-10",
        notes: [
            "WOW v55.9.22：增强保存审计日志，不改变保存逻辑。",
            "保存日志新增自动来源 reason、调用栈 stack、activeChat 快照，以及旧数据写入预警 [SAVE-STALE-WARN]。",
            "新增 window.__ovoSaveAuditBuffer 和 window.__ovoDumpSaveAudit()，方便回退后复制最近保存日志给调试窗口。"
        ]
    },
    {
        version: "WOW v55.9.21",
        date: "2026-05-10",
        notes: [
            "WOW v55.9.21：新增保存审计日志，用于排查聊天记录回退/旧 history 迟到写入。",
            "saveData、saveCharacterData、saveGroupData 会在写库前后输出关键字段：historyLength、lastMessageTime、lastMessagePreview、saveSeq 等。",
            "本版只打 console 日志，不改变保存逻辑；默认开启，可在控制台设置 window.__ovoSaveAuditEnabled = false 关闭。"
        ]
    },
    {
        version: "WOW v55.9.19",
        date: "2026-05-09",
        notes: [
            "WOW v55.9.19：继续清理 AI 回复链路里的全量保存点。",
            "NO_REPLY 状态卡改为只保存当前角色/群聊，不再调用全量 saveData。",
            "普通 AI 回复末尾只有 favorites 真的变化时才保存 favorites，不再每轮无条件保存。",
            "addCharacterFavorite 返回是否新增成功，供回复链路判断 favoritesDirty。"
        ]
    },
    {
        version: "WOW v55.9.17",
        date: "2026-05-10",
        notes: [
            "WOW v55.9.17：把 saveData 从一个超大 IndexedDB transaction 改为分步逐条保存。",
            "避免 iOS/Safari 因全库大事务耗时过长而中止/回滚，导致数据回到上次成功保存点。",
            "保留 v55.9.16 的头像系统 deferSave 修复，以及 v55.9.15/14/13 的中途保存延后修复。",
            "本版先修语法错误和保存事务结构，不新增功能。"
        ]
    },
    {
        version: "WOW v55.9.16",
        date: "2026-05-10",
        notes: [
            "WOW v55.9.16：修复头像系统在 AI 回复处理中途触发 saveData 的问题。",
            "executeAvatarActions 新增 deferSave 选项；handleAiReplyContent 调用时传 {deferSave:true}，头像切换/情头操作只更新内存，等本轮回复末尾统一落盘。",
            "头像 saveData 可能把「有用户消息、无 AI 回复」的中间状态写入 IndexedDB 和快照，末尾 saveData 若事务失败则可能停在该状态。",
            "本版在 v55.9.15 基础上新增，不改其他功能。"
        ]
    },
    {
        version: "WOW v55.9.15",
        date: "2026-05-10",
        notes: [
            "WOW v55.9.15：清理 AI 回复处理中剩余的中途保存点（二）。",
            "移除「更换主题」指令执行时的中途 saveData，主题变更只更新内存，等本轮回复末尾统一落盘。",
            "parseReminderTags 新增 noSave 参数；AI 回复处理中调用时传 noSave=true，不再中途 saveData。",
            "修复 _ovoRestoreGlobalEmergencySnapshot 里 _ovoMarkGlobalSnapshotConfirmed 参数传错，避免恢复快照后 confirmed 时间戳不更新。"
        ]
    },
    {
        version: "WOW v55.9.14",
        date: "2026-05-08",
        notes: [
            "WOW v55.9.14：修复 v55.9.13 角色自动收藏 deferSave 参数未加入函数签名的问题。",
            "addCharacterFavorite 现在接收 options = {}，避免角色自动收藏触发 ReferenceError。",
            "保留 v55.9.13 的备注/收藏中途保存延后逻辑，不新增其他功能。"
        ]
    },
    {
        version: "WOW v55.9.13",
        date: "2026-05-08",
        notes: [
            "WOW v55.9.13：清理 AI 回复处理中剩余的中途保存点。",
            "角色自行修改备注不再中途 saveData，备注名与 system-display 消息改为等本轮回复末尾统一保存。",
            "角色自动收藏 addCharacterFavorite 新增 deferSave/noSave 选项，AI 回复处理中调用时不再中途保存。",
            "本版不新增功能，专门降低聊天消息回退概率。"
        ]
    },
    {
        version: "WOW v55.9.12",
        date: "2026-05-08",
        notes: [
            "WOW v55.9.12：在全局应急快照基础上增加 30 秒节流，避免每次保存都序列化完整 db 导致卡顿。",
            "快照跳过、快照失败、主保存失败分开处理：跳过不等于失败，跳过时不会更新快照确认时间。",
            "快照失败但主保存成功时只做轻提示；快照成功但主保存失败时提示已有全局快照可恢复。",
            "快照和主保存都失败时只强提示用户不要退出并立刻导出完整备份，不再写最近 120 条或操作摘要。"
        ]
    },
    {
        version: "WOW v55.9.11",
        date: "2026-05-08",
        notes: [
            "WOW v55.9.11：基于 v55.9.6 新增全局应急快照，处理白屏后全局数据回退。",
            "每次写入 IndexedDB 前，会先把当前完整 db 写入 CacheStorage 全局快照；写库成功后记录确认时间。",
            "启动后若发现快照时间新于最后确认写库时间，会弹窗询问是否恢复全局快照。",
            "恢复是手动确认的完整数据库恢复，覆盖 IndexedDB 到快照时刻；适合日记、设置、收藏、聊天等一起回退的情况。"
        ]
    },
    {
        version: "WOW v55.9.6",
        date: "2026-05-08",
        notes: [
            "WOW v55.9.6：优化角色操控手机时的目标名匹配。",
            "phone-control 读取、代发、删除、切换设置、清空聊天等操作保留原指令格式，但目标名支持忽略空格、引号、括号等装饰。",
            "优先精确匹配，只有唯一包含匹配时才放宽命中，降低因昵称/轻微格式差异找不到人的概率。"
        ]
    },
    {
        version: "WOW v55.9.5",
        date: "2026-05-08",
        notes: [
            "WOW v55.9.5：回退 v55.9.4 的待删除列表方案，改为更小范围修复。",
            "角色操控手机删除好友时，只额外删除 IndexedDB characters 表里的对应单条角色记录。",
            "不改 saveData 主流程，不新增 pending 删除列表，不影响 phone-control 指令解析。"
        ]
    },
    {
        version: "WOW v55.9.3",
        date: "2026-05-08",
        notes: [
            "WOW v55.9.3：继续修复聊天记录回退问题。",
            "移除 phone-control 指令执行过程中的中途 saveData。",
            "角色查看聊天、代发消息、删除角色、切换设置、清空聊天等手机操控动作只改当前内存对象。",
            "等 AI 回复写入 history 后，由本轮回复处理末尾统一保存，避免旧 history 抢写覆盖新消息。"
        ]
    },
    {
        version: "WOW v55.9.2",
        date: "2026-05-08",
        notes: [
            "WOW v55.9.2：手机操控权限普通开关改为直接关闭。",
            "关闭“允许角色查看并操控你的手机”时，不再触发“TA 可能不会轻易同意…”和角色主动阻拦回复。",
            "保留强制关闭按钮，但普通开关现在也能直接关闭。",
            "本版不改角色自行操作开关、不改收藏/经期感知、不改聊天保存链路。"
        ]
    },
    {
        version: "WOW v55.9.1",
        date: "2026-05-08",
        notes: [
            "WOW v55.9.1：修复角色自行操作功能开关导致聊天消息回退的问题。",
            "移除 SETTING_TOGGLE 指令执行过程中的中途 saveCharacterData/saveData。",
            "开关变更只修改当前角色对象，等 AI 回复写入 history 后由原聊天流程末尾统一保存。",
            "不改白名单、不改 UI、不改 pendingSettingControlEvents 逻辑。"
        ]
    },
    {
        version: "WOW v55.9",
        date: "2026-05-08",
        notes: [
            "WOW v55.9：新增“允许角色自行操作功能开关”总开关。",
            "开启后，角色可用隐藏指令自行开启/关闭白名单内功能；每轮最多执行两个，执行后 toast 告知用户。",
            "白名单包括：全部角色收藏、用户全部角色收藏、角色不回消息、经期感知、提醒事项、拉黑用户、手机操控。",
            "用户手动开启/关闭总开关或白名单小开关后，会作为 pending 事件在下一轮告知角色；不写入聊天 history。"
        ]
    },
    {
        version: "WOW v55.8",
        date: "2026-05-08",
        notes: [
            "WOW v55.8：收藏常驻感知补充“允许角色查看全部角色收藏”。",
            "开启后，角色可查看所有角色自己收藏过的用户消息，并明确标注来源角色，避免误认为是自己的收藏。",
            "每类注入条数仍按原规则生效：0=每类全部，大于0=每类最多 N 条。",
            "本版不改收藏数据结构，不改原有触发型收藏感知。"
        ]
    },
    {
        version: "WOW v55.7",
        date: "2026-05-08",
        notes: [
            "WOW v55.7：新增收藏常驻感知，默认关闭。",
            "角色设置新增：允许角色查看自己的收藏、允许角色查看用户收藏的他的消息、允许角色查看用户收藏的全部角色消息。",
            "新增每类注入条数，0=每类全部，大于0=每类最多 N 条。",
            "本版不改原有收藏/批注触发型感知，不改收藏数据结构。"
        ]
    },
    {
        version: "WOW v55.6",
        date: "2026-05-08",
        notes: [
            "WOW v55.6：修复日历返回按钮，退出日历返回 Menu 页面而不是主页。",
            "修复经期记录表单回填：重新进入日历时自动显示最近一次保存的开始日期和结束日期。",
            "点击日历某一天时，会把该日期填入开始/结束日期，便于新增或修改记录。",
            "本版不改经期存储结构，不改角色感知逻辑。"
        ]
    },
    {
        version: "WOW v55.5",
        date: "2026-05-08",
        notes: [
            "WOW v55.5：新增角色级“允许角色感知我的经期”开关，默认关闭。",
            "开启后，私聊 system prompt 会注入日历中的经期状态、最近记录、下次预计经期、预计排卵日与易孕期。",
            "提示词要求角色只在气氛合适时自然提及，不要机械播报，也不强制立即回应。",
            "本版不接情侣空间、不改日历数据结构、不碰混淆 main.js。"
        ]
    },
    {
        version: "WOW v55.4",
        date: "2026-05-08",
        notes: [
            "WOW v55.4：日历改为黑白圆圈风格。",
            "删除顶部说明卡与底部估算提示文字。",
            "月份与星期改为英文显示，日期改为圆圈样式。",
            "经期、预计经期、排卵日与易孕期改用黑白圆圈样式区分。"
        ]
    },
    {
        version: "WOW v55.3",
        date: "2026-05-08",
        notes: [
            "WOW v55.3：日历改为纯经期日历，删除心情手帐和角色记录相关 UI。",
            "美化日历 UI：新增经期日历说明卡、优化日期格、摘要卡和经期标记样式。",
            "点击某天只选中日期并填入经期开始日期，不再弹出手帐卡片。",
            "本版不接情侣空间、不接角色感知。"
        ]
    },
    {
        version: "WOW v55.2",
        date: "2026-05-08",
        notes: [
            "WOW v55.2：调整日历手帐 UI，点选某一天后弹出当天手帐卡片。",
            "删除日历右上角“今”按钮，移除页面底部独立手帐区。",
            "当天手帐卡片新增“你的记录”和“角色记录”两组字段，并支持自定义表情/状态输入。",
            "本版只做 UI 与本地存储结构预留，不接角色感知。"
        ]
    },
    {
        version: "WOW v55.1",
        date: "2026-05-08",
        notes: [
            "WOW v55.1：日历入口改为接入 404 Menu 原有“日历”按钮。",
            "删除主页第二页新增的日历图标，避免重复入口。",
            "点击 Menu 日历后直接进入 v55 日历页面，不再提示开发中。",
            "本版不碰混淆 main.js，不改日历数据结构。"
        ]
    },
    {
        version: "WOW v55",
        date: "2026-05-08",
        notes: [
            "WOW v55：新增日历一期。",
            "启用日历入口，可记录经期开始/结束日期，设置周期和经期天数，自动预测下次经期、排卵日和易孕期。",
            "新增每日心情/手帐短记，数据保存在本地 calendarData。",
            "本版不做角色感知，不碰后台自动消息、不碰混淆 main.js。"
        ]
    },
    {
        version: "WOW v53.2.1",
        date: "2026-05-08",
        notes: [
            "修正用户收藏列表样式：收藏寄语和角色批注改为独立块显示，和角色收藏列表保持一致。",
            "仅调整 UI 渲染，不改收藏感知逻辑、不改保存链路。"
        ]
    },
    {
        version: "WOW v53.2",
        date: "2026-05-08",
        notes: [
            "WOW v53.2：新增“角色感知我收藏他的消息”独立开关。",
            "用户收藏角色消息时，角色下一轮可自然感知；用户保存收藏寄语时，角色可再次感知。",
            "角色可输出 [FAVORITE_REPLY_NOTE:批注内容] 给该收藏写入“角色的批注”，指令不显示在聊天内容里。",
            "本版基于 WOW v53 第一阶段，只新增用户收藏线，不改导入导出、不改保存主链路。"
        ]
    },
    {
        version: "WOW v53",
        date: "2026-05-08",
        notes: [
            "WOW v53：新增收藏批注感知第一阶段。",
            "角色设置新增“角色感知收藏批注”开关，默认关闭。",
            "角色收藏详情新增“用户的批注”栏；保存批注后，下一轮角色可自然感知这条收藏和批注。",
            "本版只做“角色收藏 → 用户批注 → 角色感知”，不做用户收藏线，不写聊天 history。"
        ]
    },
    {
        version: "v52",
        date: "2026-05-06",
        notes: [
            "基于 v50.4.2-character-settings-save-fix 新增「角色感知我给他改备注」。",
            "开关默认关闭；开启后，用户修改角色备注会记录一次 pending 事件。",
            "下一轮私聊回复时注入一次备注变化感知，回复成功后自动清除，不写入灰色系统提示。"
        ]
    },
    {
        version: "v50.4.2-character-settings-save-fix",
        date: "2026-05-06",
        notes: [
            "基于 v50.4.2-screen-memory，只修复角色设置「保存所有更改」偶发卡顿。",
            "角色设置保存改为顺序局部保存当前角色和 novelAiSettings，不再触发全库 saveData。",
            "保存按钮增加保存中状态和失败提示；渲染延后一拍，避免保存反馈被重渲染卡住。"
        ]
    },
    {
        version: "v50.4.2",
        date: "2026-05-06",
        notes: [
            "新增：页面位置记忆。导入/导出、文件选择或下载后如果页面被系统恢复到主页，会尽量自动回到原页面。",
            "恢复聊天室时会优先走 openChatRoom，避免标题、背景、消息区和气泡样式丢状态。",
            "恢复日记/更多/联系人/API 设置等页面后，会做一次轻量刷新，减少导入导出后的空白或默认值回填问题。",
            "不改导入导出核心数据逻辑，只补页面恢复兜底。"
        ]
    },
    {
        version: "v50.4.1",
        date: "2026-05-04",
        notes: [
            "v50.4.1：局部保存 await 清洁版。",
            "在 v50.4-local-save-optimized 基础上，补齐 API 预设、副 API 预设、论坛设置、偷看补充人设等局部保存的 await。",
            "降低保存后立刻刷新/退出时设置尚未落盘的概率。",
            "不新增备注感知，不碰编辑消息增强。"
        ]
    },
    {
        version: "v50.4-local-save-optimized",
        date: "2026-05-06",
        notes: [
            "保存设置卡顿优化：新增 globalSettings 局部保存，API/副API/生图/论坛设置不再触发全库逐条保存。",
            "偷看手机当前角色设置改为角色局部保存，避免一次设置保存扫完整个 IndexedDB。",
            "保留原有 saveData 全量保存逻辑，用于导入、数据迁移和真正需要全量落库的场景。"
        ]
    },
    {
        version: "v50.4",
        date: "2026-05-04",
        notes: [
            "v50.4：修复导入/恢复数据完成后整页刷新导致跳回最开头界面的问题。",
            "完整导入、分类导入、GitHub 云端恢复完成后改为局部刷新当前界面，不再 window.location.reload。",
            "继续保留 v50.3 老迁移不 delete、v50.2 启动保护、v50.1 固定键备份防回退。"
        ]
    },
    {
        version: "v50.3",
        date: "2026-05-04",
        notes: [
            "v50.3：移除老 Dexie version(2) 迁移里删除旧 storage 记录的动作。",
            "旧 storage 记录不再 delete，避免 iOS/Safari 在升级事务里 Failed to delete record from object store 导致数据库启动失败。",
            "继续保留 v50.2 启动期数据库保护、v50.1 固定键备份防回退、v50 逐条 put 保存。"
        ]
    },
    {
        version: "v50.2",
        date: "2026-05-04",
        notes: [
            "v50.2：新增启动期数据库保护。",
            "loadData/旧数据检查未结束前，saveData 会短暂等待，避免刚打开网页时保存/删除抢 IndexedDB。",
            "移除 loadData 内部的立即保存，降低首次打开时报 Failed to delete record from object store 的概率。",
            "继续保留 v50.1 的固定键备份防回退与逐条 put 存储清洁。"
        ]
    },
    {
        version: "v50.1",
        date: "2026-05-04",
        notes: [
            "v50.1：存储清洁底包。",
            "从 v50 稳定版接入固定键备份防回退逻辑，旧 localStorage 只在 IndexedDB 为空时迁移。",
            "旧 localStorage 会移动到固定备份键 gemini-chat-app-db-backup-before-migration，不再直接删除唯一副本。",
            "老 Dexie version(2) 迁移里的 bulkPut 改为逐条 put，降低 iOS/Safari 抽风概率。",
            "不包含备注感知、编辑消息增强、局部保存、通知头像等试验功能。"
        ]
    },
    {
        version: "v50",
        date: "2026-05-04",
        notes: [
            "v50：修复 v49 打开后可能出现 characters.bulkPut 保存失败的问题。",
            "保留 v42 稳定底包和更新弹窗。",
            "保存方式从批量 bulkPut 改成逐条 put，降低 iOS IndexedDB 抽风概率。"
        ]
    },
    {
        version: "v49",
        date: "2026-05-04",
        notes: [
            "v49：回退到稳定 v42 作为底包。",
            "保留：后台保活真实 mp3、未读灰色小圈数字。",
            "新增：更新弹窗提示。以后每次发新版，只要修改 appVersion，就会自动弹出更新日志。",
            "舍弃：v43-v48 的编辑消息增强、引用增强、局部保存试验，避免按钮卡死和保存异常。"
        ]
    },
    {
        version: "3.15.1",
        date: "2026-03-15",
        notes: [
            "3.15微量更新：",
            "1.新增亲属卡删除，角色只能送一张亲属卡",
            "2.新增后台消息弹窗",
            "3.修复拉黑记忆一直持续记着，清空也没办法删除",
            "4.新增情头库上传功能",
            "5.修复状态栏文字修改后状态栏没有更新的BUG",
            "6.修复浏览器标题过长被挡住，大家觉得现在的布局看着舒服吗"
        ]
    },
    {
        version: "3.15",
        date: "2026-03-15",
        notes: [
            "3.15更新：",
            "内置了1900老师的输入框代码、萤火的uwu短屏代码，感谢两位女神的授权！",
            "内置了投稿/反馈的网页链接，是完全匿名的。",
            "1.新增论坛可以分享贴子给群聊，可以多选删除已有帖子",
            "2.新增小剧场可以调节字体，世界书可以多选移动到分类和多选启用和停用（豹豹老师改）",
            "3.新增免打扰时间段，这段时间应该不会有后台消息发来",
            "4.新增提醒事项，角色可以自行创建自己的代办事项，也可以在聊天过程中，帮用户创建代办事项。到点会自动提醒",
            "5.新增编辑可以新增消息，修复语音、视频不能自动播放的BUG",
            "6.新增偷看手机专属API",
            "7.新增头像系统，总之就是角色可以裁剪情头、自己更换头像，能发现用户头像的使用变化，比如说用户换头像会问一嘴。然后可以感知情头，生气了自己会换掉情头，或者用户换掉情头也会感知",
            "8.新增识图可以一次性上传多张图，修复用户头像刷新不及时的BUG",
            "9.新增删除状态栏按钮可以拖动",
            "10.新增拉黑系统，可以拉黑角色或者被角色拉黑，拉黑角色后仍可发言，但是角色不能回复，加回好友之前角色会记得拉黑后用户发的话，角色可以拒绝用户的申请",
            "11.新增浏览器可以点进去可以查看详情",
            "12.新增可以用角色手机给联系人发消息了，可以加联系人为好友，在聊天过程里面补充人设。需要现在偷看设置里面开启此开关",
            "13.新增角色可以查看并且控制用户手机，可以替用户发消息，可以替用户删除好友，可以随意开关设置里面的开关，并且在用户尝试关掉此权限的时候进行阻拦",
            "14.新增亲属卡，可以赠送亲属卡给角色，或者角色可以赠予亲属卡给你，可以调整亲属卡额度，冻结，收回，角色同样也可以调整给用户的亲属卡额度，冻结，收回。并且用户使用亲属卡，角色会有感知",
            "15.新增云备份可以大容量分片上传",
            "16.新增发送消息时可以有声音",
            "17.新增角色高级清理，可以直接清理聊天记录啥啥的",
            "18.新增多选收藏可以合并，可以在外面多选删除收藏"
        ]
    },
    {
        version: "3.7",
        date: "2026-03-07",
        notes: [
            "3.7重大更新：",
            "1.小剧场新增角色主动生成！新增导出功能，并且再度进行优化，感谢豹豹老师！",
            "2.感谢理芽给UWU接入了生图和视频生图！特别伟大！感谢感谢！现在UWU可以生图啦！！配上1900老师的视频UI特别特别美妙！！",
            "3.新增本地上传字体",
            "4.新增状态栏可以多选删除（不删除也会自动屏蔽的）",
            "5.TOKEN分布更加详细！",
            "6.删掉音乐自动检测有效的BUG，修复来电提示音的BUG",
            "7.新增论坛可以创建用户小号，角色不会知道，但是！如果和大号太像了，会掉马！",
            "8.新增论坛可以私信评论区的人，可以回复评论区的人"
        ]
    },
    {
        version: "3.5",
        date: "2026-03-05",
        notes: [
            "3.5微量更新：",
            "1.修复了群聊记忆互通的BUG（豹豹老师修）",
            "2.加了小剧场分类导入导出和预设保存可选择同步保存人设世界书等等（豹豹老师加）",
            "3.修复TTS开关问题，修复TTS国际版问题",
            "4.删掉了自动揭露",
            "5.新增了真实摄像头，视频通话可以看到真实的你的样子（没有人许愿这个，但是！我想做就做了！）"
        ]
    },
    {
        version: "3.4",
        date: "2026-03-04",
        notes: [
            "3.4微量更新：（临时起意想要更新，所以没有什么）",
            "感谢豹豹老师再再再再次优化小剧场，现在小剧场可以HTML和独立API了！包括群聊问题、转账问题也感谢豹豹老师修复了！",
            "————",
            "1.稍微优化了一点点音乐界面吧，然后可以在线搜索听着玩，单独一个APP是准备后面和角色一起听分开，想做个听歌匹配陌生人",
            "2.新增图标名字自定义，导出屏幕自定义的时候也可以导出偷看里面的APP了",
            "3.修复冗余数据清除错误问题，修复记忆存档删除后，导入备份再次出现的问题",
            "4.新增正则功能，主要是用来过滤八股的",
            "5.新增删除消息的同时删除对应的状态栏和思维链",
            "6.修复超过1000条的回顶全部点不动的BUG",
            "7.新增时间戳样式，新增输入框增高开关",
            "8.优化了一点点日记保存按钮样式，更加明显方便点击"
        ]
    },
    {
        version: "3.2",
        date: "2026-03-02",
        notes: [
            "感谢豹豹老师再次优化小剧场",
            "1.修复论坛私聊串来串去的问题",
            "2.修复论坛角色伪装失败！这次绝对很成功！修复角色头像明显、角色不适用填写好的昵称",
            "3.互通了论坛大小号的记忆。修复论坛刷新不适用专属论坛API的BUG",
            "4.修复用户商城赠送也会被算进钱包的BUG",
            "5.修复记忆转跳弄错CHAR的问题",
            "6.新增语音语速设置",
            "7.新增偷看部分APP可以自定义生成条数",
            "其他更新在做了在做了"
        ]
    },
    {
        version: "3.1",
        date: "2026-03-01",
        notes: [
            "**着重感谢：豹豹女神再次优化小剧场和冰镇草莓老师提供的全屏思路**",
            "————",
            "1.新增暂停调用按钮",
            "2.新增聊天背景重置，全局导出美化新增APP图标，我昨天脑子糊涂了忘记了",
            "3.修复接入语音后，文字消息输出太快了，就导致一句话没读完就读下一句的BUG",
            "4.新增搜索出来的聊天记录可以回顶了，然后聊天设置里面也新增了回底回顶。",
            "5.修复TTS把用户声音和角色声音同步了，并且新增可以配置用户的声音",
            "6.修复TTS无法暂停的BUG，新增退出聊天页面即可暂停，并且二次点击也可以暂停",
            "7.新增直接拍照。",
            "8.新增清理本地图片，新增相册一键清空",
            "9.新增论坛功能，新增角色小号，喜欢玩私信的小心了，角色可能会用小号接近你。",
            "10.新增功能，角色可以自主更换导入的CSS主题",
            "11.新增功能，查手机会被角色知晓（需要先设置里面打开）",
            "12.改掉了双语模式还读翻译的BUG",
            "一些功能没做，一个是因为我一个人测试不过来，直接放上来又太冒险，所以还在酝酿中。",
            "还有一些新APP在慢慢磨前端网页，所以也还在酝酿"
        ]
    },
    {
        version: "2.28",
        date: "2026-02-28",
        notes: [
            "首先前排感谢两位女神！",
            "感谢豹豹/放假老师提供的功能，以下是豹豹/放假老师提供的更新日志：",
            "① 生成后的小剧场内容现已支持分类保存、收藏和编辑，并可分享给任意 char。",
            "②支持将角色所在群聊的记忆与私聊进行互通，并可自定义聊天条数及总结范围。",
            "群聊总结数量默认为 0：表示 char 会选择记忆该群聊的全部收藏总结。",
            "若修改为 1：表示 char 仅选择记忆最近 1 条群聊中的收藏总结（数字可按需调整）。",
            "‼️ 当 char 在多个群聊内时，如需为角色选择不同的群聊记忆，需要先在私聊界面开启“所在群聊记忆互通”按钮，并获取一次回复后，才可以进行群聊的选择。",
            "🆕群聊中的角色现已支持选择记忆私聊内容，记忆方式与角色记忆群聊内容的方式一致，实现双向记忆互通。",
            "————",
            "其次感谢1900老师提供的偷看手机的同比例图标素材！我抠图水平太烂了！",
            "————",
            "以下是所有更新内容：",
            "1.修复在没有开启TTS的情况下一直提示TTS未开启，新增可以清除选择过的内置音色",
            "2.修改了一下论坛私信逻辑，之前是只有用户发的贴子，现在用户在论坛里面评论也会引起某些NPC注意来私信你",
            "3.新增论坛私信逻辑，可以在论坛里面添加私信的人为好友，并且在聊天中一步步补齐这个私信NPC的人设！为了省API可以在API设置里配专门的补齐人设的副API！也可以手动补齐！",
            "4.新增可以分享论坛评论了。",
            "5.修复全局世界书没有自动关联的BUG，新增世界书分类可以删除、条目可以选择是否启用",
            "6.新增小组将和壁纸的自定义区域，可以导入导出方案。",
            "7.新增发送定位，角色也可以发送",
            "8.修复音乐播放和消息提示音冲突的问题。",
            "9.新增来电提示音，需自己上传音频",
            "10.修复存钱罐存了退回转账的BUG",
            "11.新增小剧场，感谢豹豹女神",
            "12.新增群聊私聊互通，再次感谢豹豹女神。",
            "13.商城和存钱罐同步。现在给角色代付，自己要买东西，角色给自己代付都会同步到对应的钱包。",
            "14.修复TTS粤语映射错误的BUG",
            "15.新增导入角色卡有开场白，左右滑动可以切换。",
            "16.新增世界书可以导入DOCX、TXT、JSON格式。",
            "17.新增表情包智能匹配。",
            "18.修复论坛专属API保存失效的BUG",
            "一些小的改动就不说了"
        ]
    },
    {
        version: "1.8",
        date: "2026-02-23",
        notes: [
            "UwU小章鱼0223改版 对应版本1.8",
            "源代码来源：EE、1900、莫由（论坛功能by莫由），发布前已告知1900",
            "————",
            "主要改动内容（其实也没有改动什么）：",
            "1.新增导入DOCX、TXT、ZIP角色，新增各种地方可以导入DOCX、TXT，表情包DOCX和TXT解析的比较宽泛，目前资源区的应该都能导入（？）",
            "2.新增语音TTS",
            "3.新增自动总结，TOKEN分布",
            "4.新增记忆库存档",
            "5.调整了一下搜索界面的CSS样式。",
            "6.新增收藏功能，可以写下自己收藏时候的感想，角色也可以自主收藏你的。需要自主开启",
            "7.新增查手机小号的帖子可以点进去看评论",
            "8.修改了当前的论坛逻辑。新增私信功能（可以私信别人或者收到别人私信）、评论、点赞、收藏、自己发帖。可以自定义配置论坛的API",
            "9.新增两个副API用于总结、后台活动",
            "10.新增全局世界书",
            "11.新增查手机的时光想说，大概是抒情风，就是遇到各种不同年纪的USER的时候CHAR怎么想的",
            "12.新增查手机的角色钱包。有两种UI界面，点击右上角太阳可以切换。",
            "13.新增主角自己的钱包。",
            "然后导出应该已经同步了，就这样。",
            "本来还想做小游戏的，燃尽了，下次吧",
            "还做了一些其他的调整，具体小优化比较细，我不写出来了。"
        ]
    },
    {
        version: "1.8.5",
        date: "2026-02-18",
        notes: [
            "聊天功能新增：视频通话/语音通话，用户打电话入口在功能面板里，char主动打电话需在聊天设置里打开开关",
            "思维链页面新增：通话专属cot设置，可开可不开，已内置默认思维链，支持自定义",
            "**操作指南：所有人！去dc小手机主频道看使用教程视频！**",
            "—————————————",
            "通话结束后自动总结，仅总结内容进入上下文。",
            "如总结失败，可以在通话记录里找到那次记录，点开，重新总结。如果频繁失败，可以复制通话记录里的全部内容找其他ai给你总结。",
            "如何查看总结内容？：进入调试模式，点击那个“视频通话结束”的系统消息，可以看到总结内容",
        ]
    },
    {
        version: "1.8.4",
        date: "2026-02-14",
        notes: [
            "新增卡COT思维链，原理同酒馆，部分预设条目改自吱吱的过境预设，卡cot方法原理来自KKM的预设教程，非常感谢！",
            "思维链目前应该仅对**Open AI**的**Gemini**模型生效，其他模型暂未测试。",
            "位置：404-Menu界面，默认为关闭状态，按需开启，内置默认思维链，支持自定义思维链，支持自定义思维链导入导出。",
            "思维链功能可能会影响AI的回复风格，但开启后在回复条数的自然程度和各特殊消息的使用上有明显进步，请根据实际情况选择开启。",
        ]
    },
    {
        version: "1.8.3",
        date: "2026-01-27",
        notes: [
            "1.日记功能升级！新增摘要总结风格，支持自定义风格。",
            "现在生成日记会自动带入聊天室背景，无需重复绑定。",
            "优化了日记生成的提示词，摘要风格更客观、时间线更清晰。",
            "智能迁移：旧版日记关联已自动优化，去除了重复的背景设定。",
            "合并精简：新增多选日记进行合并，将多篇日记整合成一篇连贯、精简的“回忆录”，自动梳理时间线。",
            "参考过往：生成新日记时，可选择**参考已收藏的日记**。AI 会读取您收藏的重点回忆，确保新内容的连贯性，避免重复记录。",
            "—————————————",
            "2. 全新商城系统",
            "自定义分类：支持自定义分类名称和提示词。商城首页点击右上角 “＋”",
            "自选开关：如果不喜欢商城干扰聊天，可以在设置中关闭此功能。（仅关闭char不主动给你买东西和代付，你仍然可以单方面使用商城）",
            "—————————————",
            "3. 偷看界面 x 商城联动",
            "在偷看模式下，进入 “购物车”应用，点击底部的“结算”按钮，可以直接帮Ta买单。在偷看界面结算后，系统会自动跳转回聊天界面，并发送一条 “我为Ta清空了购物车” 的订单消息。",
            "4. 全局css救援",
            "任何界面里快速点5下，呼出救援面板一键清空全局css框内容"
        ]
    },
    {
        version: "1.8.2",
        date: "2025-01-24",
        notes: [
            "修了一点bug，提示音现在正常可以使用了",
            "解除了自定义css区域的限制，现在可以用全局变量之类的了，但是仍旧只生效于聊天室内！",
            "过往的美化有少量类名前面没加#chat-room-screen的可能有偏移！比如顶栏底栏的一些小地方，给美化老师们跪下了TT",
            "修了一些bug，做了提示音，【开始生成】是点让ai回复的那个按钮触发的音效，收到回复是发消息给你触发的音效",
            "做了朋友的一个纯点菜功能，选定指定片段截图，但是有bug截取不到气泡啥的只有纯文字和背景",
            "那个测试直播间别点，纯样板间很丑陋！太丑了做不下去了嗯！",
            "—————————分割线————————",
            "刚接触章鱼机的有使用相关问题先看主屏幕→教程→更新日志，全都翻一遍！",
            "其次再看聊天列表底部导航栏→通话图标，点击之后有详细的新版本更新说明，全都翻一遍！",
            "如果出现报错日志，自己看不懂就复制日志内容发给ai问",
            "还有问题就去尾巴镇→ee小手机区→标注搜索：小章鱼UwU问题自助",
            "关于状态栏是肯定要和ai肘击的，很难一步到位，状态栏不是必需品，会影响ai的回复质量",
            "以上这些能囊括90%的解决方法，尽量不要就基础问题消耗无偿答疑老师们的热情，亲亲你们！",
        ]
    },
    {
        version: "1.8.0",
        date: "2025-01-15",
        notes: [
            "先别点【我知道了】，看完看完看完",
            "本次更新的群成员私聊和Ta相册皆为【测试中】功能，不知道效果如何，均做了可选开关，不开也不影响正常玩",
            "🔍 搜索页: 快速查找聊天记录，支持关键词高亮。",
            "🖼️ TA 相册: 在聊天设置管理角色的专属相册，在聊天设置里开启此开关后，聊天时角色可直接发送你已经上传的图片（最好使用url）。",
            "📢 群公告: 群聊设置中新增公告功能，重要信息置顶显示。",
            "🤫 群内私聊: 群聊中支持成员间发起私聊，双击群聊标题可查看，八卦吐槽更方便。",
            "📝 群聊总结: 智能总结群聊记录，自动关联当前群聊世界书，内置提示词。",
            "📒 token：角色资料卡处（联系人界面点击角色头像），粗略统计角色当前聊天室的token，并不完全准确仅作参考！",
            "—————————分割线————————",
            "刚接触章鱼机的有使用相关问题先看主屏幕→教程→更新日志，全都翻一遍！",
            "其次再看聊天列表底部导航栏→通话图标，点击之后有详细的新版本更新说明，全都翻一遍！",
            "如果出现报错日志，自己看不懂就复制日志内容发给ai问",
            "还有问题就去尾巴镇→ee小手机区→标注搜索：小章鱼UwU问题自助",
            "关于状态栏是肯定要和ai肘击的，很难一步到位，状态栏不是必需品，会影响ai的回复质量",
            "以上这些能囊括90%的解决方法，尽量不要就基础问题消耗无偿答疑老师们的热情，亲亲你们！",
        ]
    },
    {
        version: "1.7.2",
        date: "2025-01-15",
        notes: [
            "先别点【我知道了】，看完看完看完",
            "刚接触章鱼机的有使用相关问题先看主屏幕→教程→更新日志，全都翻一遍！",
            "其次再看聊天列表底部导航栏→通话图标，点击之后有详细的新版本更新说明，全都翻一遍！",
            "如果出现报错日志，自己看不懂就复制日志内容发给ai问",
            "还有问题就去尾巴镇→ee小手机区→标注搜索：小章鱼UwU问题自助",
            "关于状态栏是肯定要和ai肘击的，很难一步到位，状态栏不是必需品，会影响ai的回复质量",
            "以上这些能囊括90%的解决方法，尽量不要就基础问题消耗无偿答疑老师们的热情，亲亲你们！",
        ]
    },
    {
        version: "1.6.0",
        date: "2025-01-04",
        notes: [
            "本次更新：更迭了表情包的机制，过往的机制因比较占token弃用，所以以前聊天记录的不再渲染。",
            "批量导入表情包时使用英文/中文的冒号都可以。",
            "现在的表情包如何使用？批量导入时填写分组名称，一定要填！未分类的表情包不能被char使用（包括你以前的表情包都属于未分类）；然后在侧边栏给char选择他可以使用的表情包分组即可。",
            "以前的表情包统一归类到未分类里，想给char使用时一定要多选时→转移分组→自己分一下类。",
            "偷看手机的数据现在不会退出即清空了，想生成下一次之前点击右上角的删除一键清空即可。",
            "有任何报错请首先在dc小手机区标注内搜索uwu，有自助答疑清单，不要就基础问题消耗无偿答疑老师们的热情，亲亲你们！",
            "过往更新说明 及 功能使用说明 重复观看指路→主屏幕的教程app→更新说明！新手宝宝一定要看哦。",
        ]
    },
    {
        version: "1.5.0",
        date: "2025-12-17",
        notes: [
            "本次更新：应该大大降低了日记生成出错的概率，感谢匿名小宝自发修改测试并提供的修复代码！",
            "匿名小宝捎来讯息：感谢所有一直为爱发电、无私分享代码的开发小手机的老师们！",
            "在此私心也想对所有为爱发电做UwU美化以及答疑解惑的老师们表示感谢！鞠躬——！",
        ]
    },
    {
version: "1.4.0",
date: "2025-12-12",
notes: [
    "本次更新：GitHub云端备份功能上线！指路→主屏幕的【教程】app→划到页面最底部即可看到。（UI从其他地方搬的，懒得做美化了！将就用吧对不起！）",
    "主要功能：一键上传/恢复最新备份。配置好后，备份数据直接存到你自己的GitHub私人仓库里，恢复即从你的仓库中自动选取时间戳最新的备份文件导入恢复。",
    "配置太难不会弄？别慌！点击配置栏旁边的【蓝色小问号图标】，里面内置了手把手的保姆级教程。不要被英文吓到，跟着步骤点几下，配置一次，终身受益。",
    "测试中功能，不一定有用：配置完成后，可根据自身需要开启【自动备份开关】！设置好频率（比如每24小时），以后只要你打开这个网页，它就会在后台悄悄帮你把存档上传到云端，再也不用担心忘记备份了。",
    "特别提醒：为了你的数据安全，在GitHub账户中获取的 Token (以 ghp_ 开头的那一串) 和仓库名称请务必自己保存好，不要发给别人哦！",
    "过往更新说明重复观看指路→主屏幕的教程app→更新说明！",
    ]
    },
    {
        version: "1.3.0",
        date: "2025-11-11",
        notes: [
            "务必仔细观看！重复观看指路→主屏幕的教程app→更新说明！",
            "新增：双语模式，位于聊天界面的侧边栏内，当char为外国人而你想要更沉浸式的对话时，可按需开启，开启后会将“外文中文）”的消息识别成双语消息气泡，注意！中文翻译必须在括号内，点击气泡后展开翻译。",
            "新增：流式传输开关，位于api设置界面，开跟不开不知道有什么区别，总之做了嗯嗯。没改之前默认是流式传输，如果非流出不来就开流式，流式出不来就关流式，都出不来我也没招了！",
            "补充教学：发现有些宝宝还有地方不太清楚怎么使用，补充一下",
            "2. 回忆日记：生成日记后，需点亮该篇日记右上角的☆按钮收藏，收藏后该篇日记才会作为char的回忆加入聊天上下文中",
            "3. 日记使用拓展方法：日记内容可编辑，当日记篇数过多/char被日记内的主观形容影响性格较大时，可以将你需要保留的日记内容复制给某个ai（豆包、deepseek、哈吉米都行）进行大总结，指令参考：以全客观的、不参杂任何主观情绪，以第三人称视角按照时间顺序总结发生过的事件和关键语句。然后将返回的总结塞进日记收藏加入上下文即可。",
        ]
    },
    {
        version: "1.2.0",
        date: "2025-10-15",
        notes: [
            "新增：世界书批量删除功能，长按条目即可进入多选删除模式，支持分类全选。",
        ]
    },
    {
        version: "1.1.0",
        date: "2025-10-13",
        notes: [
            "新增：番茄钟，可以创建专注任务并绑定char和自己的人设预设（仅可从预设中选择），在列表中左滑删除任务。专注期间想摸鱼了可以戳一戳头像，ta会对你做出回复。每个专注界面的设置键可以自定义鼓励频率和限制自己戳一戳的次数，超过次数则ta不会再理你，请补药偷懒，努力专注吧！",
            "新增：两个桌面小组件，现所有小组件都可以通过点击来自定义图片和文字",
        ]
    },
    // ... 其他更新日志可以在 tutorial.js 中处理，这里保留最新的即可，或者全部保留
];

// 全局变量
var db = {
    characters: [],
    groups: [],
    apiSettings: {},
    summaryApiSettings: {},
    backgroundApiSettings: {},
    supplementPersonaApiSettings: {},
    peekApiSettings: {},
    wallpaper: 'https://i.postimg.cc/W4Z9R9x4/ins-1.jpg',
    myStickers: [],
    homeScreenMode: 'night',
    worldBooks: [],
    fontUrl: '',
    localFontName: '',
    customIcons: {},
    customAppNames: {},
    apiPresets: [],
    summaryApiPresets: [],
    backgroundApiPresets: [],
    supplementPersonaApiPresets: [],
    peekApiPresets: [],
    bubbleCssPresets: [],
    myPersonaPresets: [],
    fontPresets: [],
    forumPosts: [],
    globalCss: '',
    globalCssPresets: [],
    homeSignature: '编辑个性签名...',
    forumBindings: {
        worldBookIds: [],
        charIds: [],
        userPersonaIds: []
    },
    pomodoroTasks: [],
    pomodoroSettings: {
        boundCharId: null,
        userPersona: '',
        focusBackground: '',
        taskCardBackground: '',
        encouragementMinutes: 25,
        pokeLimit: 5,
        globalWorldBookIds: []
    },
    insWidgetSettings: {
        avatar1: 'https://i.postimg.cc/Y96LPskq/o-o-2.jpg',
        bubble1: 'love u.',
        avatar2: 'https://i.postimg.cc/GtbTnxhP/o-o-1.jpg',
        bubble2: 'miss u.'
    },
    chatFolders: [],
    fontSizeScale: 1.0,
    savedKeyboardHeight: null,
    activePersonaId: null,
    moreProfileCardBg: 'https://i.postimg.cc/XvFDdTKY/Smart-Select-20251013-023208.jpg',
    statusBarPresets: [],
    regexFilterPresets: [],
    themeSettings: {
        global: {
            iconColor: '#000000',
            textColor: '#2a3032',
            titleColor: '#000000',
            backgroundColor: '#ffffff'
        },
        wallpapers: {
            contacts: '',
            chats: '',
            more: ''
        },
        bottomNav: {
            iconColor: '#999999',
            activeIconColor: '#2a3032',
            items: [
                { defaultIcon: '', activeIcon: '' },
                { defaultIcon: '', activeIcon: '' },
                { defaultIcon: '', activeIcon: '' },
                { defaultIcon: '', activeIcon: '' }
            ]
        },
        chatScreen: {
            bottomBarColor: '#ffffff',
            iconColor: '#000000',
            folderPillColor: '#ffffff'
        }
    },
    themePresets: [],
    globalSendSound: '',
    globalReceiveSound: '',
    globalMessageSentSound: '',
    globalIncomingCallSound: '',
    multiMsgSoundEnabled: false,
    soundPresets: [],
    galleryPresets: [],
    iconPresets: [],
    cotSettings: {
        enabled: false,
        activePresetId: 'default'
    },
    cotPresets: JSON.parse(JSON.stringify(DEFAULT_COT_PRESETS)),
    archives: [],
    favorites: [],  // 消息收藏：{ id, messageId, chatId, chatType, chatName, content, timestamp, favoriteTime, note, sender }
    phoneControlRecycleBin: []  // 角色掌控模式：被角色“删除”的角色移入回收站，可恢复
};

var currentChatId = null;
var currentChatType = null;
var isGenerating = false;
var currentReplyAbortController = null; // 用于「暂停调用」中止当前 AI 请求（单聊/群聊共用）
var longPressTimer = null;
var isInMultiSelectMode = false;
var editingMessageId = null;
var currentPage = 1;
var currentTransferMessageId = null;
var currentEditingWorldBookId = null;
var currentStickerActionTarget = null;
var currentJournalDetailId = null;
var currentQuoteInfo = null;
var isDebugMode = false;
var currentFolderId = 'all';
var currentFolderActionTarget = null;
var currentGroupAction = {type: null, recipients: []};
var isRawEditMode = false;
var currentPomodoroTask = null;
var pomodoroInterval = null;
var pomodoroRemainingSeconds = 0;
var pomodoroCurrentSessionSeconds = 0;
var isPomodoroPaused = true;
var pomodoroPokeCount = 0;
var pomodoroIsInterrupted = false;
var currentPomodoroSettingsContext = null;
var pomodoroSessionHistory = [];
var isStickerManageMode = false;
var selectedStickerIds = new Set();
var isWorldBookMultiSelectMode = false;
var selectedWorldBookIds = new Set();
var generatingPeekApps = new Set();
var selectedMessageIds = new Set();
var currentStickerCategory = 'recent';
const MESSAGES_PER_PAGE = 50;


// Dexie 数据库初始化
var dexieDB; // 声明全局变量，但不初始化

function initDatabase() {
    dexieDB = new Dexie('章鱼喷墨机DB_ee');
    dexieDB.version(1).stores({
        storage: 'key, value'
    });
    dexieDB.version(2).stores({
        characters: '&id',
        groups: '&id',
        worldBooks: '&id',
        myStickers: '&id',
        globalSettings: 'key'
    }).upgrade(async tx => {
        console.log("Upgrading database to version 2...");
        const oldData = await tx.table('storage').get('章鱼喷墨机');
        if (oldData && oldData.value) {
            console.log("Old data found, starting migration.");
            const data = JSON.parse(oldData.value);
            if (Array.isArray(data.characters)) {
                for (const character of data.characters) {
                    if (character && character.id) await tx.table('characters').put(character);
                }
            }
            if (Array.isArray(data.groups)) {
                for (const group of data.groups) {
                    if (group && group.id) await tx.table('groups').put(group);
                }
            }
            if (Array.isArray(data.worldBooks)) {
                for (const worldBook of data.worldBooks) {
                    if (worldBook && worldBook.id) await tx.table('worldBooks').put(worldBook);
                }
            }
            if (Array.isArray(data.myStickers)) {
                for (const sticker of data.myStickers) {
                    if (sticker && sticker.id) await tx.table('myStickers').put(sticker);
                }
            }
            
            const settingsToMigrate = {
                apiSettings: data.apiSettings || {},
                summaryApiSettings: data.summaryApiSettings || {},
                backgroundApiSettings: data.backgroundApiSettings || {},
                wallpaper: data.wallpaper || 'https://i.postimg.cc/W4Z9R9x4/ins-1.jpg',
                homeScreenMode: data.homeScreenMode || 'night',
                fontUrl: data.fontUrl || '',
                localFontName: data.localFontName || '',
                customIcons: data.customIcons || {},
                apiPresets: data.apiPresets || [],
                summaryApiPresets: data.summaryApiPresets || [],
                backgroundApiPresets: data.backgroundApiPresets || [],
                bubbleCssPresets: data.bubbleCssPresets || [],
                myPersonaPresets: data.myPersonaPresets || [],
                globalCss: data.globalCss || '',
                globalCssPresets: data.globalCssPresets || [],
                homeSignature: data.homeSignature || '编辑个性签名...',
                forumPosts: data.forumPosts || [],
                forumBindings: data.forumBindings || { worldBookIds: [], charIds: [], userPersonaIds: [] },
                pomodoroTasks: data.pomodoroTasks || [],
                pomodoroSettings: data.pomodoroSettings || { boundCharId: null, userPersona: '', focusBackground: '', taskCardBackground: '', encouragementMinutes: 25, pokeLimit: 5, globalWorldBookIds: [] },
                insWidgetSettings: data.insWidgetSettings || { avatar1: 'https://i.postimg.cc/Y96LPskq/o-o-2.jpg', bubble1: 'love u.', avatar2: 'https://i.postimg.cc/GtbTnxhP/o-o-1.jpg', bubble2: 'miss u.' },
                homeWidgetSettings: data.homeWidgetSettings || defaultWidgetSettings,
            moreProfileCardBg: data.moreProfileCardBg || 'https://i.postimg.cc/XvFDdTKY/Smart-Select-20251013-023208.jpg',
            cotSettings: data.cotSettings || { enabled: false, activePresetId: 'default' },
            cotPresets: data.cotPresets || JSON.parse(JSON.stringify(DEFAULT_COT_PRESETS))
            };

            const settingsPromises = Object.entries(settingsToMigrate).map(([key, value]) =>
                tx.table('globalSettings').put({ key, value })
            );
            await Promise.all(settingsPromises);
            // 不再删除旧 storage 记录，避免 iOS/Safari 在升级事务里 delete 失败导致整个数据库打开失败。
            // 旧 storage 表在后续 schema 中不再使用，保留它比启动失败更安全。
            console.log("Migration complete. Old storage record kept for safety.");
} else {
            console.log("No old data found to migrate.");
        }
    });
    dexieDB.version(3).stores({
        characters: '&id',
        groups: '&id',
        worldBooks: '&id',
        myStickers: '&id',
        globalSettings: 'key',
        archives: '&id,characterId,timestamp'
    });
    dexieDB.version(4).stores({
        characters: '&id',
        groups: '&id',
        worldBooks: '&id',
        myStickers: '&id',
        globalSettings: 'key',
        archives: '&id,characterId,timestamp',
        generatedImages: '&id,messageId,createdAt'
    });
}


// 全局应急快照：用于处理 iOS/PWA 白屏后 IndexedDB 回到旧保存点的问题。
// 主存档仍是 IndexedDB；这里把完整 db 放到 CacheStorage，localStorage 只记录时间戳。
// 恢复时必须手动确认，不会自动覆盖当前数据库。
const OVO_EMERGENCY_CACHE_NAME = 'ovo-emergency-global-snapshot-v1';
const OVO_EMERGENCY_SNAPSHOT_URL = (typeof location !== 'undefined')
    ? `${location.origin}${location.pathname}?ovo_emergency_global_snapshot=latest`
    : '/?ovo_emergency_global_snapshot=latest';
const OVO_LAST_CONFIRMED_SAVE_TS_KEY = 'ovo-last-confirmed-idb-save-at';
const OVO_LAST_SNAPSHOT_TS_KEY = 'ovo-last-global-snapshot-at';

const OVO_GLOBAL_SNAPSHOT_INTERVAL_MS = 30000;
let _ovoLastGlobalSnapshotAttemptAt = 0;
let _ovoLastSnapshotWarningAt = 0;
let _ovoLastMainSaveWarningAt = 0;

async function _ovoWriteGlobalEmergencySnapshot(reason, options) {
    options = options || {};
    const now = Date.now();
    const force = !!options.force;

    if (!force && _ovoLastGlobalSnapshotAttemptAt && now - _ovoLastGlobalSnapshotAttemptAt < OVO_GLOBAL_SNAPSHOT_INTERVAL_MS) {
        return { savedAt: 0, skipped: true, failed: false, error: null };
    }

    if (typeof caches === 'undefined') {
        return { savedAt: 0, skipped: false, failed: true, error: new Error('CacheStorage unavailable') };
    }

    _ovoLastGlobalSnapshotAttemptAt = now;
    const savedAt = now;
    try {
        const payload = {
            savedAt,
            appVersion: (typeof appVersion !== 'undefined') ? appVersion : '',
            reason: reason || '',
            db
        };
        const text = JSON.stringify(payload);
        const cache = await caches.open(OVO_EMERGENCY_CACHE_NAME);
        await cache.put(
            new Request(OVO_EMERGENCY_SNAPSHOT_URL),
            new Response(text, { headers: { 'Content-Type': 'application/json' } })
        );
        localStorage.setItem(OVO_LAST_SNAPSHOT_TS_KEY, String(savedAt));
        return { savedAt, skipped: false, failed: false, error: null };
    } catch (e) {
        console.warn('[OVO全局应急快照] 写入失败:', e);
        return { savedAt: 0, skipped: false, failed: true, error: e };
    }
}

function _ovoMarkGlobalSnapshotConfirmed(snapshotResult) {
    if (!snapshotResult || snapshotResult.skipped || snapshotResult.failed || !snapshotResult.savedAt) return;
    try {
        localStorage.setItem(OVO_LAST_CONFIRMED_SAVE_TS_KEY, String(snapshotResult.savedAt));
    } catch (e) {
        console.warn('[OVO全局应急快照] 标记确认失败:', e);
    }
}

function _ovoWarnSnapshotFailedButMainSaveSucceeded(snapshotResult) {
    if (!snapshotResult || !snapshotResult.failed) return;
    const now = Date.now();
    if (_ovoLastSnapshotWarningAt && now - _ovoLastSnapshotWarningAt < 5 * 60 * 1000) return;
    _ovoLastSnapshotWarningAt = now;
    if (typeof showToast === 'function') {
        showToast('主保存已完成，但全局应急快照写入失败');
    }
}

function _ovoShowMainSaveFailureModal(snapshotResult, saveError) {
    try {
        const hasSnapshot = !!(snapshotResult && !snapshotResult.failed && !snapshotResult.skipped && snapshotResult.savedAt);
        let modal = document.getElementById('ovo-main-save-failure-modal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'ovo-main-save-failure-modal';
            modal.style.cssText = 'position:fixed;inset:0;z-index:100002;background:rgba(0,0,0,.42);display:flex;align-items:center;justify-content:center;padding:18px;';
            modal.innerHTML = `
                <div style="width:min(92vw,400px);background:#fff;border-radius:18px;padding:18px;box-shadow:0 12px 40px rgba(0,0,0,.22);font-size:14px;line-height:1.6;color:#333;">
                    <div style="font-weight:700;font-size:16px;margin-bottom:8px;" id="ovo-main-save-failure-title">保存失败</div>
                    <div id="ovo-main-save-failure-text" style="color:#666;margin-bottom:14px;"></div>
                    <div style="display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap;">
                        <button type="button" id="ovo-main-save-failure-close-btn" class="btn btn-primary" style="padding:7px 12px;border-radius:10px;">我知道了</button>
                    </div>
                </div>`;
            document.body.appendChild(modal);
        }
        const titleEl = document.getElementById('ovo-main-save-failure-title');
        const textEl = document.getElementById('ovo-main-save-failure-text');
        if (titleEl) titleEl.textContent = hasSnapshot ? '主保存失败，但已有全局快照' : '主保存和全局快照都失败';
        if (textEl) {
            textEl.textContent = hasSnapshot
                ? '请不要刷新或退出。可以稍后重试保存；如果发生回退，下次打开会提示你恢复全局快照。'
                : '请不要刷新或退出。当前页面内存里的数据通常还在，请立刻导出完整备份或复制重要内容。';
        }
        modal.style.display = 'flex';
        const closeBtn = document.getElementById('ovo-main-save-failure-close-btn');
        if (closeBtn) closeBtn.onclick = () => { modal.style.display = 'none'; };

        const now = Date.now();
        if (!_ovoLastMainSaveWarningAt || now - _ovoLastMainSaveWarningAt > 10 * 1000) {
            _ovoLastMainSaveWarningAt = now;
            if (typeof showToast === 'function') {
                showToast(hasSnapshot ? '主保存失败，但已有全局快照' : '主保存和全局快照都失败，请立刻导出备份');
            }
        }
    } catch (e) {
        console.error('[OVO保存] 保存失败弹窗显示失败:', e, saveError);
    }
}

async function _ovoReadGlobalEmergencySnapshot() {
    if (typeof caches === 'undefined') return null;
    try {
        const cache = await caches.open(OVO_EMERGENCY_CACHE_NAME);
        const res = await cache.match(new Request(OVO_EMERGENCY_SNAPSHOT_URL));
        if (!res) return null;
        return await res.json();
    } catch (e) {
        console.warn('[OVO全局应急快照] 读取失败:', e);
        return null;
    }
}

async function _ovoRestoreGlobalEmergencySnapshot(payload) {
    if (!payload || !payload.db) throw new Error('应急快照为空');
    const restored = payload.db;

    await dexieDB.transaction('rw', dexieDB.tables, async () => {
        if (dexieDB.characters) {
            await dexieDB.characters.clear();
            for (const character of (restored.characters || [])) {
                if (character && character.id) await dexieDB.characters.put(character);
            }
        }

        if (dexieDB.groups) {
            await dexieDB.groups.clear();
            for (const group of (restored.groups || [])) {
                if (group && group.id) await dexieDB.groups.put(group);
            }
        }

        if (dexieDB.worldBooks) {
            await dexieDB.worldBooks.clear();
            for (const worldBook of (restored.worldBooks || [])) {
                if (worldBook && worldBook.id) await dexieDB.worldBooks.put(worldBook);
            }
        }

        if (dexieDB.myStickers) {
            await dexieDB.myStickers.clear();
            for (const sticker of (restored.myStickers || [])) {
                if (sticker && sticker.id) await dexieDB.myStickers.put(sticker);
            }
        }

        if (dexieDB.archives) {
            await dexieDB.archives.clear();
            for (const archive of (restored.archives || [])) {
                if (archive && archive.id) await dexieDB.archives.put(archive);
            }
        }

        if (dexieDB.generatedImages && Array.isArray(restored.generatedImages)) {
            await dexieDB.generatedImages.clear();
            for (const image of restored.generatedImages) {
                if (image && image.id) await dexieDB.generatedImages.put(image);
            }
        }

        if (dexieDB.globalSettings) {
            await dexieDB.globalSettings.clear();
            for (const key of globalSettingKeys) {
                if (restored[key] !== undefined) {
                    await dexieDB.globalSettings.put({ key, value: restored[key] });
                }
            }
        }
    });

    Object.keys(db).forEach(key => delete db[key]);
    Object.assign(db, restored);

    const confirmedAt = payload.savedAt || Date.now();
    try {
        localStorage.setItem(OVO_LAST_CONFIRMED_SAVE_TS_KEY, String(confirmedAt));
    } catch (e) {
        console.warn('[OVO全局应急快照] 恢复后标记confirmed失败:', e);
    }
}

function _ovoShowGlobalEmergencyRestoreModal(payload) {
    if (!payload || !payload.db) return;
    try {
        let modal = document.getElementById('ovo-global-emergency-restore-modal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'ovo-global-emergency-restore-modal';
            modal.style.cssText = 'position:fixed;inset:0;z-index:100001;background:rgba(0,0,0,.38);display:flex;align-items:center;justify-content:center;padding:18px;';
            modal.innerHTML = `
                <div style="width:min(92vw,400px);background:#fff;border-radius:18px;padding:18px;box-shadow:0 12px 40px rgba(0,0,0,.2);font-size:14px;line-height:1.6;color:#333;">
                    <div style="font-weight:700;font-size:16px;margin-bottom:8px;">发现未确认保存的全局应急快照</div>
                    <div id="ovo-global-emergency-restore-text" style="color:#666;margin-bottom:12px;"></div>
                    <div style="font-size:12px;color:#999;margin-bottom:14px;">这是完整数据库快照，适合处理白屏后全局回退。恢复会把 IndexedDB 恢复到快照时刻，不会自动执行，需你手动确认。</div>
                    <div style="display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap;">
                        <button type="button" id="ovo-global-emergency-restore-btn" class="btn btn-primary" style="padding:7px 12px;border-radius:10px;">恢复全局快照</button>
                        <button type="button" id="ovo-global-emergency-ignore-btn" class="btn btn-neutral" style="padding:7px 12px;border-radius:10px;">暂不处理</button>
                    </div>
                </div>`;
            document.body.appendChild(modal);
        }

        const textEl = document.getElementById('ovo-global-emergency-restore-text');
        if (textEl) {
            const dt = payload.savedAt ? new Date(payload.savedAt).toLocaleString() : '未知时间';
            const chars = payload.db && payload.db.characters ? payload.db.characters.length : 0;
            const groups = payload.db && payload.db.groups ? payload.db.groups.length : 0;
            textEl.textContent = `快照时间：${dt}。包含 ${chars} 个角色、${groups} 个群聊，以及日记/设置/收藏等全局数据。`;
        }

        modal.style.display = 'flex';

        const restoreBtn = document.getElementById('ovo-global-emergency-restore-btn');
        if (restoreBtn) {
            restoreBtn.onclick = async () => {
                restoreBtn.disabled = true;
                const oldText = restoreBtn.textContent;
                restoreBtn.textContent = '恢复中...';
                try {
                    await _ovoRestoreGlobalEmergencySnapshot(payload);
                    if (typeof showToast === 'function') showToast('全局快照已恢复');
                    modal.style.display = 'none';
                    if (typeof renderChatList === 'function') renderChatList();
                    if (typeof currentChatId !== 'undefined' && currentChatId && typeof renderMessages === 'function') {
                        renderMessages(false, true);
                    }
                } catch (e) {
                    console.error('[OVO全局应急快照] 恢复失败:', e);
                    if (typeof showToast === 'function') showToast('恢复失败，请先导出当前数据');
                } finally {
                    restoreBtn.disabled = false;
                    restoreBtn.textContent = oldText || '恢复全局快照';
                }
            };
        }

        const ignoreBtn = document.getElementById('ovo-global-emergency-ignore-btn');
        if (ignoreBtn) ignoreBtn.onclick = () => { modal.style.display = 'none'; };
    } catch (e) {
        console.error('[OVO全局应急快照] 弹窗失败:', e);
    }
}

async function _ovoCheckGlobalEmergencySnapshotAfterLoad() {
    try {
        const snapshotTs = parseInt(localStorage.getItem(OVO_LAST_SNAPSHOT_TS_KEY) || '0', 10) || 0;
        const confirmedTs = parseInt(localStorage.getItem(OVO_LAST_CONFIRMED_SAVE_TS_KEY) || '0', 10) || 0;
        if (!snapshotTs || snapshotTs <= confirmedTs + 500) return;

        const payload = await _ovoReadGlobalEmergencySnapshot();
        if (!payload || !payload.savedAt || payload.savedAt <= confirmedTs + 500) return;

        setTimeout(() => _ovoShowGlobalEmergencyRestoreModal(payload), 800);
    } catch (e) {
        console.warn('[OVO全局应急快照] 启动检查失败:', e);
    }
}

if (typeof window !== 'undefined') {
    window.ovoCheckGlobalEmergencySnapshot = _ovoCheckGlobalEmergencySnapshotAfterLoad;
}



// 保存审计日志：排查聊天回退/旧 history 迟到写入用。
// 默认开启；只打 console + localStorage 持久化，不改任何数据。
const OVO_SAVE_AUDIT_STORAGE_KEY = 'ovo_save_audit_buffer_v1';
const OVO_SAVE_AUDIT_STORAGE_LEGACY_KEYS = ['ovo-save-audit-buffer-v1'];
const OVO_SAVE_AUDIT_HIGHWATER_KEY = 'ovo_save_audit_highwater_v1';
const OVO_SAVE_AUDIT_MAX = 300;

function _ovoLoadSaveAuditJson(key, fallback, extraKeys = []) {
    try {
        if (typeof localStorage === 'undefined') return fallback;
        const keys = [key, ...(Array.isArray(extraKeys) ? extraKeys : [])];
        for (const k of keys) {
            const raw = localStorage.getItem(k);
            if (!raw) continue;
            const parsed = JSON.parse(raw);
            if (parsed) return parsed;
        }
        return fallback;
    } catch (_) {
        return fallback;
    }
}

function _ovoPrintSaveAuditStartupSummary() {
    try {
        if (typeof window === 'undefined') return;
        const list = Array.isArray(window.__ovoSaveAuditBuffer) ? window.__ovoSaveAuditBuffer : [];
        const highWater = window.__ovoSaveAuditHighWater || {};
        if (!list.length && !Object.keys(highWater).length) return;
        console.log('[SAVE-AUDIT-LOADED]', {
            count: list.length,
            highWaterCount: Object.keys(highWater).length,
            recent: list.slice(-8)
        });
    } catch (_) {}
}

function _ovoPersistSaveAuditState() {
    try {
        if (typeof window === 'undefined' || typeof localStorage === 'undefined') return;
        const buffer = Array.isArray(window.__ovoSaveAuditBuffer) ? window.__ovoSaveAuditBuffer.slice(-OVO_SAVE_AUDIT_MAX) : [];
        localStorage.setItem(OVO_SAVE_AUDIT_STORAGE_KEY, JSON.stringify(buffer));
        localStorage.setItem(OVO_SAVE_AUDIT_HIGHWATER_KEY, JSON.stringify(window.__ovoSaveAuditHighWater || {}));
    } catch (e) {
        // 审计日志不能影响主保存；localStorage 满了就只保留内存日志。
        console.warn('[SAVE-AUDIT-PERSIST-FAILED]', e);
    }
}

function _ovoExposeSaveAuditHelpers() {
    if (typeof window === 'undefined') return;
    window.__ovoDumpSaveAudit = () => JSON.stringify(window.__ovoSaveAuditBuffer || [], null, 2);
    window.__ovoClearSaveAudit = () => {
        window.__ovoSaveAuditBuffer = [];
        window.__ovoSaveAuditHighWater = {};
        try {
            if (typeof localStorage !== 'undefined') {
                localStorage.removeItem(OVO_SAVE_AUDIT_STORAGE_KEY);
                for (const k of OVO_SAVE_AUDIT_STORAGE_LEGACY_KEYS) localStorage.removeItem(k);
                localStorage.removeItem(OVO_SAVE_AUDIT_HIGHWATER_KEY);
            }
        } catch (_) {}
        return '保存审计日志已清空';
    };
}

if (typeof window !== 'undefined') {
    window.__ovoSaveAuditEnabled = window.__ovoSaveAuditEnabled !== false;
    window.__ovoSaveSeq = window.__ovoSaveSeq || 0;
    window.__ovoSaveAuditBuffer = window.__ovoSaveAuditBuffer || _ovoLoadSaveAuditJson(OVO_SAVE_AUDIT_STORAGE_KEY, [], OVO_SAVE_AUDIT_STORAGE_LEGACY_KEYS);
    if (!Array.isArray(window.__ovoSaveAuditBuffer)) window.__ovoSaveAuditBuffer = [];
    if (window.__ovoSaveAuditBuffer.length > OVO_SAVE_AUDIT_MAX) window.__ovoSaveAuditBuffer = window.__ovoSaveAuditBuffer.slice(-OVO_SAVE_AUDIT_MAX);
    window.__ovoSaveAuditHighWater = window.__ovoSaveAuditHighWater || _ovoLoadSaveAuditJson(OVO_SAVE_AUDIT_HIGHWATER_KEY, {});
    _ovoExposeSaveAuditHelpers();
    setTimeout(_ovoPrintSaveAuditStartupSummary, 1000);
}

function _ovoGetSaveAuditStack() {
    try {
        const stack = (new Error()).stack || '';
        return stack
            .split('\n')
            .slice(2, 9)
            .map(line => line.trim())
            .filter(line => line && !line.includes('_ovoBuildSaveAuditPayload') && !line.includes('_ovoBuildFullSaveAuditPayload') && !line.includes('_ovoGetSaveAuditStack'))
            .join(' <- ');
    } catch (_) {
        return '';
    }
}

function _ovoNormalizeSaveReason(reason, fallback) {
    if (typeof reason === 'string' && reason && reason !== fallback) return reason;
    const stack = _ovoGetSaveAuditStack();
    const firstUseful = stack.split(' <- ').find(line => line && !line.includes('saveData') && !line.includes('saveCharacterData') && !line.includes('saveGroupData'));
    return firstUseful ? `${fallback}:${firstUseful}` : (reason || fallback || 'unknown');
}

function _ovoGetLatestMessageMeta(target) {
    const history = target && Array.isArray(target.history) ? target.history : null;
    const last = history && history.length ? history[history.length - 1] : null;
    return {
        historyLength: history ? history.length : null,
        lastMessageId: last && last.id,
        lastMessageRole: last && last.role,
        lastMessageTime: last && last.timestamp,
        lastMessagePreview: last && typeof last.content === 'string' ? last.content.slice(0, 60) : ''
    };
}

function _ovoFindLiveSaveTarget(type, id) {
    try {
        if (!id) return null;
        if (type === 'character') return (db.characters || []).find(c => c && c.id === id) || null;
        if (type === 'group') return (db.groups || []).find(g => g && g.id === id) || null;
    } catch (_) {}
    return null;
}

function _ovoGetActiveChatAuditMeta() {
    try {
        const id = (typeof currentChatId !== 'undefined') ? currentChatId : '';
        const chatType = (typeof currentChatType !== 'undefined') ? currentChatType : '';
        if (!id) return null;
        const target = chatType === 'group'
            ? (db.groups || []).find(g => g && g.id === id)
            : (db.characters || []).find(c => c && c.id === id);
        if (!target) return { id, chatType, missing: true };
        return {
            id,
            chatType: chatType || 'character',
            name: target.remarkName || target.realName || target.name || '',
            ..._ovoGetLatestMessageMeta(target)
        };
    } catch (_) {
        return null;
    }
}

function _ovoCheckSaveAuditStaleness(audit) {
    try {
        if (!audit || !audit.id || !audit.type || (audit.type !== 'character' && audit.type !== 'group')) return null;
        if (typeof window === 'undefined') return null;
        const key = `${audit.type}:${audit.id}`;
        const highWater = window.__ovoSaveAuditHighWater[key];
        const warnings = [];
        if (highWater) {
            if (Number.isFinite(audit.historyLength) && Number.isFinite(highWater.historyLength) && audit.historyLength < highWater.historyLength) {
                warnings.push(`historyLength ${audit.historyLength} < seen ${highWater.historyLength}`);
            }
            if ((Number(audit.lastMessageTime) || 0) < (Number(highWater.lastMessageTime) || 0)) {
                warnings.push(`lastMessageTime ${audit.lastMessageTime || 'empty'} < seen ${highWater.lastMessageTime || 'empty'}`);
            }
        }

        const live = _ovoFindLiveSaveTarget(audit.type, audit.id);
        if (live && live !== audit.__rawTarget) {
            const liveMeta = _ovoGetLatestMessageMeta(live);
            if (Number.isFinite(audit.historyLength) && Number.isFinite(liveMeta.historyLength) && audit.historyLength < liveMeta.historyLength) {
                warnings.push(`saving older object than live db array: ${audit.historyLength} < live ${liveMeta.historyLength}`);
            }
            if ((Number(audit.lastMessageTime) || 0) < (Number(liveMeta.lastMessageTime) || 0)) {
                warnings.push(`saving older lastMessageTime than live db array: ${audit.lastMessageTime || 'empty'} < live ${liveMeta.lastMessageTime || 'empty'}`);
            }
        }

        const nextHighWater = {
            historyLength: Math.max(Number(audit.historyLength) || 0, Number(highWater && highWater.historyLength) || 0),
            lastMessageTime: Math.max(Number(audit.lastMessageTime) || 0, Number(highWater && highWater.lastMessageTime) || 0),
            lastMessageId: audit.lastMessageId || (highWater && highWater.lastMessageId) || '',
            seq: audit.seq,
            at: audit.at
        };
        window.__ovoSaveAuditHighWater[key] = nextHighWater;
        return warnings.length ? warnings : null;
    } catch (e) {
        return [`staleness-check-error: ${e && e.message ? e.message : e}`];
    }
}

function _ovoBuildSaveAuditPayload(type, target, reason) {
    if (typeof window !== 'undefined') {
        window.__ovoSaveSeq = (window.__ovoSaveSeq || 0) + 1;
    }

    const audit = {
        seq: (typeof window !== 'undefined') ? window.__ovoSaveSeq : 0,
        type: type || '',
        reason: _ovoNormalizeSaveReason(reason, type === 'group' ? 'saveGroupData' : 'saveCharacterData'),
        id: target && target.id,
        name: target && (target.remarkName || target.realName || target.name || ''),
        ..._ovoGetLatestMessageMeta(target),
        activeChat: _ovoGetActiveChatAuditMeta(),
        stack: _ovoGetSaveAuditStack(),
        at: new Date().toISOString(),
        __rawTarget: target
    };
    const staleWarnings = _ovoCheckSaveAuditStaleness(audit);
    if (staleWarnings) audit.staleWarnings = staleWarnings;
    return audit;
}

function _ovoStripAuditPayload(payload) {
    if (!payload || typeof payload !== 'object') return payload;
    const copy = { ...payload };
    delete copy.__rawTarget;
    return copy;
}

function _ovoLogSaveAudit(stage, payload, error) {
    try {
        if (typeof window !== 'undefined' && window.__ovoSaveAuditEnabled === false) return;
        const safePayload = _ovoStripAuditPayload(payload);
        if (typeof window !== 'undefined') {
            const item = { stage, payload: safePayload, error: error ? String(error && error.message ? error.message : error) : '', at: new Date().toISOString() };
            if (!Array.isArray(window.__ovoSaveAuditBuffer)) window.__ovoSaveAuditBuffer = [];
            window.__ovoSaveAuditBuffer.push(item);
            if (window.__ovoSaveAuditBuffer.length > OVO_SAVE_AUDIT_MAX) {
                window.__ovoSaveAuditBuffer.splice(0, window.__ovoSaveAuditBuffer.length - OVO_SAVE_AUDIT_MAX);
            }
            _ovoExposeSaveAuditHelpers();
            _ovoPersistSaveAuditState();
        }
        if (payload && payload.staleWarnings && payload.staleWarnings.length) console.warn('[SAVE-STALE-WARN]', safePayload);
        if (error) console.warn(stage, safePayload, error);
        else console.log(stage, safePayload);
    } catch (_) {}
}

function _ovoBuildFullSaveAuditPayload(reason) {
    if (typeof window !== 'undefined') {
        window.__ovoSaveSeq = (window.__ovoSaveSeq || 0) + 1;
    }

    const lastPrivate = (db.characters || [])
        .filter(c => c && Array.isArray(c.history) && c.history.length)
        .map(c => ({ chat: c, last: c.history[c.history.length - 1] }))
        .sort((a, b) => (Number(b.last.timestamp) || 0) - (Number(a.last.timestamp) || 0))[0];

    const lastGroup = (db.groups || [])
        .filter(g => g && Array.isArray(g.history) && g.history.length)
        .map(g => ({ chat: g, last: g.history[g.history.length - 1] }))
        .sort((a, b) => (Number(b.last.timestamp) || 0) - (Number(a.last.timestamp) || 0))[0];

    return {
        seq: (typeof window !== 'undefined') ? window.__ovoSaveSeq : 0,
        type: 'full',
        reason: _ovoNormalizeSaveReason(reason, 'saveData'),
        charactersCount: (db.characters || []).length,
        groupsCount: (db.groups || []).length,
        favoritesCount: (db.favorites || []).length,
        latestPrivate: lastPrivate ? {
            id: lastPrivate.chat.id,
            name: lastPrivate.chat.remarkName || lastPrivate.chat.realName || lastPrivate.chat.name || '',
            historyLength: lastPrivate.chat.history.length,
            lastMessageId: lastPrivate.last.id,
            lastMessageRole: lastPrivate.last.role,
            lastMessageTime: lastPrivate.last.timestamp,
            lastMessagePreview: typeof lastPrivate.last.content === 'string' ? lastPrivate.last.content.slice(0, 60) : ''
        } : null,
        latestGroup: lastGroup ? {
            id: lastGroup.chat.id,
            name: lastGroup.chat.name || '',
            historyLength: lastGroup.chat.history.length,
            lastMessageId: lastGroup.last.id,
            lastMessageRole: lastGroup.last.role,
            lastMessageTime: lastGroup.last.timestamp,
            lastMessagePreview: typeof lastGroup.last.content === 'string' ? lastGroup.last.content.slice(0, 60) : ''
        } : null,
        activeChat: _ovoGetActiveChatAuditMeta(),
        stack: _ovoGetSaveAuditStack(),
        at: new Date().toISOString()
    };
}


// 数据保存与加载
let _ovoDbLoading = false;
let _ovoDbReady = false;
let _ovoDbLastErrorAt = 0;

// 启动保护：loadData/迁移还没结束时，不允许自动保存抢 IndexedDB。
// 用户主动保存如果撞上启动期，等几百毫秒再写，避免 iOS/Safari 刚开库时 Failed to delete record。
async function _ovoWaitForDbReady(maxWaitMs = 2500) {
    const start = Date.now();
    while (_ovoDbLoading && Date.now() - start < maxWaitMs) {
        await new Promise(resolve => setTimeout(resolve, 120));
    }
    return !_ovoDbLoading;
}

const saveData = async (reason = 'saveData') => {
    const audit = _ovoBuildFullSaveAuditPayload(reason);
    _ovoLogSaveAudit('[SAVE-DATA-BEFORE]', audit);

    const emergencySnapshotResult = await _ovoWriteGlobalEmergencySnapshot('saveData');
    await _ovoWaitForDbReady();

    // WOW v55.9.17：不再把所有表塞进一个超大 IndexedDB transaction。
    // iOS/Safari 上超大事务容易超时/中止，导致整轮保存回滚到上次成功点。
    // 这里改成按表、按记录顺序写入多个小事务：慢一点，但不容易被一个大事务整批回滚。
    try {
        for (const character of (db.characters || [])) {
            if (character && character.id) await dexieDB.characters.put(character);
        }
        for (const group of (db.groups || [])) {
            if (group && group.id) await dexieDB.groups.put(group);
        }
        for (const worldBook of (db.worldBooks || [])) {
            if (worldBook && worldBook.id) await dexieDB.worldBooks.put(worldBook);
        }
        for (const sticker of (db.myStickers || [])) {
            if (sticker && sticker.id) await dexieDB.myStickers.put(sticker);
        }
        if (dexieDB.archives) {
            for (const archive of (db.archives || [])) {
                if (archive && archive.id) await dexieDB.archives.put(archive);
            }
        }

        for (const key of globalSettingKeys) {
            if (db[key] !== undefined) {
                await dexieDB.globalSettings.put({ key: key, value: db[key] });
            }
        }

        _ovoMarkGlobalSnapshotConfirmed(emergencySnapshotResult);
        _ovoWarnSnapshotFailedButMainSaveSucceeded(emergencySnapshotResult);
        _ovoLogSaveAudit('[SAVE-DATA-AFTER]', audit);
    } catch (e) {
        _ovoDbLastErrorAt = Date.now();
        console.error('[OVO保存] 分步保存失败:', e);
        _ovoLogSaveAudit('[SAVE-DATA-FAILED]', audit, e);
        _ovoShowMainSaveFailureModal(emergencySnapshotResult, e);
        throw e;
    }
};


// 局部保存：设置页/预设页只改 globalSettings 时，不再触发全库逐条写入。
// 这能避开“点保存设置 = characters/groups/worldBooks/stickers/archives 全扫一遍”的卡顿。
const saveGlobalSettings = async (keys) => {
    const emergencySnapshotResult = await _ovoWriteGlobalEmergencySnapshot('saveGlobalSettings');
    await _ovoWaitForDbReady();
    const list = Array.isArray(keys) ? keys : [keys];
    const validKeys = [...new Set(list)].filter(key => globalSettingKeys.includes(key) && db[key] !== undefined);
    if (!validKeys.length) return;
    try {
        await dexieDB.transaction('rw', dexieDB.globalSettings, async () => {
            for (const key of validKeys) {
                await dexieDB.globalSettings.put({ key: key, value: db[key] });
            }
        });
        _ovoMarkGlobalSnapshotConfirmed(emergencySnapshotResult);
        _ovoWarnSnapshotFailedButMainSaveSucceeded(emergencySnapshotResult);
    } catch (e) {
        _ovoDbLastErrorAt = Date.now();
        console.error('[OVO保存] 局部设置保存失败:', e);
        _ovoShowMainSaveFailureModal(emergencySnapshotResult, e);
        throw e;
    }
};

const saveGlobalSetting = async (key) => saveGlobalSettings([key]);

// 防止用户连续点保存时堆出多条全量保存任务。局部保存仍建议优先使用 saveGlobalSetting(s)。
let _ovoSaveDataQueue = Promise.resolve();
const saveDataQueued = async () => {
    const run = () => saveData();
    _ovoSaveDataQueue = _ovoSaveDataQueue.then(run, run);
    return _ovoSaveDataQueue;
};


const saveCharacterData = async (characterOrId, reason = 'saveCharacterData') => {
    const character = (typeof characterOrId === 'string')
        ? (db.characters || []).find(c => c && c.id === characterOrId)
        : characterOrId;
    if (!character || !character.id) return;

    const audit = _ovoBuildSaveAuditPayload('character', character, reason);
    _ovoLogSaveAudit('[SAVE-CHAR-BEFORE]', audit);

    const emergencySnapshotResult = await _ovoWriteGlobalEmergencySnapshot('saveCharacterData');
    await _ovoWaitForDbReady();
    try {
        await dexieDB.characters.put(character);
        _ovoMarkGlobalSnapshotConfirmed(emergencySnapshotResult);
        _ovoWarnSnapshotFailedButMainSaveSucceeded(emergencySnapshotResult);
        _ovoLogSaveAudit('[SAVE-CHAR-AFTER]', audit);
    } catch (e) {
        console.warn('[OVO保存] 角色保存失败，200ms 后重试:', e);
        _ovoLogSaveAudit('[SAVE-CHAR-RETRY]', audit, e);
        await new Promise(r => setTimeout(r, 200));
        try {
            await dexieDB.characters.put(character);
            _ovoMarkGlobalSnapshotConfirmed(emergencySnapshotResult);
            _ovoWarnSnapshotFailedButMainSaveSucceeded(emergencySnapshotResult);
            _ovoLogSaveAudit('[SAVE-CHAR-AFTER-RETRY]', audit);
        } catch (e2) {
            _ovoDbLastErrorAt = Date.now();
            console.error('[OVO保存] 角色局部保存失败（重试后）:', e2);
            _ovoLogSaveAudit('[SAVE-CHAR-FAILED]', audit, e2);
            _ovoShowMainSaveFailureModal(emergencySnapshotResult, e2);
            throw e2;
        }
    }
};

const saveGroupData = async (groupOrId, reason = 'saveGroupData') => {
    const group = (typeof groupOrId === 'string')
        ? (db.groups || []).find(g => g && g.id === groupOrId)
        : groupOrId;
    if (!group || !group.id) return;

    const audit = _ovoBuildSaveAuditPayload('group', group, reason);
    _ovoLogSaveAudit('[SAVE-GROUP-BEFORE]', audit);

    const emergencySnapshotResult = await _ovoWriteGlobalEmergencySnapshot('saveGroupData');
    await _ovoWaitForDbReady();
    try {
        await dexieDB.groups.put(group);
        _ovoMarkGlobalSnapshotConfirmed(emergencySnapshotResult);
        _ovoWarnSnapshotFailedButMainSaveSucceeded(emergencySnapshotResult);
        _ovoLogSaveAudit('[SAVE-GROUP-AFTER]', audit);
    } catch (e) {
        console.warn('[OVO保存] 群聊保存失败，200ms 后重试:', e);
        _ovoLogSaveAudit('[SAVE-GROUP-RETRY]', audit, e);
        await new Promise(r => setTimeout(r, 200));
        try {
            await dexieDB.groups.put(group);
            _ovoMarkGlobalSnapshotConfirmed(emergencySnapshotResult);
            _ovoWarnSnapshotFailedButMainSaveSucceeded(emergencySnapshotResult);
            _ovoLogSaveAudit('[SAVE-GROUP-AFTER-RETRY]', audit);
        } catch (e2) {
            _ovoDbLastErrorAt = Date.now();
            console.error('[OVO保存] 群聊局部保存失败（重试后）:', e2);
            _ovoLogSaveAudit('[SAVE-GROUP-FAILED]', audit, e2);
            _ovoShowMainSaveFailureModal(emergencySnapshotResult, e2);
            throw e2;
        }
    }
};

if (typeof window !== 'undefined') {
    window.saveGlobalSetting = saveGlobalSetting;
    window.saveGlobalSettings = saveGlobalSettings;
    window.saveDataQueued = saveDataQueued;
    window.saveCharacterData = saveCharacterData;
    window.saveGroupData = saveGroupData;
}

const loadData = async () => {
    _ovoDbLoading = true;
    try {
    const tables = [
        dexieDB.characters.toArray(),
        dexieDB.groups.toArray(),
        dexieDB.worldBooks.toArray(),
        dexieDB.myStickers.toArray(),
        dexieDB.globalSettings.toArray()
    ];
    if (dexieDB.archives) tables.push(dexieDB.archives.toArray());
    const results = await Promise.all(tables);
    const characters = results[0];
    const groups = results[1];
    const worldBooks = results[2];
    const myStickers = results[3];
    const settingsArray = results[4];
    const archives = results[5];

    db.characters = characters;
    db.groups = groups;
    db.worldBooks = worldBooks;
    db.myStickers = myStickers;
    db.archives = archives || [];

    const settings = settingsArray.reduce((acc, { key, value }) => {
        acc[key] = value;
        return acc;
    }, {});

    globalSettingKeys.forEach(key => {
        const defaultValue = {
            apiSettings: {},
            summaryApiSettings: {},
            backgroundApiSettings: {},
            supplementPersonaApiSettings: {},
            peekApiSettings: {},
            wallpaper: 'https://i.postimg.cc/W4Z9R9x4/ins-1.jpg',
            homeScreenMode: 'night',
            fontUrl: '',
            localFontName: '',
            customIcons: {},
            customAppNames: {},
            apiPresets: [],
            summaryApiPresets: [],
            backgroundApiPresets: [],
            supplementPersonaApiPresets: [],
            peekApiPresets: [],
            bubbleCssPresets: [],
            myPersonaPresets: [],
            fontPresets: [],
            globalCss: '',
            globalCssPresets: [],
            homeSignature: '编辑个性签名...',
            forumPosts: [],
            forumBindings: { worldBookIds: [], charIds: [], userPersonaIds: [] },
            forumUserProfile: { username: '', avatar: 'https://i.postimg.cc/GtbTnxhP/o-o-1.jpg', bio: '', joinDate: 0 },
            forumSettings: { postsPerGeneration: 8, commentsPerPost: { min: 4, max: 8 }, generateDetailedStranger: false },
            forumApiSettings: { useForumApi: false, url: '', key: '', model: '', temperature: 0.9 },
            forumMessages: [],
            forumStrangerProfiles: {},
            forumFriendRequests: [],
            forumPendingRequestFromUser: {},
            pomodoroTasks: [],
            pomodoroSettings: { boundCharId: null, userPersona: '', focusBackground: '', taskCardBackground: '', encouragementMinutes: 25, pokeLimit: 5, globalWorldBookIds: [] },
            insWidgetSettings: { avatar1: 'https://i.postimg.cc/Y96LPskq/o-o-2.jpg', bubble1: 'love u.', avatar2: 'https://i.postimg.cc/GtbTnxhP/o-o-1.jpg', bubble2: 'miss u.' },
            homeWidgetSettings: defaultWidgetSettings,
            activePersonaId: null,
            moreProfileCardBg: 'https://i.postimg.cc/XvFDdTKY/Smart-Select-20251013-023208.jpg',
            globalSendSound: '',
            globalReceiveSound: '',
            globalMessageSentSound: '',
            globalIncomingCallSound: '',
            multiMsgSoundEnabled: false,
            soundPresets: [],
            galleryPresets: [],
            iconPresets: [],
            homeWidgetPresets: [],
            widgetWallpaperPresets: [],
            cotSettings: { enabled: false, activePresetId: 'default' },
            cotPresets: JSON.parse(JSON.stringify(DEFAULT_COT_PRESETS)),
            hasSeenVideoCallDisclaimer: false,
            hasSeenVideoCallAvatarHint: false,
            favorites: [],
            piggyBank: { balance: 520, transactions: [], familyCards: [], receivedFamilyCards: [] },
            theaterScenarios: [],
            theaterPromptPresets: [],
            theaterHtmlScenarios: [],
            theaterHtmlPromptPresets: [],
            theaterMode: 'text',
            theaterApiSettings: { useTheaterApi: false, url: '', key: '', model: '' },
            theaterFontSize: 15,
            theaterFontPreset: null,
            avatarRecognitionDetailLevel: 'detailed',
            gptImageSettings: { enabled: false, apiKey: '', endpointMode: 'official', customEndpoint: '', model: 'gpt-image-1', size: '1024x1024', quality: 'auto', positivePrompt: '', negativePrompt: '' },
            imageGenerationProvider: 'novelai'
        };
        db[key] = settings[key] !== undefined ? settings[key] : (defaultValue[key] !== undefined ? JSON.parse(JSON.stringify(defaultValue[key])) : undefined);
    });

    if (!db.piggyBank) db.piggyBank = { balance: 520, transactions: [], familyCards: [], receivedFamilyCards: [] };
    if (typeof db.piggyBank.balance !== 'number') db.piggyBank.balance = 520;
    if (!Array.isArray(db.piggyBank.transactions)) db.piggyBank.transactions = [];
    if (!Array.isArray(db.piggyBank.familyCards)) db.piggyBank.familyCards = [];
    if (!Array.isArray(db.piggyBank.receivedFamilyCards)) db.piggyBank.receivedFamilyCards = [];
    if (!db.forumStrangerProfiles || typeof db.forumStrangerProfiles !== 'object') db.forumStrangerProfiles = {};
    if (!Array.isArray(db.forumFriendRequests)) db.forumFriendRequests = [];
    if (!db.forumPendingRequestFromUser || typeof db.forumPendingRequestFromUser !== 'object') db.forumPendingRequestFromUser = {};
    if (db.forumSettings && db.forumSettings.generateDetailedStranger === undefined) db.forumSettings.generateDetailedStranger = false;
    if (db.forumSettings && db.forumSettings.enableCharAltDm === undefined) db.forumSettings.enableCharAltDm = false;
    if (db.forumSettings && !Array.isArray(db.forumSettings.charAltCharIds)) db.forumSettings.charAltCharIds = [];
    if (db.forumSettings && db.forumSettings.charAltProbability === undefined) db.forumSettings.charAltProbability = 25;
    if (db.forumSettings && (db.forumSettings.charAltNames === undefined || typeof db.forumSettings.charAltNames !== 'object')) db.forumSettings.charAltNames = {};

    // Data integrity checks
    db.characters.forEach(c => {
        if (!c.peekData) c.peekData = {}; 
        if (c.isPinned === undefined) c.isPinned = false;
        if (c.status === undefined) c.status = '在线';
        if (!c.worldBookIds) c.worldBookIds = [];
        if (c.customBubbleCss === undefined) c.customBubbleCss = '';
        if (c.useCustomBubbleCss === undefined) c.useCustomBubbleCss = false;
        if (c.allowCharSwitchBubbleCss === undefined) c.allowCharSwitchBubbleCss = false;
        if (!Array.isArray(c.bubbleCssThemeBindings)) c.bubbleCssThemeBindings = [];
        if (c.currentBubbleCssPresetName === undefined) c.currentBubbleCssPresetName = '';
        if (c.themeJustChangedByUser === undefined) c.themeJustChangedByUser = '';
        if (c.showTimestamp === undefined) c.showTimestamp = false;
        if (c.timestampPosition === undefined) c.timestampPosition = 'below_avatar';
        if (!c.statusPanel) {
            c.statusPanel = {
                enabled: false,
                promptSuffix: '',
                regexPattern: '',
                replacePattern: '',
                historyLimit: 3,
                currentStatusRaw: '',
                currentStatusHtml: '',
                history: []
            };
        }
        if (!c.regexFilter) {
            c.regexFilter = {
                enabled: false,
                rules: []
            };
        }
        if (!c.autoReply) {
            c.autoReply = {
                enabled: false,
                interval: 60,
                lastTriggerTime: 0
            };
        }
        if (!c.gallery) c.gallery = [];
        if (c.useRealGallery === undefined) c.useRealGallery = false;
        if (!c.callHistory) c.callHistory = [];
        if (!c.userAvatarLibrary || !Array.isArray(c.userAvatarLibrary)) c.userAvatarLibrary = [];
        if (!c.charAvatarLibrary || !Array.isArray(c.charAvatarLibrary)) c.charAvatarLibrary = [];
        // 拉黑与好友申请
        if (c.isBlocked === undefined) c.isBlocked = false;
        if (!c.blockHistory || !Array.isArray(c.blockHistory)) c.blockHistory = [];
        if (!c.friendRequests || !Array.isArray(c.friendRequests)) c.friendRequests = [];
        if (!c.blockReapply || typeof c.blockReapply !== 'object') {
            c.blockReapply = { mode: 'fixed', fixedInterval: 30, lastRequestTime: null, nextCheckTime: null, pendingRequestId: null };
        }
        // 角色拉黑用户（角色主动拉黑）
        if (c.canBlockUser === undefined) c.canBlockUser = true;
        // 角色掌控模式：允许角色查看并操控用户手机
        if (c.characterRemarkAwareEnabled === undefined) c.characterRemarkAwareEnabled = false;
        if (c.myNickname === undefined) c.myNickname = '';
        if (c.characterCanChangeUserNickname === undefined) c.characterCanChangeUserNickname = false;
        if (c.musicControlEnabled === undefined) c.musicControlEnabled = false;
        if (c.pendingUserNicknameChange === undefined) delete c.pendingUserNicknameChange;
        if (c.pendingMusicControlEvent === undefined) delete c.pendingMusicControlEvent;
        if (c.characterFavoriteAwareEnabled === undefined) c.characterFavoriteAwareEnabled = false;
        if (c.characterUserFavoriteAwareEnabled === undefined) c.characterUserFavoriteAwareEnabled = false;
        if (c.characterPeriodAwareEnabled === undefined) c.characterPeriodAwareEnabled = false;
        if (c.favoriteMemoryOwnEnabled === undefined) c.favoriteMemoryOwnEnabled = false;
        if (c.favoriteMemoryAllCharacterEnabled === undefined) c.favoriteMemoryAllCharacterEnabled = false;
        if (c.favoriteMemoryUserOwnEnabled === undefined) c.favoriteMemoryUserOwnEnabled = false;
        if (c.favoriteMemoryUserAllEnabled === undefined) c.favoriteMemoryUserAllEnabled = false;
        if (c.favoriteMemoryLimit === undefined) c.favoriteMemoryLimit = 0;
        if (c.selfToggleSettingsEnabled === undefined) c.selfToggleSettingsEnabled = false;
        if (!Array.isArray(c.pendingSettingControlEvents)) c.pendingSettingControlEvents = [];
        if (c.phoneControlEnabled === undefined) c.phoneControlEnabled = false;
        if (c.phoneControlViewLimit === undefined) c.phoneControlViewLimit = 10;
        if (!Array.isArray(c.phoneControlHistory)) c.phoneControlHistory = [];
        if (c.familyCardEnabled === undefined) c.familyCardEnabled = false;
        if (c.isBlockedByChar === undefined) c.isBlockedByChar = false;
        if (c.blockedByCharAt === undefined) c.blockedByCharAt = null;
        if (c.blockedByCharReason === undefined) c.blockedByCharReason = '';
        if (!c.charBlockHistory || !Array.isArray(c.charBlockHistory)) c.charBlockHistory = [];
        if (!c.userFriendRequests || !Array.isArray(c.userFriendRequests)) c.userFriendRequests = [];
        // 用户头像库迁移：旧数据只有 name（实为描述），拆分为 name（简短名称）+ description（描述）
        c.userAvatarLibrary.forEach(function (item) {
            if (item.description === undefined && item.name) {
                item.description = item.name;
                item.name = item.name.length > 12 ? item.name.slice(0, 12) + '…' : item.name;
            }
            if (item.name === undefined) item.name = (item.description && item.description.length > 12) ? item.description.slice(0, 12) + '…' : (item.description || '未命名');
        });
    });
    if (db.userAvatarLibrary && Array.isArray(db.userAvatarLibrary) && db.userAvatarLibrary.length > 0) {
        db.characters.forEach(c => {
            if (!c.userAvatarLibrary) c.userAvatarLibrary = [];
            c.userAvatarLibrary.push(...db.userAvatarLibrary);
        });
        delete db.userAvatarLibrary;
        // 启动期先不立刻保存，避免 loadData 内部抢写库；初始化完成后再由用户操作/后续保存落盘。
    }
    db.groups.forEach(g => {
        if (g.isPinned === undefined) g.isPinned = false;
        if (!g.worldBookIds) g.worldBookIds = [];
        if (g.customBubbleCss === undefined) g.customBubbleCss = '';
        if (g.useCustomBubbleCss === undefined) g.useCustomBubbleCss = false;
        if (g.showTimestamp === undefined) g.showTimestamp = false;
        if (g.timestampPosition === undefined) g.timestampPosition = 'below_avatar';
        if (!g.callHistory) g.callHistory = [];
    });
    
    // Handle old localStorage data if it exists.
    // v51.2 防回退保护：旧 localStorage 只允许在 IndexedDB 为空时迁移。
    // 迁移完成或跳过后，不直接删除唯一副本，而是移动到固定备份键。
    // 固定备份键每次覆盖旧备份，只保留最新一份，避免 localStorage 无限膨胀。
    const oldLocalStorageData = localStorage.getItem('gemini-chat-app-db');
    const oldLocalStorageBackupKey = 'gemini-chat-app-db-backup-before-migration';
    const oldLocalStorageBackupTimeKey = 'gemini-chat-app-db-backup-time';

    const backupAndRemoveOldLocalStorageData = () => {
        try {
            localStorage.setItem(oldLocalStorageBackupKey, oldLocalStorageData);
            localStorage.setItem(oldLocalStorageBackupTimeKey, new Date().toISOString());
            localStorage.removeItem('gemini-chat-app-db');
            console.log("Old localStorage data moved to fixed backup key:", oldLocalStorageBackupKey);
        } catch (backupError) {
            console.error("Failed to back up old localStorage data. Keeping original key untouched for safety.", backupError);
        }
    };

    if (oldLocalStorageData) {
        console.log("Found old localStorage data, checking whether migration is needed...");
        try {
            const existingCharacterCount = await dexieDB.characters.count();
            const existingGroupCount = await dexieDB.groups.count();

            if (existingCharacterCount === 0 && existingGroupCount === 0) {
                console.log("IndexedDB is empty, migrating old localStorage data...");
                const data = JSON.parse(oldLocalStorageData);

                await dexieDB.transaction('rw', dexieDB.tables, async () => {
                    if (Array.isArray(data.characters)) {
                        for (const character of data.characters) {
                            if (character && character.id) {
                                await dexieDB.characters.put(character);
                            }
                        }
                    }

                    if (Array.isArray(data.groups)) {
                        for (const group of data.groups) {
                            if (group && group.id) {
                                await dexieDB.groups.put(group);
                            }
                        }
                    }
                });

                backupAndRemoveOldLocalStorageData();
                await loadData();
                console.log("Old localStorage migration complete. Old data kept in fixed backup key.");
            } else {
                console.warn("IndexedDB already has data. Skipping old localStorage migration to avoid rollback.");
                backupAndRemoveOldLocalStorageData();
            }
        } catch (e) {
            console.error("Old localStorage migration check failed. Keeping old localStorage data untouched for safety.", e);
        }
    }
    _ovoDbReady = true;
    _ovoCheckGlobalEmergencySnapshotAfterLoad();
    } catch (e) {
        _ovoDbLastErrorAt = Date.now();
        console.error('[OVO加载] 数据库加载失败:', e);
        throw e;
    } finally {
        _ovoDbLoading = false;
    }

};

// 存储分析工具
const dataStorage = {
    getStorageInfo: async function() {
        const stringify = (obj) => {
            try {
                return JSON.stringify(obj).length;
            } catch (e) {
                console.warn("Could not stringify object for size calculation:", obj, e);
                return 0;
            }
        };

        let categorizedSizes = {
            messages: 0,
            charactersAndGroups: 0,
            worldAndForum: 0,
            personalization: 0,
            apiAndCore: 0,
            other: 0
        };

        if (!db || !db.characters) {
            await loadData();
        }

        // 1. Messages (History)
        (db.characters || []).forEach(char => {
            categorizedSizes.messages += stringify(char.history);
        });
        (db.groups || []).forEach(group => {
            categorizedSizes.messages += stringify(group.history);
        });

        // 2. Characters and Groups (metadata)
        (db.characters || []).forEach(char => {
            const charWithoutHistory = { ...char, history: undefined };
            categorizedSizes.charactersAndGroups += stringify(charWithoutHistory);
        });
        (db.groups || []).forEach(group => {
            const groupWithoutHistory = { ...group, history: undefined };
            categorizedSizes.charactersAndGroups += stringify(groupWithoutHistory);
        });

        // 3. World and Forum
        categorizedSizes.worldAndForum += stringify(db.worldBooks);
        categorizedSizes.worldAndForum += stringify(db.forumPosts);
        categorizedSizes.worldAndForum += stringify(db.forumBindings);

        // 4. Personalization
        categorizedSizes.personalization += stringify(db.myStickers);
        categorizedSizes.personalization += stringify(db.wallpaper);
        categorizedSizes.personalization += stringify(db.homeScreenMode);
        categorizedSizes.personalization += stringify(db.fontUrl);
        categorizedSizes.personalization += stringify(db.localFontName);
        categorizedSizes.personalization += stringify(db.customIcons);
        categorizedSizes.personalization += stringify(db.bubbleCssPresets);
        categorizedSizes.personalization += stringify(db.myPersonaPresets);
        categorizedSizes.personalization += stringify(db.globalCss);
        categorizedSizes.personalization += stringify(db.globalCssPresets);
        categorizedSizes.personalization += stringify(db.homeSignature);
        categorizedSizes.personalization += stringify(db.pomodoroTasks);
        categorizedSizes.personalization += stringify(db.pomodoroSettings);
        categorizedSizes.personalization += stringify(db.insWidgetSettings);
        categorizedSizes.personalization += stringify(db.homeWidgetSettings);
        categorizedSizes.personalization += stringify(db.moreProfileCardBg);
        categorizedSizes.personalization += stringify(db.soundPresets);
        categorizedSizes.personalization += stringify(db.iconPresets);

        // 5. API and Core
        categorizedSizes.apiAndCore += stringify(db.apiSettings);
        categorizedSizes.apiAndCore += stringify(db.apiPresets);
        categorizedSizes.apiAndCore += stringify(db.cotSettings);
        categorizedSizes.apiAndCore += stringify(db.cotPresets);

        const totalSize = Object.values(categorizedSizes).reduce((sum, size) => sum + size, 0);

        return {
            totalSize,
            categorizedSizes
        };
    }
};
