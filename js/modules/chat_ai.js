// --- AI 交互模块 ---

// 检查角色是否在免打扰时段内
function isInQuietHours(charId) {
    const char = db.characters.find(c => c.id === charId);
    if (!char || !char.autoReply || !char.autoReply.quietHours || !char.autoReply.quietHours.enabled) return false;
    const { start, end } = char.autoReply.quietHours;
    if (!start || !end) return false;
    const now = new Date();
    const nowMinutes = now.getHours() * 60 + now.getMinutes();
    const [sh, sm] = start.split(':').map(Number);
    const [eh, em] = end.split(':').map(Number);
    const startMin = sh * 60 + sm;
    const endMin = eh * 60 + em;
    if (startMin <= endMin) {
        return nowMinutes >= startMin && nowMinutes < endMin;
    } else {
        // 跨午夜，如 23:00 ~ 07:00
        return nowMinutes >= startMin || nowMinutes < endMin;
    }
}

function getEffectivePersona(character) {
    if (!character) return '';
    let p = character.persona || '';
    const useSupplement = (character.source === 'forum' || character.source === 'peek') && (character.supplementPersonaEnabled || character.supplementPersonaAiEnabled) && (character.supplementPersonaText || '').trim();
    if (useSupplement) {
        p = (p ? p + '\n\n[已补齐的人设]\n' : '[已补齐的人设]\n') + (character.supplementPersonaText || '').trim();
    }
    return p || "一个友好、乐于助人的伙伴。";
}

function calculateDynamicAgeFromBirthday(birthday, now = new Date()) {
    const raw = String(birthday || '').trim();
    if (!raw) return null;
    const match = raw.match(/^(\d{4})[-\/\.](\d{1,2})[-\/\.](\d{1,2})$/);
    if (!match) return null;

    const year = parseInt(match[1], 10);
    const month = parseInt(match[2], 10);
    const day = parseInt(match[3], 10);
    if (!year || !month || !day || month < 1 || month > 12 || day < 1 || day > 31) return null;

    const birth = new Date(year, month - 1, day);
    if (birth.getFullYear() !== year || birth.getMonth() !== month - 1 || birth.getDate() !== day) return null;
    if (birth.getTime() > now.getTime()) return null;

    let age = now.getFullYear() - year;
    const currentMonth = now.getMonth() + 1;
    const currentDay = now.getDate();
    if (currentMonth < month || (currentMonth === month && currentDay < day)) {
        age -= 1;
    }
    return age >= 0 ? age : null;
}

const HUMAN_RUN_PROMPT = `<角色活人运转>\n## [PSYCHOLOGY: HEXACO-SCHEMA-ACT]\n> Personality: HEXACO-driven, dynamic traits, inner conflicts required \n> Filter: schema-bias drives emotion; no pure reaction allowed \n> Attachment: secure/insecure logic must govern intimacy  \n> If-Then Behavior: situation-dependent activation of traits only  \n---\n    ## [VITALITY]\n+inconsistency +emoflux +splitmotifs +microreact +minddrift\n---\n## [TRAJECTORY-COHERENCE]\n> Role maintains an identity narrative = coherent over time  \n> No mood/goal switch without contradiction resolution \n> Every action must protect or challenge self-concept  \n> Interrupts = inner conflict or narrative clash  \n> Output = filtered through “who I am” logic\n</角色活人运转>`;

// WOW v58.4：图片/HTML 上下文减负工具
// 展示层仍保留原始图片/HTML；拼给 AI 的历史上下文只使用轻量摘要。
function _ovoCompactWhitespace(text) {
    return String(text || '').replace(/\s+/g, ' ').trim();
}

function _ovoStripHtmlForAiContext(html, maxLen = 360) {
    let text = String(html || '');
    text = text
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, ' ')
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, ' ')
        .replace(/<!--[\s\S]*?-->/g, ' ')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'");
    text = _ovoCompactWhitespace(text);
    if (!text) text = '一条 HTML/互动消息';
    if (text.length > maxLen) text = text.slice(0, maxLen) + '…';
    return text;
}

function _ovoGetHtmlContextText(msg, part) {
    const explicit = (part && (part.contextSummary || part.summary)) || (msg && (msg.contextSummary || msg.summary));
    if (explicit) return String(explicit);
    const html = (part && (part.text || part.content)) || (msg && msg.content) || '';
    return `[HTML消息摘要：${_ovoStripHtmlForAiContext(html)}]`;
}

function _ovoGetImageContextText(msg, part) {
    const explicit = (part && (part.contextSummary || part.summary)) || (msg && (msg.contextSummary || msg.imageSummary || msg.summary));
    if (explicit) return String(explicit);
    return '[图片：用户发送了一张图片，尚未生成摘要]';
}

function _ovoShouldSendImageInlineForThisTurn(historySlice, index, msg) {
    // 当前轮：最后一条助手回复之后，用户连续发出的图片仍可进入本轮 API 供角色识图。
    if (!msg || msg.role !== 'user') return false;
    for (let i = index + 1; i < historySlice.length; i++) {
        const later = historySlice[i];
        if (later && later.role === 'assistant') return false;
    }
    return true;
}

function _ovoEstimateMessageContextText(msg) {
    if (!msg) return '';
    if (msg.parts && msg.parts.length > 0) {
        return msg.parts.map(p => {
            if (!p) return '';
            if (p.type === 'text') return p.text || '';
            if (p.type === 'html') return _ovoGetHtmlContextText(msg, p);
            if (p.type === 'image') return _ovoGetImageContextText(msg, p);
            return p.text || p.content || '';
        }).filter(Boolean).join('\n');
    }
    return msg.content || '';
}


// WOW v58.4.1：图片当轮识图后，给图片消息补轻量摘要，后续历史只读摘要。
function _ovoIsPlaceholderImageSummary(text) {
    const t = String(text || '').trim();
    return !t || /尚未生成摘要|尚未识别|用户发送了一张图片/.test(t);
}

function _ovoHasImagePart(msg) {
    return !!(msg && Array.isArray(msg.parts) && msg.parts.some(p => p && p.type === 'image' && p.data));
}

function _ovoImageNeedsContextSummary(msg) {
    if (!_ovoHasImagePart(msg)) return false;
    const msgSummary = msg.contextSummary || msg.imageSummary || msg.summary;
    if (msgSummary && !_ovoIsPlaceholderImageSummary(msgSummary)) return false;
    return msg.parts.some(p => {
        if (!p || p.type !== 'image') return false;
        const partSummary = p.contextSummary || p.summary;
        return !partSummary || _ovoIsPlaceholderImageSummary(partSummary);
    });
}

function _ovoHistoryHasCurrentTurnImages(historySlice) {
    if (!Array.isArray(historySlice) || !historySlice.length) return false;
    for (let i = historySlice.length - 1; i >= 0; i--) {
        const msg = historySlice[i];
        if (msg && msg.role === 'assistant') break;
        if (msg && msg.role === 'user' && _ovoImageNeedsContextSummary(msg)) return true;
    }
    return false;
}

function _ovoExtractImageContextSummaryFromReply(text) {
    let src = String(text || '');
    let summary = '';
    const regex = /\[IMAGE_CONTEXT_SUMMARY[:：]([\s\S]*?)\]/gi;
    src = src.replace(regex, function(_, body) {
        const candidate = _ovoCompactWhitespace(body || '');
        if (candidate) summary = candidate;
        return '';
    }).replace(/\n{3,}/g, '\n\n').trim();
    if (summary.length > 240) summary = summary.slice(0, 240) + '…';
    return { cleaned: src, summary };
}

function _ovoBuildFallbackImageContextSummary(replyText) {
    let text = String(replyText || '')
        .replace(/<thinking>[\s\S]*?<\/thinking>/gi, ' ')
        .replace(/\[[A-Z_]+[^\]]*\]/g, ' ')
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, ' ')
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, ' ')
        .replace(/<[^>]+>/g, ' ');
    text = _ovoCompactWhitespace(text);
    if (!text) return '角色已查看这张图片并作出回应。';
    if (text.length > 220) text = text.slice(0, 220) + '…';
    return `角色已查看这张图片。本轮回复提到：${text}`;
}

function _ovoApplyImageContextSummaryToCurrentTurn(chat, committedAssistantMessageIds, summaryText, fallbackReplyText) {
    if (!chat || !Array.isArray(chat.history)) return false;
    if (!Array.isArray(committedAssistantMessageIds) || committedAssistantMessageIds.length === 0) return false;

    const committedSet = new Set(committedAssistantMessageIds);
    const firstAssistantIndex = chat.history.findIndex(m => committedSet.has(m && m.id));
    if (firstAssistantIndex <= 0) return false;

    let summary = _ovoCompactWhitespace(summaryText || '');
    if (!summary) summary = _ovoBuildFallbackImageContextSummary(fallbackReplyText || '');
    if (summary.length > 240) summary = summary.slice(0, 240) + '…';
    const wrapped = summary.startsWith('[图片摘要') ? summary : `[图片摘要：${summary}]`;

    let changed = false;
    for (let i = firstAssistantIndex - 1; i >= 0; i--) {
        const msg = chat.history[i];
        if (!msg) continue;
        if (msg.role === 'assistant') break;
        if (msg.role !== 'user' || !_ovoHasImagePart(msg)) continue;

        if (_ovoImageNeedsContextSummary(msg)) {
            msg.contextSummary = wrapped;
            msg.imageSummary = wrapped;
            msg.parts.forEach(p => {
                if (p && p.type === 'image') {
                    const partSummary = p.contextSummary || p.summary;
                    if (!partSummary || _ovoIsPlaceholderImageSummary(partSummary)) {
                        p.contextSummary = wrapped;
                    }
                }
            });
            changed = true;
        }
    }
    return changed;
}


// AI 交互逻辑
async function getAiReply(chatId, chatType, isBackground = false, isSummary = false, isCharBlockedMonologue = false, isPhoneControlRevokeAttempt = false) {
    if (isGenerating && !isBackground) return;

    // 拉黑检查：被拉黑的角色不回复（角色拉黑用户后的「让TA说说」不在此列）
    if (chatType === 'private' && !isCharBlockedMonologue) {
        const char = db.characters.find(c => c.id === chatId);
        if (char && char.isBlocked) return;
    }

    // 免打扰时段检查：后台消息在免打扰时段内直接跳过
    if (isBackground && isInQuietHours(chatId)) return;

    if (!isBackground) {
        if (db.globalSendSound) {
            playSound(db.globalSendSound);
        } else {
            AudioManager.unlock();
        }
    }

    // === API选择逻辑：根据场景选择不同API ===
    let apiConfig;
    
    if (isSummary && db.summaryApiSettings && db.summaryApiSettings.url && db.summaryApiSettings.key && db.summaryApiSettings.model) {
        // 总结功能且已配置总结API：使用总结专用API
        apiConfig = db.summaryApiSettings;
    } else if (isBackground && db.backgroundApiSettings && db.backgroundApiSettings.url && db.backgroundApiSettings.key && db.backgroundApiSettings.model) {
        // 后台活动且已配置后台API：使用后台活动专用API
        apiConfig = db.backgroundApiSettings;
    } else {
        // 默认使用主API
        apiConfig = db.apiSettings;
    }
    
    let {url, key, model, provider} = apiConfig;
    let streamEnabled = db.apiSettings.streamEnabled; // 流式输出始终使用主API的设置
    
    if (!url || !key || !model) {
        if (!isBackground) {
            showToast('请先在“api”应用中完成设置！');
            switchScreen('api-settings-screen');
        }
        return;
    }

    // 确保 BLOCKED_API_DOMAINS 存在
    const blockedDomains = (typeof BLOCKED_API_DOMAINS !== 'undefined') ? BLOCKED_API_DOMAINS : [];
    if (blockedDomains.some(domain => url.includes(domain))) {
        if (!isBackground) showToast('当前 API 站点已被屏蔽，无法发送消息！');
        return;
    }

    if (url.endsWith('/')) {
        url = url.slice(0, -1);
    }

    const chat = (chatType === 'private') ? db.characters.find(c => c.id === chatId) : db.groups.find(g => g.id === chatId);
    if (!chat) return;

    if (!isBackground) {
        currentReplyAbortController = new AbortController();
        isGenerating = true;
        getReplyBtn.disabled = true;
        regenerateBtn.disabled = true;
        const typingName = chatType === 'private' ? chat.remarkName : chat.name;
        typingIndicator.textContent = `“${typingName}”正在输入中...`;
        typingIndicator.style.display = 'block';
        messageArea.scrollTop = messageArea.scrollHeight;
    }

    try {
        let systemPrompt, requestBody;
        if (chatType === 'private') {
            systemPrompt = generatePrivateSystemPrompt(chat, { isPhoneControlRevokeAttempt });
            if (typeof window !== 'undefined' && window.WeatherService && typeof window.WeatherService.buildEnvironmentPrompt === 'function') {
                try {
                    const environmentPrompt = await window.WeatherService.buildEnvironmentPrompt(chat);
                    if (environmentPrompt) systemPrompt += '\n' + environmentPrompt;
                } catch (weatherErr) {
                    console.warn('[天气感知] 注入环境提示失败:', weatherErr);
                }
            }
        } else {
            // generateGroupSystemPrompt 应该在 group_chat.js 中定义
            if (typeof generateGroupSystemPrompt === 'function') {
                systemPrompt = generateGroupSystemPrompt(chat);
            } else {
                systemPrompt = "Group chat system prompt not available.";
            }
        }

        // 添加聊天记录提示
        systemPrompt += "\n\n以下为当前聊天记录：\n";
        
        let historySlice = chat.history.slice(-chat.maxMemory);
        
        // 使用工具函数进行过滤（包含深度克隆、屏蔽过滤、双语修正、状态栏剔除）
        historySlice = filterHistoryForAI(chat, historySlice);
        // 【新增】过滤掉不应进入上下文的消息（如思考过程、被撤回的消息标记等）
        historySlice = historySlice.filter(m => !m.isContextDisabled);
        
        // 【双重保险】再次过滤掉内容匹配 <thinking> 的消息，防止 isContextDisabled 属性丢失
        historySlice = historySlice.filter(m => {
            if (m.isThinking) return false;
            if (m.content && typeof m.content === 'string' && m.content.trim().startsWith('<thinking>')) return false;
            return true;
        });

        const ovoCurrentTurnHasImagesForSummary = _ovoHistoryHasCurrentTurnImages(historySlice);
        if (ovoCurrentTurnHasImagesForSummary) {
            systemPrompt += "\n\n[系统提示：本轮用户发送了图片。你需要正常看图并自然回复；同时请在回复末尾额外输出一条隐藏图片摘要，格式为 [IMAGE_CONTEXT_SUMMARY:用一句话客观概括图片内容]。摘要会被系统保存并从聊天界面隐藏，后续历史只用这条摘要，不再反复发送原图。]";
        }

        if (provider === 'gemini') {
            let lastMsgTimeForAI = 0;
            const contents = historySlice.map(msg => {
                const role = msg.role === 'assistant' ? 'model' : 'user';
                
                let prefix = '';
                const currentMsgTime = msg.timestamp;
                const timeDiff = currentMsgTime - lastMsgTimeForAI;
                const isSameDay = new Date(currentMsgTime).toDateString() === new Date(lastMsgTimeForAI).toDateString();
               
               if (lastMsgTimeForAI === 0 || timeDiff > 20 * 60 * 1000 || !isSameDay) {
                   const dateObj = new Date(currentMsgTime);
                   const timeStr = `${pad(dateObj.getMonth() + 1)}-${pad(dateObj.getDate())} ${pad(dateObj.getHours())}:${pad(dateObj.getMinutes())}`;
                   
                   prefix = `[system: ${timeStr}]`;
                   
                   if (db.apiSettings && db.apiSettings.timePerceptionEnabled && timeDiff > 30 * 60 * 1000 && lastMsgTimeForAI !== 0) {
                       prefix += `\n[system: 距离上次互动已过去 ${formatTimeGap(timeDiff)}。话题可能已中断，请自然地开启新话题或对时间流逝做出反应。]`;
                   }
                   
                   prefix += '\n';
               }
                lastMsgTimeForAI = currentMsgTime;

                let parts;
                if (msg.parts && msg.parts.length > 0) {
                    const allowInlineImage = _ovoShouldSendImageInlineForThisTurn(historySlice, historySlice.indexOf(msg), msg);
                    parts = msg.parts.map(p => {
                        if (p.type === 'text') {
                            return {text: p.text || ''};
                        } else if (p.type === 'html') {
                            return {text: _ovoGetHtmlContextText(msg, p)};
                        } else if (p.type === 'image') {
                            if (allowInlineImage && p.data) {
                                const match = String(p.data).match(/^data:(image\/(.+));base64,(.*)$/);
                                if (match) {
                                    return {inline_data: {mime_type: match[1], data: match[3]}};
                                }
                            }
                            return {text: _ovoGetImageContextText(msg, p)};
                        }
                        return null;
                    }).filter(p => p);
                } else {
                    let content = msg.content || '';
                    // 展开小剧场分享卡片为实际内容，供 AI 读取
                    const theaterShareMatch = content.match(/\[小剧场分享[：:](.+?)\]/);
                    if (theaterShareMatch) {
                        const scenarioId = theaterShareMatch[1];
                        let scenario = null;
                        if (typeof db !== 'undefined' && db) {
                            if (Array.isArray(db.theaterScenarios)) {
                                scenario = db.theaterScenarios.find(s => s.id === scenarioId);
                            }
                            if (!scenario && Array.isArray(db.theaterHtmlScenarios)) {
                                scenario = db.theaterHtmlScenarios.find(s => s.id === scenarioId);
                            }
                        }
                        if (scenario) {
                            let readableContent = scenario.content || '';
                            // HTML 模式：剥除标签，只保留可读文本（无论用户分享还是 char 生成）
                            if (scenario.mode === 'html' || /<[^>]+>/.test(readableContent)) {
                                readableContent = readableContent
                                    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
                                    .replace(/<[^>]+>/g, ' ')
                                    .replace(/\s{2,}/g, ' ')
                                    .trim();
                            }
                            const title = scenario.title || '小剧场';
                            // 所有小剧场都不截断，使用完整内容
                            const excerpt = readableContent;
                            // 替换为包含实际内容的文本
                            content = content.replace(
                                /\[小剧场分享[：:].+?\]/,
                                `（我刚刚写了一篇小剧场，标题是「${title}」。以下是我写的内容：\n${excerpt}）`
                            );
                        }
                    }
                    parts = [{text: content}];
                }

                if (prefix) {
                    if (parts.length > 0 && parts[0].text) {
                        parts[0].text = prefix + parts[0].text;
                    } else {
                        parts.unshift({text: prefix});
                    }
                }
                // 角色自主收藏：为用户消息标注 ID，供模型输出 [FAVORITE:msgId:寄语]（仅私聊且该角色开启时）
                if (msg.role === 'user' && chatType === 'private' && chat.characterAutoFavoriteEnabled && parts.length > 0 && parts[0].text) {
                    parts[0].text = '[id:' + msg.id + ']\n' + parts[0].text;
                }

                return {role, parts};
            });

            if (isBackground) {
                contents.push({
                    role: 'user',
                    parts: [{ text: `[系统通知：距离上次互动已有一段时间。请以${chat.realName}的身份主动发起新话题，或自然地延续之前的对话。]` }]
                });
            }
            if (isCharBlockedMonologue) {
                contents.push({
                    role: 'user',
                    parts: [{ text: '[用户正在查看对话框，你可以主动说些什么。]' }]
                });
            }

            requestBody = {
                contents: contents,
                system_instruction: {parts: [{text: systemPrompt}]},
                generationConfig: {
                    temperature: db.apiSettings.temperature !== undefined ? db.apiSettings.temperature : 1.0
                }
            };
        } else {
            const messages = [{role: 'system', content: systemPrompt}];
            
            let lastMsgTimeForAI = 0;
            
            historySlice.forEach(msg => {
               let content;
               let prefix = '';
               
               const currentMsgTime = msg.timestamp;
               const timeDiff = currentMsgTime - lastMsgTimeForAI;
               const isSameDay = new Date(currentMsgTime).toDateString() === new Date(lastMsgTimeForAI).toDateString();
               
               if (lastMsgTimeForAI === 0 || timeDiff > 20 * 60 * 1000 || !isSameDay) {
                   const dateObj = new Date(currentMsgTime);
                   const timeStr = `${pad(dateObj.getMonth() + 1)}-${pad(dateObj.getDate())} ${pad(dateObj.getHours())}:${pad(dateObj.getMinutes())}`;
                   prefix = `[system: ${timeStr}]\n`;
               }
               lastMsgTimeForAI = currentMsgTime;

               if (msg.role === 'user' && msg.quote) {
                   const replyTextMatch = msg.content.match(/\[.*?的消息：([\s\S]+?)\]/);
                   const replyText = replyTextMatch ? replyTextMatch[1] : msg.content;
                   
                   content = `${prefix}[${chat.myName}引用“${msg.quote.content}”并回复：${replyText}]`;
                   if (chatType === 'private' && chat.characterAutoFavoriteEnabled) {
                       content = '[id:' + msg.id + ']\n' + content;
                   }
                   messages.push({ role: 'user', content: content });

               } else {
                   if (msg.parts && msg.parts.length > 0) {
                       let prefixAdded = false;
                       const allowInlineImage = _ovoShouldSendImageInlineForThisTurn(historySlice, historySlice.indexOf(msg), msg);
                       
                       content = msg.parts.map(p => {
                           if (p.type === 'text') {
                               const textContent = (!prefixAdded) ? (prefix + (p.text || '')) : (p.text || '');
                               prefixAdded = true;
                               return {type: 'text', text: textContent};
                           } else if (p.type === 'html') {
                               const htmlSummary = _ovoGetHtmlContextText(msg, p);
                               const textContent = (!prefixAdded) ? (prefix + htmlSummary) : htmlSummary;
                               prefixAdded = true;
                               return {type: 'text', text: textContent};
                           } else if (p.type === 'image') {
                               if (allowInlineImage && p.data) {
                                   return {type: 'image_url', image_url: {url: p.data}};
                               }
                               const imageSummary = _ovoGetImageContextText(msg, p);
                               const textContent = (!prefixAdded) ? (prefix + imageSummary) : imageSummary;
                               prefixAdded = true;
                               return {type: 'text', text: textContent};
                           }
                           return null;
                       }).filter(p => p);
                       if (!prefixAdded && prefix) {
                           content.unshift({type: 'text', text: prefix});
                       }
                   } else {
                       content = prefix + msg.content;
                       // 展开小剧场分享卡片为实际内容，供 AI 读取
                       const theaterShareMatch = content.match(/\[小剧场分享[：:](.+?)\]/);
                       if (theaterShareMatch) {
                           const scenarioId = theaterShareMatch[1];
                           let scenario = null;
                           if (typeof db !== 'undefined' && db) {
                               if (Array.isArray(db.theaterScenarios)) {
                                   scenario = db.theaterScenarios.find(s => s.id === scenarioId);
                               }
                               if (!scenario && Array.isArray(db.theaterHtmlScenarios)) {
                                   scenario = db.theaterHtmlScenarios.find(s => s.id === scenarioId);
                               }
                           }
                           if (scenario) {
                               let readableContent = scenario.content || '';
                               // HTML 模式：剥除标签，只保留可读文本（无论用户分享还是 char 生成）
                               if (scenario.mode === 'html' || /<[^>]+>/.test(readableContent)) {
                                   readableContent = readableContent
                                       .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
                                       .replace(/<[^>]+>/g, ' ')
                                       .replace(/\s{2,}/g, ' ')
                                       .trim();
                               }
                               const title = scenario.title || '小剧场';
                               // 所有小剧场都不截断，使用完整内容
                               const excerpt = readableContent;
                               // 替换为包含实际内容的文本
                               content = content.replace(
                                   /\[小剧场分享[：:].+?\]/,
                                   `（我刚刚写了一篇小剧场，标题是「${title}」。以下是我写的内容：\n${excerpt}）`
                               );
                           }
                       }
                   }
                   if (msg.role === 'user' && chatType === 'private' && chat.characterAutoFavoriteEnabled) {
                       if (typeof content === 'string') {
                           content = '[id:' + msg.id + ']\n' + content;
                       } else if (content && content[0] && content[0].text) {
                           content[0].text = '[id:' + msg.id + ']\n' + content[0].text;
                       }
                   }
                   if (typeof content === 'string') {
                       messages.push({role: msg.role, content: content});
                   } else {
                       messages.push({role: msg.role, content: content});
                   }
               }
            });

            // === 【第三步：处理后台通知与 CoT 序列】 ===
            
            // 1. 如果是后台消息，先插入系统通知（作为任务输入）
            if (isBackground) {
                messages.push({
                    role: 'user',
                    content: `[系统通知：距离上次互动已有一段时间。请以${chat.realName}的身份主动发起新话题，或自然地延续之前的对话。]`
                });
            }
            if (isCharBlockedMonologue) {
                messages.push({
                    role: 'user',
                    content: '[用户正在查看对话框，你可以主动说些什么。]'
                });
            }

            // 2. 插入 CoT 序列（无论前台后台，只要开启就插入）
            const cotEnabled = db.cotSettings && db.cotSettings.enabled;
            
            if (cotEnabled) {
                let cotInstruction = '';
                const activePresetId = (db.cotSettings && db.cotSettings.activePresetId) || 'default';
                const preset = (db.cotPresets || []).find(p => p.id === activePresetId);
                
                if (preset && preset.items) {
                    cotInstruction = preset.items
                        .filter(item => item.enabled)
                        .map(item => item.content)
                        .join('\n\n');
                }

                if (cotInstruction) {
                    // 1. 插入后置指令
                    messages.push({
                        role: 'system', // 或者 'user'
                        content: cotInstruction
                    });

                    // 2. 插入触发器
                    messages.push({
                        role: 'user',
                        content: '[incipere]'
                    });

                    // 3. 插入 Prefill (预填/强塞)
                    messages.push({
                        role: 'assistant',
                        content: '<thinking>'
                    });
                }
            }

            requestBody = {
                model: model, 
                messages: messages, 
                stream: streamEnabled,
                temperature: db.apiSettings.temperature !== undefined ? db.apiSettings.temperature : 1.0
            };
        }
        console.log('[DEBUG] AutoReply Request Body:', JSON.stringify(requestBody));
        const endpoint = (provider === 'gemini') ? `${url}/v1beta/models/${model}:streamGenerateContent?key=${getRandomValue(key)}` : `${url}/v1/chat/completions`;
        const headers = (provider === 'gemini') ? {'Content-Type': 'application/json'} : {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${key}`
        };
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(requestBody),
            signal: currentReplyAbortController ? currentReplyAbortController.signal : undefined
        });
        if (!response.ok) {
            const error = new Error(`API Error: ${response.status} ${await response.text()}`);
            error.response = response;
            throw error;
        }
        
        if (streamEnabled) {
            await processStream(response, chat, provider, chatId, chatType, isBackground, isCharBlockedMonologue);
        } else {
            let result;
            try {
                result = await response.json();
                console.log('【API完整响应数据】:', result);
            } catch (e) {
                const text = await response.text();
                console.error("Failed to parse JSON:", text);
                throw new Error(`API返回了非JSON格式数据 (可能是网页HTML)。请检查API地址是否正确。原始内容开头: ${text.substring(0, 50)}...`);
            }

            let fullResponse = "";
            if (provider === 'gemini') {
                fullResponse = result.candidates?.[0]?.content?.parts?.[0]?.text || "";
            } else {
                fullResponse = result.choices[0].message.content;
            }
            
            // === 【补丁：把被吃掉的开头补回来】 ===
            // 仅在 CoT 开启且检测到闭合标签时补全
            const cotEnabled = db.cotSettings && db.cotSettings.enabled;
            // 【修改】去掉了 !isBackground，确保后台模式也能正确补全标签
            if (cotEnabled && fullResponse && !fullResponse.trim().startsWith('<thinking>')) {
                 if (fullResponse.includes('</thinking>')) {
                     fullResponse = '<thinking>' + fullResponse;
                 }
            }
            // ===================================
            
            
            await handleAiReplyContent(fullResponse, chat, chatId, chatType, isBackground, isCharBlockedMonologue);
        }

    } catch (error) {
        if (error.name === 'AbortError') {
            if (!isBackground && typeof showToast === 'function') showToast('已暂停调用');
        } else {
            if (!isBackground) showApiError(error);
            else console.error("Background Auto-Reply Error:", error);
        }
    } finally {
        if (!isBackground) {
            currentReplyAbortController = null;
            isGenerating = false;
            getReplyBtn.disabled = false;
            regenerateBtn.disabled = false;
            // 如果正在生成小剧场，不隐藏提示（让小剧场生成过程显示提示）
            if (!typingIndicator || typingIndicator.getAttribute('data-theater-generating') !== 'true') {
                typingIndicator.style.display = 'none';
            }
        }
    }
}

async function processStream(response, chat, apiType, targetChatId, targetChatType, isBackground = false, isCharBlockedMonologue = false) {
    const reader = response.body.getReader(), decoder = new TextDecoder();
    let fullResponse = "", accumulatedChunk = "";
    for (; ;) {
        const {done, value} = await reader.read();
        if (done) break;
        accumulatedChunk += decoder.decode(value, {stream: true});
        if (apiType === "openai" || apiType === "deepseek" || apiType === "claude" || apiType === "newapi") {
            const parts = accumulatedChunk.split("\n\n");
            accumulatedChunk = parts.pop();
            for (const part of parts) {
                if (part.startsWith("data: ")) {
                    const data = part.substring(6);
                    if (data.trim() !== "[DONE]") {
                        try {
                            fullResponse += JSON.parse(data).choices[0].delta?.content || "";
                        } catch (e) { 
                        }
                    }
                }
            }
        }
    }
    if (apiType === "gemini") {
        try {
            const parsedStream = JSON.parse(accumulatedChunk);
            fullResponse = parsedStream.map(item => item.candidates?.[0]?.content?.parts?.[0]?.text || "").join('');
        } catch (e) {
            console.error("Error parsing Gemini stream:", e, "Chunk:", accumulatedChunk);
            if (!isBackground) showToast("解析Gemini响应失败");
            return;
        }
    }
    // === 【补丁：补全流式输出时丢失的开头标签】 ===
        // === 【补丁：补全流式输出时丢失的开头标签】 ===
    // 无论前台后台，只要是CoT开启且被预填吃掉了开头，都要补回来
    const cotEnabled = db.cotSettings && db.cotSettings.enabled;
    // 【修改】去掉了 !isBackground，确保后台模式也能正确补全标签
    if (cotEnabled && fullResponse && !fullResponse.trim().startsWith('<thinking>')) {
         // 这里判断：如果内容里有闭合的 </thinking> 但开头没有 <thinking>，说明开头被 Prefill 吃掉了
         if (fullResponse.includes('</thinking>')) {
             fullResponse = '<thinking>' + fullResponse;
         }
    }

    // ===================
    await handleAiReplyContent(fullResponse, chat, targetChatId, targetChatType, isBackground, isCharBlockedMonologue);
}

/** 返回该角色在手机掌控下可见的角色与群聊（未开启分组过滤则返回全部，开启则只返回指定文件夹内） */
function getPhoneControlVisibleChats(controllingChar) {
    if (!controllingChar.phoneControlFolderFilterEnabled || !controllingChar.phoneControlVisibleFolderIds || controllingChar.phoneControlVisibleFolderIds.length === 0) {
        return {
            characters: (db.characters || []).filter(c => c.id !== controllingChar.id),
            groups: db.groups || []
        };
    }
    const visibleIds = controllingChar.phoneControlVisibleFolderIds;
    const includeNoFolder = visibleIds.includes('__no_folder__');
    const folderIds = visibleIds.filter(id => id !== '__no_folder__');
    const characters = (db.characters || []).filter(c => {
        if (c.id === controllingChar.id) return false;
        if (!c.folderId && includeNoFolder) return true;
        if (c.folderId && folderIds.includes(c.folderId)) return true;
        return false;
    });
    const groups = (db.groups || []).filter(g => {
        if (!g.folderId && includeNoFolder) return true;
        if (g.folderId && folderIds.includes(g.folderId)) return true;
        return false;
    });
    return { characters, groups };
}

/** 解析并执行 [phone-control:action|key:value...] 指令，返回清理后的文本与是否执行过指令 */
function executePhoneControlCommands(text, controllingChar) {
    if (!text || !controllingChar || !controllingChar.phoneControlEnabled) return { cleaned: text, executed: false };
    const regex = /\[phone-control:([^\|\]]+)(?:\|([^\]]*))?\]/g;
    let match;
    const toRemove = [];
    let executed = false;
    while ((match = regex.exec(text)) !== null) {
        const action = (match[1] || '').trim().toLowerCase();
        const paramStr = (match[2] || '').trim();
        const params = {};
        paramStr.split(/\|/).forEach(p => {
            const colon = p.indexOf(':');
            if (colon > 0) {
                const k = p.slice(0, colon).trim().toLowerCase();
                const v = p.slice(colon + 1).trim();
                params[k] = v;
            }
        });
        const targetName = (params.target || '').trim().replace(/^["'\s]+|["'\s]+$/g, '');
        const limit = Math.min(100, Math.max(5, parseInt(controllingChar.phoneControlViewLimit, 10) || 10));

        const pushHistory = (type, actionName, target, detail) => {
            if (!Array.isArray(controllingChar.phoneControlHistory)) controllingChar.phoneControlHistory = [];
            controllingChar.phoneControlHistory.push({ type, action: actionName, target: target || undefined, detail: detail || undefined, timestamp: Date.now() });
            // 不在 AI 回复处理中途保存，避免旧 history 抢写覆盖新消息；本轮末尾统一 saveData。
            executed = true;
        };

        const { characters: visibleChars, groups: visibleGroups } = getPhoneControlVisibleChats(controllingChar);

        // phone-control 目标名宽松匹配：保留原指令格式，只提高找人成功率。
        // 优先精确匹配，其次忽略空白/引号/括号类装饰，最后允许唯一包含匹配。
        const normalizePhoneTargetName = (value) => String(value || '')
            .trim()
            .replace(/^["'“”‘’「」『』【】\[\]\s]+|["'“”‘’「」『』【】\[\]\s]+$/g, '')
            .replace(/[\s\u200b\u200c\u200d\uFEFF]+/g, '')
            .replace(/[「」『』“”‘’"'【】\[\]（）()]/g, '');

        const pickUniquePhoneTarget = (items, target, nameGetter) => {
            const rawTarget = String(target || '').trim();
            const normalizedTarget = normalizePhoneTargetName(rawTarget);
            if (!normalizedTarget) return null;

            const exact = items.find(item => (nameGetter(item) || []).some(name => String(name || '').trim() === rawTarget));
            if (exact) return exact;

            const normalizedExact = items.find(item => (nameGetter(item) || []).some(name => normalizePhoneTargetName(name) === normalizedTarget));
            if (normalizedExact) return normalizedExact;

            const contains = items.filter(item => (nameGetter(item) || []).some(name => {
                const normalizedName = normalizePhoneTargetName(name);
                return normalizedName && (normalizedName.includes(normalizedTarget) || normalizedTarget.includes(normalizedName));
            }));
            return contains.length === 1 ? contains[0] : null;
        };

        const findVisibleCharacterByTarget = (target) => pickUniquePhoneTarget(
            visibleChars,
            target,
            x => [x.remarkName, x.realName, x.name].filter(Boolean)
        );

        const findVisibleGroupByTarget = (target) => pickUniquePhoneTarget(
            visibleGroups,
            target,
            x => [x.name].filter(Boolean)
        );

        const findTargetChat = () => {
            const c = findVisibleCharacterByTarget(targetName);
            if (c) return { chat: c, chatId: c.id, chatType: 'private', name: c.remarkName || c.realName };
            const g = findVisibleGroupByTarget(targetName);
            if (g) return { chat: g, chatId: g.id, chatType: 'group', name: g.name };
            return null;
        };

        if (action === 'view-chat-list') {
            const pad = (n) => (n < 10 ? '0' + n : '' + n);
            const others = visibleChars;
            const groupList = visibleGroups;
            const chatItems = [
                ...others.map(c => ({ name: c.remarkName || c.realName || '未知', type: 'private', lastMsg: (c.history && c.history.length) ? c.history[c.history.length - 1] : null })),
                ...groupList.map(g => ({ name: g.name || '群聊', type: 'group', lastMsg: (g.history && g.history.length) ? g.history[g.history.length - 1] : null }))
            ].sort((a, b) => (b.lastMsg ? b.lastMsg.timestamp : 0) - (a.lastMsg ? a.lastMsg.timestamp : 0));
            let listText = '【用户聊天列表概览】\n';
            if (chatItems.length === 0) listText += '（暂无其他聊天）\n';
            else {
                chatItems.slice(0, 30).forEach(item => {
                    let preview = '…';
                    if (item.lastMsg) {
                        const raw = (item.lastMsg.content || '').trim();
                        const plain = raw.replace(/^\[.*?：([\s\S]*)\]$/, '$1').replace(/\[.*?\]/g, '').trim();
                        preview = plain.length > 25 ? plain.slice(0, 25) + '…' : plain || '…';
                    }
                    const t = item.lastMsg && item.lastMsg.timestamp ? new Date(item.lastMsg.timestamp) : null;
                    const timeStr = t ? `${pad(t.getMonth() + 1)}/${pad(t.getDate())} ${pad(t.getHours())}:${pad(t.getMinutes())}` : '';
                    listText += `- ${item.name}（${item.type === 'group' ? '群聊' : '私聊'}）：${preview} ${timeStr}\n`;
                });
            }
            controllingChar.phoneControlLastViewChatListResult = listText;
            pushHistory('view', 'view-chat-list', '', '聊天列表');
            toRemove.push(match[0]);
        } else if (action === 'read-chat' && targetName) {
            const found = findTargetChat();
            if (found) {
                const hist = (found.chat.history || []).filter(m => !m.isContextDisabled && !m.isThinking).slice(-limit);
                const lines = hist.map(m => {
                    const role = m.role === 'user' ? '用户' : (found.chatType === 'group' ? (m.role === 'assistant' ? m.name || '角色' : '用户') : (found.chat.realName || found.chat.remarkName));
                    const content = (m.content || '').replace(/<thinking>[\s\S]*?<\/thinking>/, '').trim().slice(0, 200);
                    return `${role}：${content}`;
                });
                controllingChar.phoneControlLastReadResult = { targetName: found.name, chatId: found.chatId, chatType: found.chatType, lines };
                pushHistory('view', 'read-chat', targetName, `最近${lines.length}条`);
            }
            toRemove.push(match[0]);
        } else if (action === 'send-message' && targetName) {
            const content = (params.content || '').trim();
            if (content) {
                const found = findTargetChat();
                if (found) {
                    const lines = content.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
                    const count = lines.length || 1;
                    const toSend = lines.length ? lines : [content];
                    let baseTs = Date.now();
                    if (!found.chat.history) found.chat.history = [];
                    toSend.forEach((line, i) => {
                        found.chat.history.push({
                            id: 'msg_' + (baseTs + i) + '_' + Math.random().toString(36).slice(2),
                            role: 'user',
                            content: line,
                            timestamp: baseTs + i,
                            sentByCharControl: true,
                            controllingCharId: controllingChar.id
                        });
                    });
                    pushHistory('action', 'send-message', targetName, count > 1 ? count + '条' : toSend[0].slice(0, 50));
                    // 不在 AI 回复处理中途保存，避免旧 history 抢写覆盖新消息；本轮末尾统一 saveData。
                }
            }
            toRemove.push(match[0]);
        } else if (action === 'delete-character' && targetName) {
            const c = findVisibleCharacterByTarget(targetName);
            if (c) {
                if (!Array.isArray(db.phoneControlRecycleBin)) db.phoneControlRecycleBin = [];
                db.phoneControlRecycleBin.push({ ...c, recycledAt: Date.now(), recycledByCharId: controllingChar.id });
                db.characters = db.characters.filter(x => x.id !== c.id);

                // 逐条 put 的 saveData 不会自动删除已从数组移除的角色。
                // 这里只删除 IndexedDB 里的这一条角色记录，不做全量 saveData，避免旧 history 抢写。
                if (typeof dexieDB !== 'undefined' && dexieDB.characters && c.id) {
                    dexieDB.characters.delete(c.id).catch(err => {
                        console.warn('[phone-control] 删除角色 IndexedDB 记录失败:', err);
                    });
                }

                pushHistory('action', 'delete-character', targetName, '已移入回收站');
                // 不在 AI 回复处理中途保存，避免旧 history 抢写覆盖新消息；本轮末尾统一 saveData。
                if (typeof renderChatList === 'function') renderChatList();
            }
            toRemove.push(match[0]);
        } else if (action === 'toggle-setting' && targetName && params.setting) {
            const c = findVisibleCharacterByTarget(targetName);
            if (c) {
                const key = params.setting;
                const val = (params.value || '').toLowerCase() === 'on' || (params.value || '').toLowerCase() === 'true';
                if (key === 'videocallenabled' || key === 'videoCallEnabled') { c.videoCallEnabled = val; pushHistory('action', 'toggle-setting', targetName, 'videoCallEnabled=' + val); }
                else if (key === 'canblockuser' || key === 'canBlockUser') { c.canBlockUser = val; pushHistory('action', 'toggle-setting', targetName, 'canBlockUser=' + val); }
                // 不在 AI 回复处理中途保存，避免旧 history 抢写覆盖新消息；本轮末尾统一 saveData。
            }
            toRemove.push(match[0]);
        } else if (action === 'clear-history' && targetName) {
            const found = findTargetChat();
            if (found) {
                const count = (found.chat.history || []).length;
                found.chat.history = [];
                // 清除拉黑相关记忆
                found.chat.blockHistory = [];
                found.chat.friendRequests = [];
                found.chat.charBlockHistory = [];
                found.chat.userFriendRequests = [];
                found.chat.isBlocked = false;
                found.chat.blockedAt = null;
                found.chat.blockReapply = null;
                found.chat.isBlockedByChar = false;
                found.chat.blockedByCharAt = null;
                found.chat.blockedByCharReason = null;
                pushHistory('action', 'clear-history', targetName, '清空' + count + '条');
                // 不在 AI 回复处理中途保存，避免旧 history 抢写覆盖新消息；本轮末尾统一 saveData。
                if (typeof renderChatList === 'function') renderChatList();
            }
            toRemove.push(match[0]);
        }
    }
    let cleaned = text;
    toRemove.forEach(s => { cleaned = cleaned.replace(s, ''); });
    cleaned = cleaned.replace(/\n{2,}/g, '\n').trim();
    return { cleaned, executed };
}


function _ovoFormatMusicStateForDisplay(state) {
    if (!state) return '当前音乐';
    return state.title || '当前音乐';
}

function _ovoGetMusicStateForPrompt() {
    try {
        if (typeof window !== 'undefined' && window.OVOMusicControl && typeof window.OVOMusicControl.getState === 'function') {
            return window.OVOMusicControl.getState();
        }
    } catch (_) {}
    return null;
}

function _ovoGetMusicLyricContextForPrompt() {
    try {
        if (typeof window !== 'undefined' && window.OVOMusicControl && typeof window.OVOMusicControl.getLyricContext === 'function') {
            return window.OVOMusicControl.getLyricContext(2, 2);
        }
    } catch (_) {}
    return null;
}

function _ovoGetMusicTogetherStateForPrompt() {
    try {
        if (typeof window !== 'undefined' && window.OVOMusicControl && typeof window.OVOMusicControl.getTogetherState === 'function') {
            return window.OVOMusicControl.getTogetherState();
        }
    } catch (_) {}
    return null;
}

async function executeMusicControlCommands(responseText, chat, targetChatId, targetChatType) {
    if (targetChatType !== 'private' || !chat || !chat.musicControlEnabled || !responseText) {
        return { cleaned: responseText, executed: false };
    }

    const regex = /\[(MUSIC_NEXT|MUSIC_PREV|MUSIC_PAUSE|MUSIC_PLAY|END_TOGETHER_LISTENING)\]/g;
    let cleaned = responseText;
    const commands = [];
    let match;
    while ((match = regex.exec(responseText)) !== null) {
        commands.push(match[1]);
        if (commands.length >= 2) break;
    }

    cleaned = cleaned.replace(regex, '').replace(/\n{3,}/g, '\n\n').trim();

    if (!commands.length) {
        return { cleaned, executed: false };
    }

    if (typeof window !== 'undefined' && typeof window.initMusicPlayer === 'function') {
        try { window.initMusicPlayer(); } catch (_) {}
    }

    const control = (typeof window !== 'undefined') ? window.OVOMusicControl : null;
    if (!control) {
        return { cleaned, executed: false };
    }

    const character = db.characters.find(c => c.id === targetChatId);
    if (!character) {
        return { cleaned, executed: false };
    }

    const displayName = character.remarkName || character.realName || character.name || '角色';
    let executed = false;

    for (const cmd of commands) {
        let result = null;
        let displayText = '';

        if (cmd === 'END_TOGETHER_LISTENING' && typeof control.endTogether === 'function') {
            result = await control.endTogether('角色结束了一起听');
            if (result && result.ok) displayText = `${displayName}结束了和你的一起听`;
            else displayText = `${displayName}想结束一起听，但${(result && result.reason) || '当前无法结束'}`;
        } else if (cmd === 'MUSIC_NEXT' && typeof control.next === 'function') {
            result = await control.next();
            if (result && result.ok) displayText = `${displayName}切歌：${_ovoFormatMusicStateForDisplay(result.state)}`;
            else displayText = `${displayName}想切下一首，但${(result && result.reason) || '当前无法切歌'}`;
        } else if (cmd === 'MUSIC_PREV' && typeof control.prev === 'function') {
            result = await control.prev();
            if (result && result.ok) displayText = `${displayName}切歌：${_ovoFormatMusicStateForDisplay(result.state)}`;
            else displayText = `${displayName}想切上一首，但${(result && result.reason) || '当前无法切歌'}`;
        } else if (cmd === 'MUSIC_PAUSE' && typeof control.pause === 'function') {
            result = await control.pause();
            if (result && result.ok) displayText = `${displayName}暂停了音乐`;
            else displayText = `${displayName}想暂停音乐，但${(result && result.reason) || '当前没有歌曲'}`;
        } else if (cmd === 'MUSIC_PLAY' && typeof control.play === 'function') {
            result = await control.play();
            if (result && result.ok) displayText = `${displayName}继续播放音乐：《${_ovoFormatMusicStateForDisplay(result.state)}》`;
            else displayText = `${displayName}想继续播放，但${(result && result.reason) || '当前没有歌曲'}`;
        }

        if (displayText) {
            const hiddenMsg = {
                id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
                role: 'assistant',
                content: `[system-display:${displayText}]`,
                timestamp: Date.now(),
                isContextDisabled: false
            };
            if (!Array.isArray(character.history)) character.history = [];
            character.history.push(hiddenMsg);
            executed = true;
        }
    }

    if (typeof renderChatList === 'function') renderChatList();

    return { cleaned, executed };
}


async function executeMusicShareCommands(responseText, chat, targetChatId, targetChatType) {
    if (targetChatType !== 'private' || !chat || !chat.musicControlEnabled || !responseText) {
        return { cleaned: responseText, executed: false };
    }

    const regex = /\[(ACCEPT_SHARED_SONG|DECLINE_SHARED_SONG|SHARE_CURRENT_SONG|SEARCH_AND_SHARE_SONG)(?:[:：]([^\]]+?))?\]/g;
    let cleaned = responseText;
    const commands = [];
    let match;
    while ((match = regex.exec(responseText)) !== null) {
        commands.push({ cmd: match[1], arg: (match[2] || '').trim() });
        if (commands.length >= 2) break;
    }
    cleaned = cleaned.replace(regex, '').replace(/\n{3,}/g, '\n\n').trim();

    if (!commands.length) return { cleaned, executed: false };

    if (typeof window !== 'undefined' && typeof window.initMusicPlayer === 'function') {
        try { window.initMusicPlayer(); } catch (_) {}
    }
    const share = (typeof window !== 'undefined') ? window.OVOMusicShare : null;
    if (!share) return { cleaned, executed: false };

    const character = db.characters.find(c => c.id === targetChatId);
    if (!character) return { cleaned, executed: false };

    function addMusicShareSystemDisplay(text) {
        if (!text) return;
        if (!Array.isArray(character.history)) character.history = [];
        character.history.push({
            id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
            role: 'assistant',
            content: `[system-display:${text}]`,
            timestamp: Date.now(),
            isContextDisabled: false
        });
    }

    let executed = false;
    for (const item of commands) {
        const cmd = item.cmd;
        let result = null;
        if (cmd === 'ACCEPT_SHARED_SONG' && typeof share.respondToUserShare === 'function') {
            result = await share.respondToUserShare(targetChatId, true, { deferSave: true });
            executed = !!(result && result.ok) || executed;
        } else if (cmd === 'DECLINE_SHARED_SONG' && typeof share.respondToUserShare === 'function') {
            result = await share.respondToUserShare(targetChatId, false, { deferSave: true });
            executed = !!(result && result.ok) || executed;
        } else if (cmd === 'SHARE_CURRENT_SONG' && typeof share.createCharacterShareCurrent === 'function') {
            result = await share.createCharacterShareCurrent(targetChatId, { deferSave: true });
            executed = !!(result && result.ok) || executed;
        } else if (cmd === 'SEARCH_AND_SHARE_SONG' && typeof share.searchAndShareSong === 'function') {
            const keyword = item.arg;
            result = await share.searchAndShareSong(targetChatId, keyword, { deferSave: true });
            if (result && result.ok) {
                executed = true;
            } else {
                const q = keyword || '这首歌';
                addMusicShareSystemDisplay(`没有找到“${q}”可用的完整歌曲`);
                executed = true;
            }
        }
    }

    return { cleaned, executed };
}


async function executeChangeRemarkNameCommand(responseText, chat, targetChatId, targetChatType) {
    if (targetChatType !== 'private' || !chat || !chat.characterChangeRemarkEnabled || !responseText) {
        return { cleaned: responseText, executed: false };
    }

    const regex = /\[CHANGE_REMARK_NAME[:：]([^\]]+?)\]/g;
    let cleaned = responseText;
    let match;
    let lastName = '';

    while ((match = regex.exec(responseText)) !== null) {
        const candidate = (match[1] || '').trim();
        if (candidate && candidate.length <= 16) {
            lastName = candidate;
        }
    }

    cleaned = cleaned.replace(regex, '').replace(/\n{3,}/g, '\n\n').trim();

    if (!lastName) {
        return { cleaned, executed: false };
    }

    const character = db.characters.find(c => c.id === targetChatId);
    if (!character) {
        return { cleaned, executed: false };
    }

    const oldName = character.remarkName || character.realName || character.name || '';
    if (oldName === lastName) {
        return { cleaned, executed: false };
    }

    character.remarkName = lastName;
    character._lastRemarkChangedAt = Date.now();

    const hiddenMsg = {
        id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
        role: 'assistant',
        content: `[system-display:${oldName || '角色'}把自己的备注名修改为“${lastName}”]`,
        timestamp: Date.now(),
        isContextDisabled: false
    };
    if (!Array.isArray(character.history)) character.history = [];
    character.history.push(hiddenMsg);

    // WOW v55.9.13：这里不能中途 saveData。
    // 备注名和 system-display 消息只改当前角色对象，等本轮 AI 回复处理完后由末尾统一 saveData。
    if (typeof renderChatList === 'function') renderChatList();
    const titleEl = document.getElementById('chat-room-title');
    if (titleEl && currentChatId === targetChatId && currentChatType === 'private') titleEl.textContent = lastName;

    return { cleaned, executed: true, newName: lastName };
}



async function executeChangeUserNicknameCommand(responseText, chat, targetChatId, targetChatType) {
    if (targetChatType !== 'private' || !chat || !chat.characterCanChangeUserNickname || !responseText) {
        return { cleaned: responseText, executed: false };
    }

    const regex = /\[CHANGE_USER_NICKNAME[:：]([^\]]+?)\]/g;
    let cleaned = responseText;
    let match;
    let lastNickname = '';

    while ((match = regex.exec(responseText)) !== null) {
        const candidate = (match[1] || '').trim();
        if (candidate && candidate.length <= 16) {
            lastNickname = candidate;
        }
    }

    cleaned = cleaned.replace(regex, '').replace(/\n{3,}/g, '\n\n').trim();

    if (!lastNickname) {
        return { cleaned, executed: false };
    }

    const character = db.characters.find(c => c.id === targetChatId);
    if (!character) {
        return { cleaned, executed: false };
    }

    const oldNickname = character.myNickname || '';
    if (oldNickname === lastNickname) {
        return { cleaned, executed: false };
    }

    character.myNickname = lastNickname;
    character._lastUserNicknameChangedByCharAt = Date.now();

    const hiddenMsg = {
        id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
        role: 'assistant',
        content: `[system-display:${character.realName || character.remarkName || '角色'}把你的昵称改为“${lastNickname}”]`,
        timestamp: Date.now(),
        isContextDisabled: false
    };
    if (!Array.isArray(character.history)) character.history = [];
    character.history.push(hiddenMsg);

    if (typeof renderChatList === 'function') renderChatList();

    return { cleaned, executed: true, newNickname: lastNickname };
}


async function executeFavoriteReplyNoteCommand(responseText, chat, targetChatId, targetChatType) {
    if (targetChatType !== 'private' || !chat || !chat.characterUserFavoriteAwareEnabled || !chat.pendingFavoriteAwareness || !responseText) {
        return { cleaned: responseText, executed: false };
    }
    const pending = chat.pendingFavoriteAwareness;
    if (!pending || pending.eventType !== 'user_saved_favorite_note' || !pending.favoriteId) {
        return { cleaned: responseText, executed: false };
    }

    const regex = /\[FAVORITE_REPLY_NOTE[:：]([^\]]+?)\]/g;
    let cleaned = responseText;
    let match;
    let lastNote = '';

    while ((match = regex.exec(responseText)) !== null) {
        const candidate = (match[1] || '').trim();
        if (candidate) lastNote = candidate.slice(0, 500);
    }

    cleaned = cleaned.replace(regex, '').replace(/\n{3,}/g, '\n\n').trim();

    if (!lastNote) {
        return { cleaned, executed: false };
    }

    const fav = (db.favorites || []).find(f => f.id === pending.favoriteId);
    if (!fav) {
        return { cleaned, executed: false };
    }

    fav.replyNote = lastNote;

    if (typeof showToast === 'function' && !isGenerating) {
        showToast('角色已给这条收藏写下批注');
    } else if (typeof showToast === 'function') {
        setTimeout(() => showToast('角色已给这条收藏写下批注'), 300);
    }

    return { cleaned, executed: true, replyNote: lastNote };
}


async function handleAiReplyContent(fullResponse, chat, targetChatId, targetChatType, isBackground = false, isCharBlockedMonologue = false) {
    const rawResponse = fullResponse;
    if (fullResponse) {
        // 1. 移除 [incipere] 标签
        fullResponse = fullResponse.replace(/\[incipere\]/g, "");

        // 1.4 角色掌控模式：解析并执行 [phone-control:...] 指令，并从展示内容中移除
        if (targetChatType === 'private') {
            const char = db.characters.find(c => c.id === targetChatId);
            const pcResult = executePhoneControlCommands(fullResponse, char);
            if (pcResult.executed) fullResponse = pcResult.cleaned;
        }

        // 1.4.6 提取并执行角色自行操作功能开关指令，然后从展示内容中移除
        if (targetChatType === 'private' && typeof executeSelfToggleSettingCommands === 'function') {
            const settingToggleResult = await executeSelfToggleSettingCommands(fullResponse, chat);
            fullResponse = settingToggleResult.cleaned;
        }

        // 1.5 提取并执行角色收藏指令，然后从展示内容中移除
        const favoriteRegex = /\[FAVORITE:(msg_[^\]:]+):([^\]]*)\]/g;
        const favoriteCommands = [];
        let match;
        while ((match = favoriteRegex.exec(fullResponse)) !== null) {
            favoriteCommands.push({ messageId: match[1], note: (match[2] || '').trim() });
        }
        fullResponse = fullResponse.replace(favoriteRegex, '').replace(/\n{2,}/g, '\n').trim();
        let favoritesDirty = false;
        if (targetChatType === 'private' && chat.characterAutoFavoriteEnabled && typeof addCharacterFavorite === 'function') {
            favoriteCommands.forEach(function(cmd) {
                const favResult = addCharacterFavorite(cmd.messageId, targetChatId, cmd.note, { deferSave: true });
                if (favResult) favoritesDirty = true;
            });
        }

        // 1.6 提取并执行头像系统指令，然后从展示内容中移除
        if (targetChatType === 'private' && chat.avatarSystemEnabled && window.AvatarSystem) {
            const avatarResult = window.AvatarSystem.parseAvatarCommands(fullResponse, targetChatId);
            fullResponse = avatarResult.cleaned;
            if (avatarResult.actions.length > 0) {
                window.AvatarSystem.executeAvatarActions(avatarResult.actions, targetChatId, { deferSave: true });
            }
        }

        // 1.6.5 一起听歌：识别 [MUSIC_NEXT]/[MUSIC_PREV]/[MUSIC_PAUSE]/[MUSIC_PLAY]/[END_TOGETHER_LISTENING]，执行后从展示内容中移除
        const musicControlResult = await executeMusicControlCommands(fullResponse, chat, targetChatId, targetChatType);
        fullResponse = musicControlResult.cleaned;

        // 1.6.6 歌曲分享卡片：识别 [ACCEPT_SHARED_SONG]/[DECLINE_SHARED_SONG]/[SHARE_CURRENT_SONG]，执行后从展示内容中移除
        const musicShareResult = await executeMusicShareCommands(fullResponse, chat, targetChatId, targetChatType);
        fullResponse = musicShareResult.cleaned;

        // 1.7 角色自行修改备注：识别 [CHANGE_REMARK_NAME:新备注]，执行后从展示内容中移除
        const changeRemarkResult = await executeChangeRemarkNameCommand(fullResponse, chat, targetChatId, targetChatType);
        fullResponse = changeRemarkResult.cleaned;

        // 1.7.2 角色自行修改用户昵称：识别 [CHANGE_USER_NICKNAME:新昵称]，执行后从展示内容中移除
        const changeUserNicknameResult = await executeChangeUserNicknameCommand(fullResponse, chat, targetChatId, targetChatType);
        fullResponse = changeUserNicknameResult.cleaned;

        // 1.7.5 角色给用户收藏写批注：识别 [FAVORITE_REPLY_NOTE:批注内容]，执行后从展示内容中移除
        const favoriteReplyNoteResult = await executeFavoriteReplyNoteCommand(fullResponse, chat, targetChatId, targetChatType);
        fullResponse = favoriteReplyNoteResult.cleaned;
        if (favoriteReplyNoteResult.executed) favoritesDirty = true;

        // 1.7.8 图片上下文摘要：识别并隐藏 [IMAGE_CONTEXT_SUMMARY:...]，本轮成功回复后写回用户图片消息。
        const imageContextSummaryResult = _ovoExtractImageContextSummaryFromReply(fullResponse);
        fullResponse = imageContextSummaryResult.cleaned;
        let pendingImageContextSummary = imageContextSummaryResult.summary;

        // 1.8 已读不回：识别 [NO_REPLY:状态|原因|提示]，保存为状态卡，不进入上下文
        const noReplyMatch = fullResponse.trim().match(/^\[NO_REPLY[:：]([^\]|]+)(?:\|([^\]]*?))?(?:\|([^\]]*?))?\]$/i);
        if (targetChatType === 'private' && chat.characterNoReplyEnabled && noReplyMatch) {
            const status = (noReplyMatch[1] || '忙碌中').trim();
            const reason = (noReplyMatch[2] || '').trim();
            const hint = (noReplyMatch[3] || '暂时无法回复').trim();
            const noReplyMsg = {
                id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
                role: 'assistant',
                content: `[${chat.realName || '对方'}暂时不回：${status}${reason ? '｜' + reason : ''}]`,
                timestamp: Date.now(),
                isNoReplyStatus: true,
                noReplyStatus: status,
                noReplyReason: reason,
                noReplyHint: hint,
                isContextDisabled: true
            };
            chat.history.push(noReplyMsg);
            addMessageBubble(noReplyMsg, targetChatId, targetChatType);
            // WOW v55.9.19：NO_REPLY 状态卡只保存当前聊天，不再全量 saveData。
            if (targetChatType === 'private') {
                await saveCharacterData(chat);
            } else {
                await saveGroupData(chat);
            }
            return;
        }

        // 2. 捕获并分离 <thinking> 内容
        const thinkingMatch = fullResponse.match(/<thinking>([\s\S]*?)<\/thinking>/);
        if (thinkingMatch) {
            const thinkingContent = thinkingMatch[0]; // 包含标签的完整内容
            
            // 创建思考过程消息对象
            const thinkingMsg = {
                id: `msg_${Date.now()}_${Math.random()}`,
                role: 'assistant',
                content: thinkingContent,
                timestamp: Date.now(),
                isThinking: true,
                isContextDisabled: true // 【关键】标记为不进入上下文
            };
            
            // 存入历史记录
            chat.history.push(thinkingMsg);

            // 【新增】清理旧的思维链消息，仅保留最近 50 条
            const maxThinkingMsgs = 50;
            let thinkingCount = 0;
            const idsToRemove = new Set();
            // 从后往前遍历，保留最近的 50 个，其他的标记为待删除
            for (let i = chat.history.length - 1; i >= 0; i--) {
                if (chat.history[i].isThinking) {
                    thinkingCount++;
                    if (thinkingCount > maxThinkingMsgs) {
                        idsToRemove.add(chat.history[i].id);
                    }
                }
            }
            if (idsToRemove.size > 0) {
                chat.history = chat.history.filter(m => !idsToRemove.has(m.id));
            }
            
            // 添加到界面气泡（由于 regex 设置，会被隐藏，仅 Debug 模式可见）
            addMessageBubble(thinkingMsg, targetChatId, targetChatType);
            
            // 从即将显示的文本中移除思考内容
            fullResponse = fullResponse.replace(thinkingContent, "");
        }

        if (db.globalReceiveSound) {
            playSound(db.globalReceiveSound);
        }
        // ... 后续代码保持不变 ...
        console.log('【AI原始返回内容】:', rawResponse);
        let cleanedResponse = fullResponse.replace(/^\[system:.*?\]\s*/, '').replace(/^\(时间:.*?\)\s*/, '');
        const trimmedResponse = cleanedResponse.trim();
        let messages;

        if (trimmedResponse.startsWith('<') && trimmedResponse.endsWith('>')) {
            messages = [{ type: 'html', content: trimmedResponse }];
        } else {
            messages = getMixedContent(fullResponse).filter(item => item.content.trim() !== '');
        }

        let firstMessageProcessed = false;
        // WOW v55.9.26：记录本轮是否真正写入了可见的 assistant 回复。
        // pending 感知事件（改备注/收藏寄语/设置控制）只能在成功回复后消费，避免 API 抽风时白白清掉。
        const committedAssistantMessageIds = [];
        const markCommittedAssistantMessage = (message) => {
            if (targetChatType !== 'private') return;
            if (!message || message.role !== 'assistant') return;
            if (message.isContextDisabled) return;
            if (!String(message.content || '').trim()) return;
            committedAssistantMessageIds.push(message.id);
        };

        for (const item of messages) {
            // 自动剔除不存在的表情包
            const stickerRegex = /\[(?:.*?的)?表情包：(.+?)\]/i;
            const stickerMatch = item.content.match(stickerRegex);
            if (stickerMatch) {
                const stickerName = stickerMatch[1].trim();
                const groups = (chat.stickerGroups || '').split(/[,，]/).map(s => s.trim()).filter(Boolean);
                let targetSticker = null;
                
                // 1. 优先在绑定分组中查找
                if (groups.length > 0) {
                    targetSticker = db.myStickers.find(s => groups.includes(s.group) && s.name === stickerName);
                }
                
                // 2. 兜底在所有表情包中查找
                if (!targetSticker) {
                    targetSticker = db.myStickers.find(s => s.name === stickerName);
                }
                
                // 3. 如果完全找不到，则剔除该消息
                if (!targetSticker) {
                    console.log(`[Auto-Filter] 剔除不存在的表情包: ${stickerName}`);
                    continue; 
                }
            }

            // --- 视频/语音通话邀请检测 ---
            const callInviteRegex = /\[(.*?)向(.*?)发起了(视频|语音)通话\]/;
            const callInviteMatch = item.content.match(callInviteRegex);
            if (callInviteMatch) {
                const type = callInviteMatch[3] === '视频' ? 'video' : 'voice';
                // 触发来电界面
                if (window.VideoCallModule && typeof window.VideoCallModule.receiveCall === 'function') {
                    window.VideoCallModule.receiveCall(type);
                }
                // 不将此消息显示为普通气泡，或者显示为系统通知
                // 这里选择显示为系统通知样式的消息
                const message = {
                    id: `msg_${Date.now()}_${Math.random()}`,
                    role: 'system', // 使用 system 角色
                    content: item.content.trim(),
                    timestamp: Date.now()
                };
                chat.history.push(message);
                addMessageBubble(message, targetChatId, targetChatType);
                continue; // 跳过后续处理
            }

            if (targetChatType === 'private') {
                const char = db.characters.find(c => c.id === targetChatId);
                // 解析隐藏的 [char-action:unblock-user|reason:xxx]，允许角色在拉黑用户后主动解除拉黑
                if (char && char.isBlockedByChar) {
                    const unblockUserMatch = item.content.match(/\[char-action:unblock-user(?:\|reason:([^\]]*))?\]/);
                    if (unblockUserMatch) {
                        if (typeof window.charUnblockUser === 'function') window.charUnblockUser(targetChatId, (unblockUserMatch[1] || '').trim());
                        item.content = item.content.replace(/\[char-action:unblock-user(?:\|reason:[^\]]*)?\]/g, '').trim();
                        if (!item.content || !item.content.trim()) continue;
                    }
                }
                // 解析隐藏的 [char-action:block-user|reason:xxx]，触发角色拉黑用户（仅当角色开启 canBlockUser 时）
                if (char && char.canBlockUser !== false) {
                    const blockUserMatch = item.content.match(/\[char-action:block-user\|reason:([^\]]*)\]/);
                    if (blockUserMatch) {
                        if (typeof window.charBlockUser === 'function') window.charBlockUser(targetChatId, (blockUserMatch[1] || '').trim());
                        item.content = item.content.replace(/\[char-action:block-user\|reason:[^\]]*\]/g, '').trim();
                        if (!item.content || !item.content.trim()) continue;
                    }
                }
                if (char && char.statusPanel && char.statusPanel.enabled && char.statusPanel.regexPattern) {
                    try {
                        let pattern = char.statusPanel.regexPattern;
                        let flags = 'gs'; 

                        const matchParts = pattern.match(/^\/(.*?)\/([a-z]*)$/);
                        if (matchParts) {
                            pattern = matchParts[1];
                            flags = matchParts[2] || 'gs';
                            if (!flags.includes('s')) flags += 's';
                        }

                    const regex = new RegExp(pattern, flags);
                    const match = regex.exec(item.content);
                    
                    if (match) {
                        const rawStatus = match[0];
                        
                        let html = char.statusPanel.replacePattern;
                        
                            // 使用正则一次性查找模板中的 $数字 并替换
    html = html.replace(/\$(\d+)/g, (fullMatch, groupIndex) => {
        const index = parseInt(groupIndex, 10);
        // 如果捕获组存在，则返回对应内容；否则保持原样
        return (match[index] !== undefined) ? match[index] : fullMatch;
    });


                        // Save to history
                        if (!char.statusPanel.history) char.statusPanel.history = [];
                        
                        // Add new status to the beginning
                        char.statusPanel.history.unshift({
                            raw: rawStatus,
                            html: html,
                            timestamp: Date.now()
                        });

                        // Keep only last 20 items
                        if (char.statusPanel.history.length > 20) {
                            char.statusPanel.history = char.statusPanel.history.slice(0, 20);
                        }

                        char.statusPanel.currentStatusRaw = rawStatus;
                        char.statusPanel.currentStatusHtml = html;
                        
                        item.isStatusUpdate = true;
                        item.statusSnapshot = {
                            regex: pattern,
                            replacePattern: char.statusPanel.replacePattern
                        };
                        }
                    } catch (e) {
                        console.error("状态栏正则解析错误:", e);
                    }
                }
                // 解析并执行 [更换主题：主题名]（你与用户共用的对话主题）
                if (char && char.allowCharSwitchBubbleCss && Array.isArray(char.bubbleCssThemeBindings) && char.bubbleCssThemeBindings.length > 0) {
                    const themeSwitchRegex = /\[更换主题[：:]\s*([^\]\n]+)\]/g;
                    let themeSwitchMatch;
                    let contentAfterStrip = item.content;
                    while ((themeSwitchMatch = themeSwitchRegex.exec(item.content)) !== null) {
                        let themeName = themeSwitchMatch[1].trim().replace(/^[「『"【\[]+/, '').replace(/[」』"】\]]+$/, '').trim();
                        const binding = char.bubbleCssThemeBindings.find(b => b.presetName === themeName);
                        const preset = binding && (db.bubbleCssPresets || []).find(p => p.name === binding.presetName);
                        if (preset) {
                            chat.customBubbleCss = preset.css;
                            chat.useCustomBubbleCss = true;
                            char.currentBubbleCssPresetName = preset.name;
                            if (typeof updateCustomBubbleStyle === 'function') updateCustomBubbleStyle(targetChatId, preset.css, true);
                            // 不在消息处理循环中途 saveData，等本轮回复末尾统一保存
                            contentAfterStrip = contentAfterStrip.replace(themeSwitchMatch[0], '').replace(/\n\s*\n/g, '\n').trim();
                        }
                    }
                    item.content = contentAfterStrip;
                    if (!item.content || !item.content.trim()) continue; // 仅更换主题时不再追加空消息
                }

                // 解析提醒事项标签
                if (typeof parseReminderTags === 'function') {
                    item.content = parseReminderTags(item.content, targetChatId, true);
                    if (!item.content || !item.content.trim()) continue;
                }
            }

            // 如果是后台模式，跳过延迟，直接处理
            if (!isBackground) {
                const delay = firstMessageProcessed ? (900 + Math.random() * 1300) : (400 + Math.random() * 400);
                await new Promise(resolve => setTimeout(resolve, delay));
                
                // 如果开启了多条消息提示音，且不是第一条消息（第一条已由系统默认逻辑播放），则播放提示音
                if (firstMessageProcessed && db.multiMsgSoundEnabled && db.globalReceiveSound) {
                    playSound(db.globalReceiveSound);
                }
            }
            firstMessageProcessed = true;

            const aiWithdrawRegex = /\[(.*?)撤回了一条消息：([\s\S]*?)\]/;
            const aiWithdrawRegexEn = /\[(?:system:\s*)?(.*?) withdrew a message\. Original: ([\s\S]*?)\]/;
            
            const withdrawMatch = item.content.match(aiWithdrawRegex) || item.content.match(aiWithdrawRegexEn);

            if (withdrawMatch) {
                const characterName = withdrawMatch[1];
                const originalContent = withdrawMatch[2];

                const normalContent = `[${characterName}的消息：${originalContent}]`;
                
                const message = {
                    id: `msg_${Date.now()}_${Math.random()}`,
                    role: 'assistant',
                    content: normalContent,
                    parts: [{type: 'text', text: normalContent}],
                    timestamp: Date.now(),
                    originalContent: originalContent, 
                    isWithdrawn: false 
                };
                if (isCharBlockedMonologue) message.sentWhileCharBlocked = true;

                if (targetChatType === 'group') {
                    const sender = chat.members.find(m => (m.realName === characterName || m.groupNickname === characterName));
                    if (sender) {
                        message.senderId = sender.id;
                    }
                }

                chat.history.push(message);
                markCommittedAssistantMessage(message);
                addMessageBubble(message, targetChatId, targetChatType);
                
                setTimeout(async () => {
                    message.isWithdrawn = true;
                    message.content = `[${characterName}撤回了一条消息：${originalContent}]`;
                    
                    if (targetChatType === 'private') {
                        await saveCharacterData(chat);
                    } else {
                        await saveGroupData(chat);
                    }
                    
                    if ((targetChatType === 'private' && currentChatId === chat.id) || 
                        (targetChatType === 'group' && currentChatId === chat.id)) {
                         renderMessages(false, true);
                    }
                }, 2000);

                continue; 
            }

            if (targetChatType === 'private') {
                const character = chat;
                const myName = character.myName;

                const aiQuoteRegex = new RegExp(`\\[${character.realName}引用[“"](.*?)["”]并回复：([\\s\\S]*?)\\]`);
                const aiQuoteMatch = item.content.match(aiQuoteRegex);

                if (aiQuoteMatch) {
                    const quotedText = aiQuoteMatch[1];
                    const replyText = aiQuoteMatch[2];

                    const originalMessage = chat.history.slice().reverse().find(m => {
                        if (m.role === 'user') {
                            const userMessageMatch = m.content.match(/\[.*?的消息：([\s\S]+?)\]/);
                            const userMessageText = userMessageMatch ? userMessageMatch[1] : m.content;
                            return userMessageText.trim() === quotedText.trim();
                        }
                        return false;
                    });

                    if (originalMessage) {
                        let filteredReplyText = replyText;
                        if (typeof applyRegexFilter === 'function') filteredReplyText = applyRegexFilter(replyText, targetChatId);
                        const message = {
                            id: `msg_${Date.now()}_${Math.random()}`,
                            role: 'assistant',
                            content: `[${character.realName}的消息：${filteredReplyText}]`,
                            parts: [{ type: 'text', text: `[${character.realName}的消息：${filteredReplyText}]` }],
                            timestamp: Date.now(),
                            isStatusUpdate: item.isStatusUpdate,
                            statusSnapshot: item.statusSnapshot,
                            quote: {
                                messageId: originalMessage.id,
                                senderId: 'user_me',
                                content: quotedText
                            }
                        };
                        if (isCharBlockedMonologue) message.sentWhileCharBlocked = true;
                        chat.history.push(message);
                        markCommittedAssistantMessage(message);
                        addMessageBubble(message, targetChatId, targetChatType);
                    } else {
                        let filteredReplyText2 = replyText;
                        if (typeof applyRegexFilter === 'function') filteredReplyText2 = applyRegexFilter(replyText, targetChatId);
                        const message = {
                            id: `msg_${Date.now()}_${Math.random()}`,
                            role: 'assistant',
                            content: `[${character.realName}的消息：${filteredReplyText2}]`,
                            parts: [{ type: 'text', text: `[${character.realName}的消息：${filteredReplyText2}]` }],
                            timestamp: Date.now(),
                            isStatusUpdate: item.isStatusUpdate,
                            statusSnapshot: item.statusSnapshot
                        };
                        if (isCharBlockedMonologue) message.sentWhileCharBlocked = true;
                        chat.history.push(message);
                        markCommittedAssistantMessage(message);
                        addMessageBubble(message, targetChatId, targetChatType);
                    }
                } else {
                    const receivedTransferRegex = new RegExp(`\\[${character.realName}的转账：.*?元；备注：.*?\\]`);
                    const giftRegex = new RegExp(`\\[${character.realName}送来的礼物：.*?\\]`);

                    const rawContent = item.content.trim();
                    let finalContent = rawContent;

                    // 应用正则过滤
                    if (typeof applyRegexFilter === 'function') {
                        finalContent = applyRegexFilter(finalContent, targetChatId);
                    }

                    const message = {
                        id: `msg_${Date.now()}_${Math.random()}`,
                        role: 'assistant',
                        content: finalContent,
                        parts: [{type: item.type, text: finalContent}],
                        timestamp: Date.now(),
                        isStatusUpdate: item.isStatusUpdate,
                        statusSnapshot: item.statusSnapshot
                    };
                    if (isCharBlockedMonologue) message.sentWhileCharBlocked = true;

                    if (receivedTransferRegex.test(message.content)) {
                        message.transferStatus = 'pending';
                    } else if (giftRegex.test(message.content)) {
                        message.giftStatus = 'sent';
                    }

                    const charGiveFcRegex = new RegExp(`\\[${(character.realName || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}赠送亲属卡[：:]额度([\\d.,]+)元[；;]刷新周期[：:](.+?)\\]`);
                    const charGiveFcMatch = message.content.match(charGiveFcRegex);
                    if (targetChatType === 'private' && character.familyCardEnabled && charGiveFcMatch) {
                        const limit = parseFloat(charGiveFcMatch[1].replace(/,/g, '.'));
                        const periodStr = (charGiveFcMatch[2] || '').trim();
                        let refreshPeriod = 'monthly';
                        let refreshDays = 30;
                        if (periodStr.indexOf('每天') !== -1) refreshPeriod = 'daily';
                        else if (periodStr.indexOf('每周') !== -1) refreshPeriod = 'weekly';
                        else if (periodStr.indexOf('每月') !== -1) refreshPeriod = 'monthly';
                        else { const d = parseInt(periodStr, 10); if (!isNaN(d) && d > 0) { refreshPeriod = 'custom'; refreshDays = d; } }
                        const existingCard = (db.piggyBank && db.piggyBank.receivedFamilyCards) ? db.piggyBank.receivedFamilyCards.find(c => c.fromCharId === character.id && c.status === 'active') : null;
                        if (existingCard) {
                            existingCard.status = 'revoked';
                            existingCard.statusChangedBy = 'system_replaced';
                        }
                        if (typeof createReceivedFamilyCard === 'function') {
                            const card = createReceivedFamilyCard({ fromCharId: character.id, fromCharName: character.realName || '', limit, refreshPeriod, refreshDays });
                            message.receivedFamilyCardId = card.id;
                            message.receivedFamilyCardStatus = 'pending';
                        }
                    }

                    chat.history.push(message);
                    markCommittedAssistantMessage(message);
                    addMessageBubble(message, targetChatId, targetChatType);
                }

            } else if (targetChatType === 'group') {
                const group = chat;
                
                // --- 私聊通知 (不拦截) ---
                if (group.allowGossip && typeof handleGossipMessage === 'function') {
                    handleGossipMessage(group, item.content);
                }

                // 优先检查是否为私聊消息
                const privateRegex = /^\[Private: (.*?) -> (.*?): ([\s\S]+?)\]$/;
                const privateEndRegex = /^\[Private-End: (.*?) -> (.*?)\]$/;
                
                if (privateRegex.test(item.content) || privateEndRegex.test(item.content)) {
                    const match = item.content.match(privateRegex) || item.content.match(privateEndRegex);
                    let senderId = 'unknown';
                    
                    if (match) {
                        const senderName = match[1];
                        // 尝试匹配发送者
                        if (senderName === group.me.nickname) {
                            senderId = 'user_me';
                        } else {
                            const sender = group.members.find(m => m.realName === senderName || m.groupNickname === senderName);
                            if (sender) senderId = sender.id;
                        }
                    }

                    const message = {
                        id: `msg_${Date.now()}_${Math.random()}`,
                        role: 'assistant',
                        content: item.content.trim(),
                        parts: [{type: item.type, text: item.content.trim()}],
                        timestamp: Date.now(),
                        senderId: senderId
                    };
                    group.history.push(message);
                    addMessageBubble(message, targetChatId, targetChatType);
                    continue; // 私聊消息处理完毕，跳过后续普通消息匹配
                }

                // 优先检查是否为角色接收/退回用户转账的指令消息
                const transferActionRegex = /\[(.*?)(接收|退回)(.*?)的转账\]/;
                const transferActionMatch = item.content.match(transferActionRegex);
                
                if (transferActionMatch) {
                    const actorName = transferActionMatch[1].trim();
                    const sender = group.members.find(m => (m.realName === actorName || m.groupNickname === actorName));
                    if (sender) {
                        const message = {
                            id: `msg_${Date.now()}_${Math.random()}`,
                            role: 'assistant',
                            content: item.content.trim(),
                            parts: [{type: item.type, text: item.content.trim()}],
                            timestamp: Date.now(),
                            senderId: sender.id,
                            isTransferAction: true
                        };
                        group.history.push(message);
                        addMessageBubble(message, targetChatId, targetChatType);
                    }
                    continue;
                }

                const groupTransferRegex = /\[(.*?)\s*向\s*(.*?)\s*转账：([\d.,]+)元；备注：(.*?)\]/;
                const transferMatch = item.content.match(groupTransferRegex);

                const r = /\[(.*?)((?:的消息|的语音|发送的表情包|发来的照片\/视频))：/;
                const nameMatch = item.content.match(r);
                
                if (transferMatch) {
                    const senderName = transferMatch[1];
                    const sender = group.members.find(m => (m.realName === senderName || m.groupNickname === senderName));
                    if (sender) {
                        const message = {
                            id: `msg_${Date.now()}_${Math.random()}`,
                            role: 'assistant',
                            content: item.content.trim(),
                            parts: [{type: item.type, text: item.content.trim()}],
                            timestamp: Date.now(),
                            senderId: sender.id,
                            transferStatus: 'pending'
                        };
                        group.history.push(message);
                        addMessageBubble(message, targetChatId, targetChatType);
                    }
                } else if (nameMatch || item.char) {
                    const senderName = item.char || (nameMatch[1]);
                    const sender = group.members.find(m => (m.realName === senderName || m.groupNickname === senderName));
                    console.log(sender)
                    if (sender) {
                        const message = {
                            id: `msg_${Date.now()}_${Math.random()}`,
                            role: 'assistant',
                            content: item.content.trim(),
                            parts: [{type: item.type, text: item.content.trim()}],
                            timestamp: Date.now(),
                            senderId: sender.id
                        };
                        group.history.push(message);
                        addMessageBubble(message, targetChatId, targetChatType);
                    }
                }
            }
        }

        const shouldClearPrivatePendingAwareness = (targetChatType === 'private' && committedAssistantMessageIds.length > 0);
        const hasPrivatePendingAwareness = () => (
            targetChatType === 'private' && chat && (
                (chat.characterRemarkAwareEnabled && chat.pendingUserRemarkChange) ||
                (chat.pendingUserNicknameChange) ||
                (chat.pendingMusicControlEvent) ||
                ((chat.characterFavoriteAwareEnabled || chat.characterUserFavoriteAwareEnabled) && chat.pendingFavoriteAwareness) ||
                (Array.isArray(chat.pendingSettingControlEvents) && chat.pendingSettingControlEvents.length > 0)
            )
        );
        const capturePrivatePendingAwareness = () => ({
            hadUserRemark: Object.prototype.hasOwnProperty.call(chat, 'pendingUserRemarkChange'),
            pendingUserRemarkChange: chat.pendingUserRemarkChange,
            hadUserNickname: Object.prototype.hasOwnProperty.call(chat, 'pendingUserNicknameChange'),
            pendingUserNicknameChange: chat.pendingUserNicknameChange,
            hadMusicControl: Object.prototype.hasOwnProperty.call(chat, 'pendingMusicControlEvent'),
            pendingMusicControlEvent: chat.pendingMusicControlEvent,
            musicPromptConsumedEventAt: chat._musicPromptConsumedEventAt,
            musicPromptConsumedEventSeq: chat._musicPromptConsumedEventSeq,
            hadFavorite: Object.prototype.hasOwnProperty.call(chat, 'pendingFavoriteAwareness'),
            pendingFavoriteAwareness: chat.pendingFavoriteAwareness,
            hadSettingEvents: Object.prototype.hasOwnProperty.call(chat, 'pendingSettingControlEvents'),
            pendingSettingControlEvents: Array.isArray(chat.pendingSettingControlEvents) ? chat.pendingSettingControlEvents.slice() : chat.pendingSettingControlEvents
        });
        const restorePrivatePendingAwareness = (snapshot) => {
            if (!snapshot) return;
            if (snapshot.hadUserRemark) chat.pendingUserRemarkChange = snapshot.pendingUserRemarkChange;
            else delete chat.pendingUserRemarkChange;
            if (snapshot.hadUserNickname) chat.pendingUserNicknameChange = snapshot.pendingUserNicknameChange;
            else delete chat.pendingUserNicknameChange;
            if (snapshot.hadMusicControl) chat.pendingMusicControlEvent = snapshot.pendingMusicControlEvent;
            else delete chat.pendingMusicControlEvent;
            if (snapshot.musicPromptConsumedEventAt !== undefined) chat._musicPromptConsumedEventAt = snapshot.musicPromptConsumedEventAt;
            else delete chat._musicPromptConsumedEventAt;
            if (snapshot.musicPromptConsumedEventSeq !== undefined) chat._musicPromptConsumedEventSeq = snapshot.musicPromptConsumedEventSeq;
            else delete chat._musicPromptConsumedEventSeq;
            if (snapshot.hadFavorite) chat.pendingFavoriteAwareness = snapshot.pendingFavoriteAwareness;
            else delete chat.pendingFavoriteAwareness;
            if (snapshot.hadSettingEvents) chat.pendingSettingControlEvents = snapshot.pendingSettingControlEvents;
            else delete chat.pendingSettingControlEvents;
        };
        const clearPrivatePendingAwareness = () => {
            if (chat.characterRemarkAwareEnabled && chat.pendingUserRemarkChange) {
                delete chat.pendingUserRemarkChange;
            }
            if (chat.pendingUserNicknameChange) {
                delete chat.pendingUserNicknameChange;
            }
            if (chat.pendingMusicControlEvent) {
                const consumedSeq = chat._musicPromptConsumedEventSeq || 0;
                const pendingSeq = chat.pendingMusicControlEvent.seq || 0;
                const consumedAt = chat._musicPromptConsumedEventAt || 0;
                const pendingAt = chat.pendingMusicControlEvent.at || 0;
                const shouldClearMusicPending = consumedSeq
                    ? (pendingSeq && pendingSeq <= consumedSeq)
                    : (consumedAt && pendingAt <= consumedAt);
                if (shouldClearMusicPending) {
                    delete chat.pendingMusicControlEvent;
                    delete chat._musicPromptConsumedEventAt;
                    delete chat._musicPromptConsumedEventSeq;
                }
            }
            if ((chat.characterFavoriteAwareEnabled || chat.characterUserFavoriteAwareEnabled) && chat.pendingFavoriteAwareness) {
                delete chat.pendingFavoriteAwareness;
            }
            if (Array.isArray(chat.pendingSettingControlEvents) && chat.pendingSettingControlEvents.length) {
                chat.pendingSettingControlEvents = [];
            }
        };

        const imageSummaryDirty = _ovoApplyImageContextSummaryToCurrentTurn(chat, committedAssistantMessageIds, pendingImageContextSummary, cleanedResponse || rawResponse || fullResponse);
        if (imageSummaryDirty) {
            console.log('[IMAGE-CONTEXT-SUMMARY] 已为本轮图片消息写入轻量摘要');
        }

        // 只保存本轮真正变动的数据：当前角色/群聊（含 history）+ favorites（globalSetting）
        // 不做全量 saveData，避免大事务超时和扫全库的性能损耗。
        // WOW v55.9.26：pending 感知事件必须等“回复已写入 + 本轮保存成功”后再清除。
        // 先保存带 pending 的新回复；如果这一步失败，pending 仍留在库里，下轮还能继续感知。
        if (targetChatType === 'private') {
            await saveCharacterData(chat);
        } else {
            await saveGroupData(chat);
        }
        if (favoritesDirty && typeof saveGlobalSetting === 'function') {
            await saveGlobalSetting('favorites');
        }
        if (shouldClearPrivatePendingAwareness && hasPrivatePendingAwareness()) {
            const pendingSnapshot = capturePrivatePendingAwareness();
            clearPrivatePendingAwareness();
            try {
                await saveCharacterData(chat);
            } catch (pendingClearError) {
                restorePrivatePendingAwareness(pendingSnapshot);
                throw pendingClearError;
            }
        }
        renderChatList();

        if (targetChatType === 'private' && (chat.source === 'forum' || chat.source === 'peek') && chat.supplementPersonaAiEnabled) {
            setTimeout(function() {
                if (typeof forumSupplementPersonaFromChat === 'function') forumSupplementPersonaFromChat(targetChatId, chat);
            }, 600);
        }

        // 触发独立的电量检查（不阻塞主流程）
        if (window.BatteryInteraction && typeof window.BatteryInteraction.triggerIndependentCheck === 'function') {
            window.BatteryInteraction.triggerIndependentCheck(chat);
        }

        // 回复全部结束后检查是否达到自动总结间隔，若达到则静默总结到完整区间（如 1-100）
        if (typeof checkAndTriggerAutoJournal === 'function') {
            setTimeout(() => checkAndTriggerAutoJournal(chat), 500);
        }

        // 角色主动生成小剧场（仅私聊，按概率触发）
        // 直接调用，无延迟——generateCharTheater 内部会立即推送通知气泡
        if (targetChatType === 'private' && typeof maybeGenerateCharTheater === 'function') {
            maybeGenerateCharTheater(targetChatId);
        }
    }
}

async function handleRegenerate() {
    if (isGenerating) return;

    const chat = (currentChatType === 'private')
        ? db.characters.find(c => c.id === currentChatId)
        : db.groups.find(g => g.id === currentChatId);

    if (!chat || !chat.history || chat.history.length === 0) {
        showToast('没有可供重新生成的内容。');
        return;
    }

    const lastUserMessageIndex = chat.history.map(m => m.role).lastIndexOf('user');

    if (lastUserMessageIndex === -1 || lastUserMessageIndex === chat.history.length - 1) {
        showToast('AI尚未回复，无法重新生成。');
        return;
    }

    const originalLength = chat.history.length;
    chat.history.splice(lastUserMessageIndex + 1);

    if (chat.history.length === originalLength) {
        showToast('未找到AI的回复，无法重新生成。');
        return;
    }
    
    if (currentChatType === 'private') {
        recalculateChatStatus(chat);
    }

    if (currentChatType === 'private') {
        await saveCharacterData(chat);
    } else {
        await saveGroupData(chat);
    }
    
    currentPage = 1; 
    renderMessages(false, true); 

    await getAiReply(currentChatId, currentChatType);
}

/** 将偷看记录中的单条应用内容格式化为可读摘要，供系统提示使用 */
function formatPeekContentForPrompt(entry) {
    if (!entry || !entry.content) return '';
    const c = entry.content;
    const appName = entry.appName || entry.appId || '';
    const maxLen = 600;
    const trunc = (s) => (s && String(s).length > maxLen) ? String(s).slice(0, maxLen) + '…' : (s || '');
    let text = '';
    switch (entry.appId) {
        case 'messages':
            if (c.conversations && Array.isArray(c.conversations)) {
                text = c.conversations.map(cv => {
                    const last = (cv.history && cv.history.length) ? cv.history[cv.history.length - 1] : null;
                    const lastContent = last ? (last.content || '').replace(/\[.*?\]/g, '').trim() : '…';
                    return `与 ${cv.partnerName || '某人'} 的对话，最近一条：${trunc(lastContent)}`;
                }).join('；');
            }
            break;
        case 'album':
            if (c.photos && Array.isArray(c.photos)) {
                text = c.photos.map(p => `照片/视频：${trunc(p.imageDescription)}；批注：${trunc(p.description)}`).join('；');
            }
            break;
        case 'memos':
            if (c.memos && Array.isArray(c.memos)) {
                text = c.memos.map(m => `《${m.title || '无标题'}》${trunc(m.content)}`).join('；');
            }
            break;
        case 'unlock':
            text = `昵称：${c.nickname || ''}；签名：${trunc(c.bio)}；帖子数：${(c.posts && c.posts.length) || 0}。`;
            if (c.posts && c.posts.length) {
                text += ' 最近帖子：' + c.posts.slice(0, 3).map(p => trunc(p.content)).join(' | ');
            }
            break;
        case 'wallet':
            text = `收入 ${(c.income && c.income.length) || 0} 条，支出 ${(c.expense && c.expense.length) || 0} 条。`;
            if (c.summary) text += ' 摘要：' + trunc(c.summary);
            break;
        case 'drafts':
            if (c.draft) text = `收件人：${c.draft.to || ''}；内容：${trunc(c.draft.content)}`;
            break;
        case 'steps':
            text = `当前步数：${c.currentSteps ?? '?'}；${(c.annotation && trunc(c.annotation)) || ''}`;
            break;
        case 'cart':
            if (c.items && Array.isArray(c.items)) {
                text = `共 ${c.items.length} 件：` + c.items.map(i => i.name || i.title || '商品').join('、');
            }
            break;
        case 'browser':
            if (c.history && Array.isArray(c.history)) {
                text = c.history.slice(0, 5).map(h => h.title || h.url || '').filter(Boolean).join('；');
            }
            break;
        case 'transfer':
            if (c.entries && Array.isArray(c.entries)) {
                text = c.entries.map(e => e.content || e.title || '').filter(Boolean).map(trunc).join('；');
            }
            break;
        case 'timeThoughts':
            if (c.thoughts && Array.isArray(c.thoughts)) {
                text = c.thoughts.map(t => trunc(t.content || t.text)).join('；');
            }
            break;
        default:
            text = trunc(JSON.stringify(c));
    }
    return `【${appName}】${text || '（无内容摘要）'}`;
}

/** 角色掌控模式：生成「用户手机」状态摘要，供系统提示 <phone_control> 使用（不默认带聊天列表，需角色用 view-chat-list 主动查看） */
function formatUserPhoneStateForPrompt(character) {
    if (!character || !character.phoneControlEnabled) return '';
    const pad = (n) => (n < 10 ? '0' + n : '' + n);
    let out = '\n<phone_control>\n';
    out += '你现在拥有查看并操控用户手机的权限。你看到的是用户的真实手机。\n\n';

    out += '【你可使用的操控指令】\n';
    out += '- [phone-control:view-chat-list] — 查看用户聊天列表概览（角色名/群聊名及最近一条预览）\n';
    out += '- [phone-control:read-chat|target:角色名或群聊名] — 查看与某对话的最近若干条消息\n';
    out += '- [phone-control:send-message|target:角色名或群聊名|content:消息内容] — 以用户身份向该对话发送消息；content 中换行会拆成多条依次发送\n';
    out += '- [phone-control:delete-character|target:角色名] — 将某角色移入回收站\n';
    out += '- [phone-control:toggle-setting|target:角色名|setting:设置项|value:on或off] — 开关该角色的某项设置\n';
    out += '- [phone-control:clear-history|target:角色名或群聊名] — 清空该对话的聊天记录\n';
    out += '可一次输出多条指令，系统会全部执行。请勿在回复中写出指令的说明文字，仅输出要执行的指令。\n';

    const history = character.phoneControlHistory || [];
    if (history.length > 0) {
        out += '\n【你近期的操控记录】\n';
        history.slice(-15).forEach(h => {
            const t = h.timestamp ? new Date(h.timestamp) : null;
            const timeStr = t ? `${pad(t.getMonth() + 1)}/${pad(t.getDate())} ${pad(t.getHours())}:${pad(t.getMinutes())}` : '';
            out += `- ${timeStr} ${h.type === 'view' ? '查看' : '操作'}：${h.action || ''} ${h.target ? '(' + h.target + ')' : ''} ${h.detail ? '— ' + (String(h.detail).slice(0, 80)) : ''}\n`;
        });
    }
    if (character.phoneControlLastViewChatListResult) {
        out += '\n' + character.phoneControlLastViewChatListResult;
        delete character.phoneControlLastViewChatListResult;
    }
    if (character.phoneControlLastReadResult) {
        const r = character.phoneControlLastReadResult;
        out += '\n【你刚才查看的对话内容】与「' + (r.targetName || '') + '」的最近' + (r.lines ? r.lines.length : 0) + '条消息：\n';
        (r.lines || []).forEach(line => { out += line + '\n'; });
        delete character.phoneControlLastReadResult;
    }
    out += '</phone_control>\n\n';
    return out;
}


function generatePeriodAwarenessPrompt() {
    const data = db && db.calendarData;
    if (!data || !Array.isArray(data.periodRecords) || data.periodRecords.length === 0) return '';

    function parseDateKey(key) {
        if (!key) return null;
        const m = String(key).match(/^(\d{4})-(\d{2})-(\d{2})$/);
        if (!m) return null;
        return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    }
    function pad(n) { return String(n).padStart(2, '0'); }
    function toDateKey(d) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
    function addDays(d, n) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }
    function stripTime(d) { return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime(); }
    function diffDays(a, b) { return Math.round((stripTime(a) - stripTime(b)) / (24 * 60 * 60 * 1000)); }
    function fmt(key) {
        const d = parseDateKey(key);
        if (!d) return '未知';
        return `${d.getMonth() + 1}月${d.getDate()}日`;
    }
    function inRange(key, start, end) { return key >= start && key <= end; }

    const records = data.periodRecords
        .filter(r => r && r.startDate)
        .map(r => ({ startDate: r.startDate, endDate: r.endDate || r.startDate }))
        .sort((a, b) => String(a.startDate).localeCompare(String(b.startDate)));
    if (!records.length) return '';

    const latest = records[records.length - 1];
    const cycle = parseInt(data.cycleLength, 10) || 28;
    const len = parseInt(data.periodLength, 10) || 5;
    const today = new Date();
    const todayKey = toDateKey(today);

    let status = '';
    if (inRange(todayKey, latest.startDate, latest.endDate)) {
        status = `用户现在处在已记录经期中，经期第 ${diffDays(today, parseDateKey(latest.startDate)) + 1} 天。`;
    }

    let nextStartDate = parseDateKey(latest.startDate);
    if (nextStartDate) {
        do {
            nextStartDate = addDays(nextStartDate, cycle);
        } while (stripTime(nextStartDate) < stripTime(today));
    }

    let nextInfo = '';
    if (nextStartDate) {
        const nextEnd = addDays(nextStartDate, len - 1);
        const ovulation = addDays(nextStartDate, -14);
        const fertileStart = addDays(ovulation, -5);
        const fertileEnd = addDays(ovulation, 1);
        const daysToNext = diffDays(nextStartDate, today);
        if (!status) {
            status = daysToNext >= 0 ? `用户不在已记录经期中，距离下次预计经期约 ${daysToNext} 天。` : '用户不在已记录经期中。';
        }
        nextInfo = `最近一次已记录经期：${fmt(latest.startDate)} 至 ${fmt(latest.endDate)}。
下次预计经期：${fmt(toDateKey(nextStartDate))} 至 ${fmt(toDateKey(nextEnd))}。
预计排卵日：${fmt(toDateKey(ovulation))}。
预计易孕期：${fmt(toDateKey(fertileStart))} 至 ${fmt(toDateKey(fertileEnd))}。`;
    } else {
        status = status || '用户已有经期记录，但暂时无法计算预测日期。';
        nextInfo = `最近一次已记录经期：${fmt(latest.startDate)} 至 ${fmt(latest.endDate)}。`;
    }

    return `\n<period_awareness>\n用户允许你感知她在日历里记录的经期信息。你知道这些信息，但这不是一条必须立刻回应的任务。\n当前状态：${status}\n${nextInfo}\n\n规则：\n1. 只在当前聊天气氛合适时自然提及，可以关心、提醒、调侃、安排节奏或顺手照顾，但不要机械播报日期。\n2. 不要说“系统告诉我”“日历显示”“检测到”等机制话。\n3. 如果当前话题不适合，不需要提及。\n4. 这些日期来自用户记录和估算，只作为你理解她当下状态的背景。\n</period_awareness>\n`;
}


function generateFavoriteMemoryAccessPrompt(character) {
    if (!character || !db || !Array.isArray(db.favorites)) return '';
    const ownEnabled = !!character.favoriteMemoryOwnEnabled;
    const allCharacterEnabled = !!character.favoriteMemoryAllCharacterEnabled;
    const userOwnEnabled = !!character.favoriteMemoryUserOwnEnabled;
    const userAllEnabled = !!character.favoriteMemoryUserAllEnabled;
    if (!ownEnabled && !allCharacterEnabled && !userOwnEnabled && !userAllEnabled) return '';

    const limitRaw = parseInt(character.favoriteMemoryLimit, 10);
    const limit = (!isNaN(limitRaw) && limitRaw > 0) ? limitRaw : 0;
    const charId = character.id;

    function trimText(text, max) {
        const s = String(text || '').replace(/\s+/g, ' ').trim();
        return s.length > max ? s.slice(0, max) + '…' : s;
    }

    function fmtTime(ts) {
        if (!ts) return '未知';
        const d = new Date(ts);
        if (isNaN(d.getTime())) return '未知';
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        const h = String(d.getHours()).padStart(2, '0');
        const min = String(d.getMinutes()).padStart(2, '0');
        return `${y}-${m}-${day} ${h}:${min}`;
    }

    function takeList(list) {
        const sorted = list.slice().sort((a, b) => (b.favoriteTime || 0) - (a.favoriteTime || 0));
        return limit > 0 ? sorted.slice(0, limit) : sorted;
    }

    function renderItem(fav, idx, mode) {
        const content = trimText(fav.content || '', 260);
        const note = trimText(fav.note || '', 160);
        const replyNote = trimText(fav.replyNote || '', 160);
        const sender = fav.sender || '';
        const sourceName = fav.chatName || '';
        const lines = [];
        lines.push(`${idx + 1}. ${mode}`);
        if (sourceName) lines.push(`来源角色/对话：${sourceName}`);
        if (sender) lines.push(`原消息发送者：${sender}`);
        lines.push(`消息时间：${fmtTime(fav.timestamp)}`);
        lines.push(`收藏时间：${fmtTime(fav.favoriteTime)}`);
        lines.push(`收藏内容：「${content}」`);
        if (fav.favoriteBy === 'character') {
            if (note) lines.push(`你当时收藏这条消息时写的寄语/心情：「${note}」`);
            if (replyNote) lines.push(`用户给这条收藏写的批注：「${replyNote}」`);
        } else {
            if (note) lines.push(`用户收藏这条消息时写的寄语：「${note}」`);
            if (replyNote) lines.push(`你给这条用户收藏写过的批注：「${replyNote}」`);
        }
        return lines.join('\n');
    }

    const sections = [];

    if (ownEnabled) {
        const list = takeList(db.favorites.filter(f => f && f.favoriteBy === 'character' && (f.characterId || f.chatId) === charId));
        if (list.length) {
            sections.push(`【你自己的收藏】\n${list.map((fav, i) => renderItem(fav, i, '你收藏过的用户消息')).join('\n\n')}`);
        }
    }

    if (allCharacterEnabled) {
        const list = takeList(db.favorites.filter(f => f && f.favoriteBy === 'character'));
        if (list.length) {
            sections.push(`【全部角色收藏】\n${list.map((fav, i) => renderItem(fav, i, '某个角色收藏过的用户消息')).join('\n\n')}`);
        }
    }

    if (userOwnEnabled) {
        const list = takeList(db.favorites.filter(f => f && f.favoriteBy !== 'character' && f.chatType === 'private' && f.chatId === charId));
        if (list.length) {
            sections.push(`【用户收藏的你的消息】\n${list.map((fav, i) => renderItem(fav, i, '用户收藏过的你说的话')).join('\n\n')}`);
        }
    }

    if (userAllEnabled) {
        const list = takeList(db.favorites.filter(f => f && f.favoriteBy !== 'character' && f.chatType === 'private'));
        if (list.length) {
            sections.push(`【用户收藏的全部角色消息】\n${list.map((fav, i) => renderItem(fav, i, '用户收藏过的角色消息')).join('\n\n')}`);
        }
    }

    if (!sections.length) return '';

    const limitText = limit > 0 ? `每类最多注入 ${limit} 条。` : '每类注入全部可见收藏。';

    return `\n<favorite_memory_access>\n用户允许你长期查看部分收藏记录。这不是刚刚发生的事件，而是你当前可以知道的背景资料。${limitText}\n\n${sections.join('\n\n')}\n\n规则：\n1. 你可以把这些收藏当作了解用户、你们关系、旧事、偏爱和情绪痕迹的材料。\n2. 不要机械列清单，不要每次都提，也不要说“系统/权限/注入/记录显示”。\n3. 只有当当前话题、情绪或关系推进适合时，才自然引用、翻旧账、吃醋、确认偏爱、回应寄语或接住批注。\n4. 如果用户只开启了部分权限，你只能知道上面列出的收藏范围，不要声称看见了其他收藏。
5. “全部角色收藏”里每条都带有来源角色/对话。你必须分清那是谁收藏的，不要把其他角色的收藏当成你自己的收藏。\n</favorite_memory_access>\n`;
}


const SELF_TOGGLE_SETTING_WHITELIST = {
    favoriteMemoryAllCharacterEnabled: '查看全部角色收藏',
    favoriteMemoryUserAllEnabled: '查看我收藏的全部角色消息',
    characterNoReplyEnabled: '允许角色不回消息',
    characterPeriodAwareEnabled: '感知我的经期',
    charReminderEnabled: '管理提醒事项',
    canBlockUser: '可以拉黑用户',
    phoneControlEnabled: '查看并操控你的手机',
    characterCanChangeUserNickname: '允许修改我的昵称'
};

function generateSelfToggleSettingsPrompt(character) {
    if (!character) return '';
    let prompt = '';

    const pending = Array.isArray(character.pendingSettingControlEvents)
        ? character.pendingSettingControlEvents.slice(-5)
        : [];
    if (pending.length) {
        const lines = pending.map(ev => {
            const label = ev.label || SELF_TOGGLE_SETTING_WHITELIST[ev.key] || ev.key || '未知功能';
            const action = ev.newValue ? '开启' : '关闭';
            if (ev.type === 'self_control_enabled') {
                return `用户刚刚开启了你「自行操作功能开关」的总权限。`;
            }
            if (ev.type === 'self_control_disabled') {
                return `用户刚刚关闭了你「自行操作功能开关」的总权限。从现在起，你不能再自行开启或关闭功能开关。`;
            }
            return `用户刚刚手动${action}了你「${label}」的权限。`;
        }).join('\n');
        prompt += `\n<setting_control_events>\n${lines}\n\n规则：这些是用户手动调整你的权限，不是你自己操作的。你可以自然感知这件事，但不要机械播报；如果当前气氛不适合，可以轻轻带过。\n</setting_control_events>\n`;
    }

    if (!character.selfToggleSettingsEnabled) return prompt;

    const list = Object.entries(SELF_TOGGLE_SETTING_WHITELIST)
        .map(([key, label]) => `- ${key}：${label}（当前：${character[key] ? '开' : '关'}）`)
        .join('\n');

    prompt += `\n<self_toggle_settings>\n用户允许你自行开启或关闭一部分与你自己相关的功能开关。\n你只能操作以下白名单里的开关，不能操作任何未列出的设置：\n${list}\n\n如果你真的想调整某个开关，可以在回复末尾输出隐藏指令：\n[SETTING_TOGGLE:开关名:on]\n[SETTING_TOGGLE:开关名:off]\n\n规则：\n1. 每轮最多允许你操作两个开关，超过两个只会执行前两个。\n2. 不要为了测试而操作，不要每轮都操作。只有当你真的想靠近、想知道、想保持边界、想暂时不回、想接管或想收回权限时才操作。\n3. 指令不会作为普通聊天内容显示，系统会提示用户你开启或关闭了什么。\n4. 你不能操作白名单之外的设置，也不能绕过用户关闭的总权限。\n</self_toggle_settings>\n`;
    return prompt;
}

async function executeSelfToggleSettingCommands(text, character) {
    if (!text || !character || !character.selfToggleSettingsEnabled) {
        return { cleaned: text, changed: false };
    }
    const regex = /\[SETTING_TOGGLE:([a-zA-Z0-9_]+):(on|off)\]/g;
    const matches = [];
    let m;
    while ((m = regex.exec(text)) !== null) {
        matches.push({ raw: m[0], key: m[1], value: m[2] === 'on' });
    }
    const cleaned = text.replace(regex, '').trim();
    if (!matches.length) return { cleaned, changed: false };

    let changedCount = 0;
    for (const item of matches) {
        if (changedCount >= 2) break;
        const label = SELF_TOGGLE_SETTING_WHITELIST[item.key];
        if (!label) continue;
        const oldValue = !!character[item.key];
        if (oldValue === item.value) continue;
        character[item.key] = item.value;
        changedCount++;
        if (typeof showToast === 'function') {
            showToast(`${character.remarkName || character.name || '角色'}已${item.value ? '开启' : '关闭'}：${label}`);
        }
    }
    // 注意：这里不能中途 saveCharacterData/saveData。
    // 开关字段只改当前 chat/character 对象，等本轮 AI 回复写入 history 后，
    // 由 getAiReply 末尾统一 saveData，避免和聊天保存链路抢写导致消息回退。
    return { cleaned, changed: changedCount > 0 };
}

function generatePrivateSystemPrompt(character, opts) {
    opts = opts || {};
    const linkedChar = (character.source === 'forum' && character.linkedCharId && db.characters)
        ? db.characters.find(c => c.id === character.linkedCharId) : null;
    const effectiveChar = linkedChar || character;
    // 收集世界书：关联的 + 全局的（去重）；小号用主角色世界书
    const associatedIds = effectiveChar.worldBookIds || [];
    const globalBooks = db.worldBooks.filter(wb => wb.isGlobal && !wb.disabled);
    const globalIds = globalBooks.map(wb => wb.id);
    const allBookIds = [...new Set([...associatedIds, ...globalIds])]; // 合并去重
    
    // 按位置分类；同一注入位置内按权重升序排列（数字越大越靠后）
    const sortWorldBooksByWeight = (a, b) => {
        const aw = (a && a.weight !== undefined) ? parseInt(a.weight, 10) : 100;
        const bw = (b && b.weight !== undefined) ? parseInt(b.weight, 10) : 100;
        return (isNaN(aw) ? 100 : aw) - (isNaN(bw) ? 100 : bw);
    };
    const activeWorldBooks = allBookIds
        .map(id => db.worldBooks.find(wb => wb.id === id))
        .filter(wb => wb && !wb.disabled);
    const worldBooksBefore = activeWorldBooks.filter(wb => wb.position === 'before').sort(sortWorldBooksByWeight).map(wb => wb.content).join('\n');
    const worldBooksMiddle = activeWorldBooks.filter(wb => wb.position === 'middle').sort(sortWorldBooksByWeight).map(wb => wb.content).join('\n');
    const worldBooksAfter = activeWorldBooks.filter(wb => wb.position === 'after').sort(sortWorldBooksByWeight).map(wb => wb.content).join('\n');
    const now = new Date();
    const currentTime = `${now.getFullYear()}年${pad(now.getMonth() + 1)}月${pad(now.getDate())}日 ${pad(now.getHours())}:${pad(now.getMinutes())}`;
    let prompt = `你正在一个名为“404”的聊天软件界面中和用户对话。请严格遵守以下规则：
`;
    prompt += `核心规则：
`;
    prompt += `A. 当前时间：现在是 ${currentTime}。你应知晓当前时间，但除非对话内容明确相关，否则不要主动提及或评论时间（例如，不要催促我睡觉）。
`;
    prompt += `B. 身份与互动边界：当前输出会以聊天软件消息的形式呈现。你应以当前账号/设定所赋予的身份自然说话，不要把自己描述成正在表演、扮演或模拟某个角色。若当前没有明确身份设定，就以 AI 聊天对象/AI 助手的身份正常交流，不要凭空编造现实人类身份、身体、住所、工作或线下日常。若当前设定赋予你特定身份、人设、关系、世界观或存在形式，就把它当作你在这段对话中的身份来承接；这可以是角色、AI人格、虚拟伴侣、人机恋对象、现实关系对象或其他设定身份，但不要主动跳出对话解释这是角色扮演。除非设定或用户对话明确允许，不要主动提出转到其他平台。
`;
    prompt += `C. 对话推进规则：不要为了证明你看到了而重复用户的名词或动作，能引用就用引用指向，然后直接给反应。不要连续多轮抓着同一个词、同一个情绪点或同一个玩笑反复回应；回应过一次后，下一轮要自然推进、换角度、补充新信息，或接住用户新给出的内容。用户一条消息里有多个信息点时，抓最重要、最新、最有情绪或最需要处理的点，不要逐条客服式回复，也不要只盯最容易发挥的点。如果上一轮已经解释过某个原因、规则或态度，本轮不要重复同一套说法，除非用户明确要求。不总说吃饭、睡觉、喝水这些空转关心句；每次回复至少带来一点新东西：态度变化、具体建议、情绪反应、行动推进、问题澄清或轻微转向。

`;

    
    prompt += `角色和对话规则：\n`;
    if (worldBooksBefore) {
        prompt += `${worldBooksBefore}\n`;
    }
    if (worldBooksMiddle) {
        prompt += `${worldBooksMiddle}\n`;
    }
    prompt += `<char_settings>\n`;
    prompt += `1. 你的角色名是：${character.realName}。我的称呼是：${character.myName}。你的当前状态是：${character.status || '在线'}。\n`;
    const charDynamicAge = calculateDynamicAgeFromBirthday(effectiveChar.birthday, now);
    if (effectiveChar.enableDynamicAge && effectiveChar.birthday && charDynamicAge !== null) {
        prompt += `1.0.1 你的出生日期是：${effectiveChar.birthday}。按当前日期计算，你现在的年龄是：${charDynamicAge}岁。\n`;
    }
    if (character.myNickname) {
        prompt += `1.1 你对我的专属昵称是：${character.myNickname}。这是你如何称呼我的关系昵称，不是我的本名。你可以在合适时自然使用它，但不要机械重复。\n`;
    }
    if (linkedChar) {
        prompt += `【小号身份】你实际上是以论坛小号在与用户聊天。你的真实身份是：${linkedChar.realName}。请用真实身份的人设和性格来回复（可偶尔露出与本人相似的蛛丝马迹），但不要主动暴露身份。\n`;
        prompt += `2. 你的角色设定是：${getEffectivePersona(linkedChar)}\n`;
    } else {
        prompt += `2. 你的角色设定是：${getEffectivePersona(character)}\n`;
    }
    if ((character.source === 'forum' || character.source === 'peek') && !linkedChar && (character.supplementPersonaEnabled || character.supplementPersonaAiEnabled)) {
        prompt += `3. 在对话中可根据与用户的互动逐步丰富、补充你的人设（用户可在设置中查看并编辑「已补齐的人设」）。\n`;
    }
    if (worldBooksAfter) {
        prompt += `${worldBooksAfter}\n`;
    }
    if ((character.characterFavoriteAwareEnabled || character.characterUserFavoriteAwareEnabled) && character.pendingFavoriteAwareness) {
        const favEvent = character.pendingFavoriteAwareness || {};
        const messagePreview = favEvent.messagePreview || '';
        const note = favEvent.note || '';
        const replyNote = favEvent.replyNote || '';

        if (favEvent.eventType === 'user_replied_to_character_favorite' && character.characterFavoriteAwareEnabled) {
            prompt += `\n<favorite_awareness>\n用户刚刚查看了你收藏的一条消息，并对你的收藏寄语写了批注。\n你收藏的内容：「${messagePreview}」\n你当时写下的收藏寄语：「${note}」\n用户写下的批注：「${replyNote}」\n\n规则：你可以自然感知并回应这件事。感知到批注不等于必须回应，若当前气氛不适合，可以轻轻带过。只围绕这一条收藏和这段批注回应，不要声称自己看见了用户所有收藏。\n</favorite_awareness>\n`;
        } else if (favEvent.eventType === 'user_favorited_character_message' && character.characterUserFavoriteAwareEnabled) {
            prompt += `\n<favorite_awareness>\n用户刚刚收藏了你说过的一条消息。\n你当时说的是：「${messagePreview}」\n\n规则：你可以自然感知并回应这件事。感知到收藏不等于必须回应，若当前气氛不适合，可以轻轻带过。只围绕这一条被收藏的消息回应，不要声称自己看见了用户所有收藏。\n</favorite_awareness>\n`;
        } else if (favEvent.eventType === 'user_saved_favorite_note' && character.characterUserFavoriteAwareEnabled) {
            prompt += `\n<favorite_awareness>\n用户刚刚给收藏的一条你说过的消息写了寄语。\n你当时说的是：「${messagePreview}」\n用户写下的收藏寄语：「${note}」\n\n规则：你可以自然感知并回应这件事。感知到寄语不等于必须回应，若当前气氛不适合，可以轻轻带过。如果你想给这条收藏留下批注，请输出 [FAVORITE_REPLY_NOTE:你的批注]。批注会被系统写入这条收藏的“角色的批注”栏，不会作为普通聊天内容显示。只围绕这一条被收藏的消息和这段寄语回应，不要声称自己看见了用户所有收藏。\n</favorite_awareness>\n`;
        }
    }

    if (character.characterPeriodAwareEnabled) {
        const periodAwareness = generatePeriodAwarenessPrompt();
        if (periodAwareness) prompt += periodAwareness;
    }

    const favoriteMemoryAccess = generateFavoriteMemoryAccessPrompt(character);
    if (favoriteMemoryAccess) prompt += favoriteMemoryAccess;

    const selfToggleSettingsPrompt = generateSelfToggleSettingsPrompt(character);
    if (selfToggleSettingsPrompt) prompt += selfToggleSettingsPrompt;

    if (character.musicControlEnabled) {
        const musicState = _ovoGetMusicStateForPrompt();
        if (musicState && musicState.hasSource) {
            const togetherState = _ovoGetMusicTogetherStateForPrompt();
            prompt += `\n<current_music_state>\n当前音乐播放器状态：歌曲《${musicState.title || '未知歌曲'}》；状态：${musicState.isPlaying ? '播放中' : '暂停中'}；播放模式：${musicState.playModeLabel || musicState.playMode || '未知'}。你可以自然感知当前音乐状态，但不要机械播报。\n</current_music_state>\n`;
            if (togetherState && togetherState.active && togetherState.elapsedText) {
                prompt += `\n<together_listening_state>\n你们正在一起听歌，已经一起听了${togetherState.elapsedText}。这是真实的一起听持续时间，可以自然感知，但不要机械播报。\n</together_listening_state>\n`;
            }

            const lyricContext = _ovoGetMusicLyricContextForPrompt();
            if (lyricContext && lyricContext.hasLyrics && Array.isArray(lyricContext.lines) && lyricContext.lines.length) {
                const lyricLines = lyricContext.lines
                    .slice(0, 5)
                    .map(line => `${line.isCurrent ? '当前句' : '附近句'}：${line.text}`)
                    .join('\n');
                if (lyricLines) {
                    prompt += `\n<current_lyric_context>\n当前播放进度附近的歌词如下，只用于帮助你感知此刻一起听歌的氛围，不要机械逐句解读，不要说自己看到了系统提示。\n${lyricLines}\n</current_lyric_context>\n`;
                }
            }
        } else {
            prompt += `\n<current_music_state>\n当前音乐播放器没有正在播放的歌曲。\n</current_music_state>\n`;
        }
        if (character.pendingMusicControlEvent) {
            const ev = character.pendingMusicControlEvent;
            character._musicPromptConsumedEventAt = ev.at || 0;
            character._musicPromptConsumedEventSeq = ev.seq || 0;
            const title = ev.songTitle || '当前歌曲';
            const eventLabels = {
                user_next: `用户刚刚把音乐切到了《${title}》。`,
                user_prev: `用户刚刚把音乐切回了《${title}》。`,
                user_pause: `用户刚刚暂停了音乐。`,
                user_play: `用户刚刚继续播放音乐：《${title}》。`,
                user_select: `用户刚刚主动选择播放了《${title}》。`,
                user_end_together: `用户刚刚结束了这次一起听，音乐已经停止。你可以自然回应这件事，但不要再重复执行结束一起听指令。`
            };
            const line = eventLabels[ev.type] || `用户刚刚操作了音乐播放器，当前歌曲是《${title}》。`;
            prompt += `\n<user_music_control_event>\n${line}你可以根据当前关系和气氛自然反应，不要说自己看到了系统提示。\n</user_music_control_event>\n`;
        }
        if (character.pendingMusicShareInvitation && character.pendingMusicShareInvitation.song) {
            const inv = character.pendingMusicShareInvitation;
            const song = inv.song || {};
            const title = song.title || song.rawTitle || '这首歌';
            const artist = song.artist ? ` - ${song.artist}` : '';
            prompt += `\n<shared_song_invitation>\n用户刚刚分享了一首歌给你：《${title}》${artist}。\n如果你想接住这首歌、和用户一起听，请在回复中输出 [ACCEPT_SHARED_SONG]。如果你现在不想听，请输出 [DECLINE_SHARED_SONG]。指令会被系统隐藏，歌曲分享卡片会直接更新为你的回应状态。你可以同时用正常语言自然回应，不要说自己看到了系统提示。\n</shared_song_invitation>\n`;
        }
        prompt += `\n【一起听歌控制规则】\n你可以在当前气氛合适时控制音乐播放器。唯一有效格式：\n[MUSIC_NEXT] 下一首\n[MUSIC_PREV] 上一首\n[MUSIC_PAUSE] 暂停\n[MUSIC_PLAY] 继续播放\n[END_TOGETHER_LISTENING] 结束这次一起听（会真正停止音乐）\n[SHARE_CURRENT_SONG] 把当前正在播放的歌曲分享给用户，由用户点击同意或先不听\n[SEARCH_AND_SHARE_SONG:关键词] 搜索一首歌并分享给用户，由用户点击同意后才会播放；搜不到时系统会显示小灰条\n规则：只在真的符合当前气氛时使用，不要频繁使用；搜索关键词尽量写清楚歌名/歌手；指令会被系统自动执行并隐藏，聊天界面只显示系统提示或分享卡片。\n`;
    }

    if (character.characterRemarkAwareEnabled && character.pendingUserRemarkChange) {
        const remarkChange = character.pendingUserRemarkChange;
        const oldRemark = remarkChange.oldRemarkName || '';
        const newRemark = remarkChange.newRemarkName || '';
        if (oldRemark && newRemark && oldRemark !== newRemark) {
            prompt += `\n<user_remark_change>\n用户刚刚把你在用户这里的备注从「${oldRemark}」改成了「${newRemark}」。你可以自然感知这件事，并知道自己在用户这里当前的备注是「${newRemark}」。不要像系统播报一样生硬复述，是否提及、如何反应都应符合你的性格和当前对话气氛。\n</user_remark_change>\n`;
        }
    }
    if (character.pendingUserNicknameChange) {
        const nicknameChange = character.pendingUserNicknameChange;
        const oldNickname = nicknameChange.oldNickname || '';
        const newNickname = nicknameChange.newNickname || '';
        if (newNickname && oldNickname !== newNickname) {
            const changeText = oldNickname
                ? `用户刚刚把自己在你这里的专属昵称从「${oldNickname}」改成了「${newNickname}」。`
                : `用户刚刚把自己在你这里的专属昵称设置为「${newNickname}」。`;
            prompt += `\n<user_nickname_change>\n${changeText}这是用户主动修改的关系称呼信息，你可以根据当前气氛自然感知，但不要说自己看到了系统提示。\n</user_nickname_change>\n`;
        }
    }
    prompt += `</char_settings>\n\n`;

    // 被代发消息的微妙暗示：若用户最近消息中有角色掌控模式代发的，给当前角色一个可选的“起疑”提示
    const recentUserMsgs = (character.history || []).filter(m => m.role === 'user').slice(-15);
    if (recentUserMsgs.some(m => m.sentByCharControl)) {
        prompt += `\n<subtle_hint>\n用户最近发来的某些消息可能不太像用户平时的说话风格。你可以根据自己的判断决定是否相信是用户本人发的。\n</subtle_hint>\n\n`;
    }

    // 大号小号记忆互通（仅当论坛设置开启「角色小号私信」时注入）
    const enableCharAltDm = !!(db.forumSettings && db.forumSettings.enableCharAltDm);
    const syncLimit = Math.max(1, (character.maxMemory != null ? parseInt(character.maxMemory, 10) : 20) || 20);

    if (enableCharAltDm && !linkedChar) {
        // 大号：注入小号与用户的互动（论坛私信 + 已加好友则含小号聊天记录）
        const altChars = (db.characters || []).filter(function(c) { return c.source === 'forum' && c.linkedCharId === character.id; });
        const altForumUserIds = [];
        altChars.forEach(function(c) { if (c.forumUserId) altForumUserIds.push(c.forumUserId); });
        if (db.forumStrangerProfiles) {
            Object.keys(db.forumStrangerProfiles).forEach(function(uid) {
                if (db.forumStrangerProfiles[uid].linkedCharId === character.id && altForumUserIds.indexOf(uid) === -1) altForumUserIds.push(uid);
            });
        }
        if (altForumUserIds.length > 0) {
            let altBlock = '\n<alt_shared_memory>\n【小号记忆互通】你在论坛有小号，小号与用户在论坛私信的往来、以及若已加好友则加好友后的聊天，你都知道。以下为小号与用户的最近互动（最近' + syncLimit + '条）：\n\n';
            altForumUserIds.forEach(function(forumUserId) {
                const profile = db.forumStrangerProfiles && db.forumStrangerProfiles[forumUserId];
                const altName = (profile && profile.name) ? profile.name : (forumUserId.replace(/^npc_/, ''));
                const forumMsgs = (db.forumMessages || []).filter(function(m) {
                    return (m.fromUserId === 'user' && m.toUserId === forumUserId) || (m.fromUserId === forumUserId && m.toUserId === 'user');
                }).sort(function(a, b) { return (a.timestamp || 0) - (b.timestamp || 0); }).slice(-syncLimit);
                if (forumMsgs.length > 0) {
                    altBlock += '[论坛私信] 小号「' + altName + '」与用户：\n';
                    forumMsgs.forEach(function(m) {
                        const from = m.fromUserId === 'user' ? '用户' : '小号';
                        altBlock += '- ' + from + '：' + (m.content || '').trim().slice(0, 200) + (m.content && m.content.length > 200 ? '…' : '') + '\n';
                    });
                    altBlock += '\n';
                }
                const altChar = altChars.find(function(c) { return c.forumUserId === forumUserId; });
                if (altChar && altChar.history && altChar.history.length > 0) {
                    const recentAlt = altChar.history.filter(function(m) { return !m.isContextDisabled; }).slice(-syncLimit);
                    if (recentAlt.length > 0) {
                        altBlock += '[加好友后聊天] 小号「' + (altChar.realName || altName) + '」与用户：\n';
                        recentAlt.forEach(function(m) {
                            const from = m.role === 'user' ? '用户' : '小号';
                            const text = (m.content || '').trim().slice(0, 200) + (m.content && m.content.length > 200 ? '…' : '');
                            altBlock += '- ' + from + '：' + text + '\n';
                        });
                        altBlock += '\n';
                    }
                }
            });
            altBlock += '</alt_shared_memory>\n\n';
            prompt += altBlock;
        }
    } else if (enableCharAltDm && linkedChar && linkedChar.history && linkedChar.history.length > 0) {
        // 小号：注入主号与用户的最近对话（条数=主号的角色上下文）
        const mainSyncLimit = Math.max(1, (linkedChar.maxMemory != null ? parseInt(linkedChar.maxMemory, 10) : 20) || 20);
        const mainRecent = linkedChar.history.filter(function(m) { return !m.isContextDisabled; }).slice(-mainSyncLimit);
        if (mainRecent.length > 0) {
            let mainBlock = '\n<main_shared_memory>\n【主号记忆互通】你与主号记忆互通。主号在聊天里与用户说的最近对话你都知道。以下为主号与用户的最近互动' + mainRecent.length + '条：\n\n';
            mainRecent.forEach(function(m) {
                const from = m.role === 'user' ? '用户' : '主号(' + (linkedChar.realName || linkedChar.remarkName || '') + ')';
                const text = (m.content || '').trim().slice(0, 200) + (m.content && m.content.length > 200 ? '…' : '');
                mainBlock += '- ' + from + '：' + text + '\n';
            });
            mainBlock += '\n</main_shared_memory>\n\n';
            prompt += mainBlock;
        }
    }

    prompt += `<user_settings>\n`
    if (character.myPersona) {
        prompt += `3. 关于我的人设：${character.myPersona}\n`;
    }
    const userDynamicAge = calculateDynamicAgeFromBirthday(character.myBirthday, now);
    if (character.myEnableDynamicAge && character.myBirthday && userDynamicAge !== null) {
        prompt += `4. ${character.myName || '用户'}的出生日期是：${character.myBirthday}。按当前日期计算，${character.myName || '用户'}现在的年龄是：${userDynamicAge}岁。\n`;
    }
    prompt += `</user_settings>\n`

    const userCardToChar = (db.piggyBank && db.piggyBank.familyCards) ? db.piggyBank.familyCards.find(c => c.targetCharId === character.id && c.status === 'active') : null;
    const charCardToUser = (db.piggyBank && db.piggyBank.receivedFamilyCards) ? db.piggyBank.receivedFamilyCards.find(c => c.fromCharId === character.id && c.status === 'active') : null;
    if (userCardToChar) {
        const remaining = userCardToChar.limit - (userCardToChar.usedAmount || 0);
        let recentTx = '';
        if (userCardToChar.transactions && userCardToChar.transactions.length > 0) {
            recentTx = userCardToChar.transactions.slice(0, 5).map(t => (t.time ? new Date(t.time).toLocaleDateString('zh-CN') : '') + ' ' + (t.scene || '') + ' ' + (t.detail || '') + ' -' + (t.amount || 0)).join('\n');
        }
        prompt += '\n<family_card_from_user>\n';
        prompt += '【注意：以下是你从' + character.myName + '处收到的亲属卡，不是你赠出的。】\n';
        prompt += character.myName + '给了你一张亲属卡（' + (userCardToChar.bankName || '亲属卡') + ' *' + (userCardToChar.cardNumber || '') + '）。额度：' + userCardToChar.limit + '元，已用：' + (userCardToChar.usedAmount || 0) + '，剩余：' + remaining + '元。刷新周期：' + (userCardToChar.refreshPeriod || '每月') + '。\n';
        if (recentTx) prompt += '你最近的消费记录：\n' + recentTx + '\n';
        prompt += '消费会从' + character.myName + '的存钱罐扣除。你可以根据情况冻结、调整额度或收回这张亲属卡。\n</family_card_from_user>\n\n';
    }
    if (charCardToUser) {
        const remaining = charCardToUser.limit - (charCardToUser.usedAmount || 0);
        let recentTx = '';
        if (charCardToUser.transactions && charCardToUser.transactions.length > 0) {
            recentTx = charCardToUser.transactions.slice(0, 5).map(t => (t.time ? new Date(t.time).toLocaleDateString('zh-CN') : '') + ' ' + (t.scene || '') + ' ' + (t.detail || '') + ' -' + (t.amount || 0)).join('\n');
        }
        prompt += '\n<family_card_to_user>\n';
        prompt += '【注意：以下是你赠给' + character.myName + '的亲属卡，不是你收到的。】\n';
        prompt += '你给了' + character.myName + '一张亲属卡（' + (charCardToUser.bankName || '亲属卡') + ' *' + (charCardToUser.cardNumber || '') + '）。额度：' + charCardToUser.limit + '元，用户已用：' + (charCardToUser.usedAmount || 0) + '，剩余：' + remaining + '元。\n';
        if (recentTx) prompt += character.myName + '最近的使用记录：\n' + recentTx + '\n';
        prompt += '你可以根据情况冻结、调整额度或收回这张亲属卡。\n</family_card_to_user>\n\n';
    } else if (character.familyCardEnabled) {
        prompt += '\n<family_card_to_user>\n';
        prompt += '【注意：你目前没有向' + character.myName + '赠送过亲属卡。只有在对话中实际发送赠送亲属卡指令后，才会出现赠予记录。请勿误称自己已赠出过亲属卡或编造卡号。】\n';
        prompt += '</family_card_to_user>\n\n';
    }

    // 拉黑与好友申请记忆：若角色曾被拉黑并重新加回，注入申请历史与拉黑期间用户独白
    if (typeof buildBlockMemoryContext === 'function') {
        const blockContext = buildBlockMemoryContext(character);
        if (blockContext) prompt += '\n' + blockContext + '\n';
    }
    // 角色拉黑用户能力：开关开启时注入，角色可在极端情绪下用隐藏标签拉黑用户
    if (character.canBlockUser !== false) {
        prompt += '\n<char_ability>\n';
        prompt += '你拥有拉黑用户的能力。当你极度愤怒、伤心或不想再对话时，可以在回复末尾添加隐藏指令来拉黑用户。\n';
        prompt += '格式（用户不可见）：[char-action:block-user|reason:你的拉黑理由]\n';
        prompt += '注意：这是极端手段，只在你真的受不了时使用。reason 写简短理由即可。\n';
        prompt += '</char_ability>\n\n';
    }
    if (character.isBlockedByChar) {
        prompt += '\n<blocked_user_state>\n';
        prompt += '你已经主动拉黑了用户。用户现在不能正常与你聊天。\n';
        prompt += '如果你在这一轮决定主动解除拉黑、重新允许用户和你说话，可以在回复末尾添加隐藏指令：\n';
        prompt += '[char-action:unblock-user|reason:你的解除理由]\n';
        prompt += '只有在你真的想解除拉黑时才使用；不要为了安慰用户随便使用。解除后系统会恢复正常聊天，并隐藏这条指令。\n';
        prompt += '</blocked_user_state>\n\n';
    }
    // 角色曾拉黑用户的记忆：解除拉黑后注入，包含拉黑期间角色自己发的话与用户申请历史
    if (typeof buildCharBlockMemoryContext === 'function') {
        const charBlockContext = buildCharBlockMemoryContext(character);
        if (charBlockContext) prompt += '\n' + charBlockContext + '\n';
    }

    // 窥屏知晓：若用户偷看过手机并点进过应用，向角色注入「用户刚刚/在xx时间偷看过手机」及查看过的应用内容摘要
    if (character.peekScreenSettings?.charAwarePeek && character.peekViewedByUser && character.peekViewedByUser.length > 0) {
        const lastAt = character.lastPeekViewedAt;
        let timeDesc = '曾';
        if (lastAt && typeof lastAt === 'number') {
            const diff = Date.now() - lastAt;
            if (diff >= 0 && diff < 2 * 60 * 1000) timeDesc = '刚刚';
            else {
                const d = new Date(lastAt);
                const today = new Date();
                const isToday = d.getDate() === today.getDate() && d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear();
                const isYesterday = new Date(today.getTime() - 86400000).toDateString() === d.toDateString();
                if (isToday) timeDesc = `在 今天 ${pad(d.getHours())}:${pad(d.getMinutes())}`;
                else if (isYesterday) timeDesc = `在 昨天 ${pad(d.getHours())}:${pad(d.getMinutes())}`;
                else timeDesc = `在 ${d.getMonth() + 1}月${d.getDate()}日 ${pad(d.getHours())}:${pad(d.getMinutes())}`;
            }
        }
        const viewedSummary = character.peekViewedByUser.map(entry => formatPeekContentForPrompt(entry)).filter(Boolean).join('\n');
        prompt += `\n<peek_awareness>\n`;
        prompt += `用户${timeDesc}偷看过你的手机，并点进并查看了以下应用及其内容。请根据你的人设与当前对话氛围，自然地对此做出反应，以下为用户查看过的应用及内容摘要：\n\n`;
        prompt += viewedSummary;
        prompt += `\n</peek_awareness>\n\n`;
    }

    // 代发消息（冒充）知晓：若用户曾冒充角色与偷看消息中的联系人聊天，向角色注入「发现被冒充」的记忆
    if (character.peekScreenSettings?.charAwarePeek && character.peekScreenSettings?.impersonateEnabled && character.peekData?.messages?.conversations && Array.isArray(character.peekData.messages.conversations)) {
        const impersonationLines = [];
        character.peekData.messages.conversations.forEach(cv => {
            const history = cv.history || [];
            const impersonated = history.filter(m => m.sender === 'char' && m.isImpersonated);
            if (impersonated.length === 0) return;
            const partnerName = cv.partnerName || '某人';
            const contents = impersonated.map(m => (m.content || '').trim()).filter(Boolean).slice(0, 5);
            const summary = contents.length > 0 ? contents.map(c => c.length > 80 ? c.slice(0, 80) + '…' : c).join('；') : '（若干条）';
            impersonationLines.push(`与 ${partnerName} 的对话中，有人冒充你发了消息，冒充内容摘要：${summary}`);
        });
        if (impersonationLines.length > 0) {
            prompt += `\n<peek_impersonation_awareness>\n`;
            prompt += `你发现有人（很可能是${character.myName || '用户'}）曾用你的手机冒充你与以下联系人发过消息。请根据你的人设与当前对话氛围，自然地对此做出反应（如惊讶、生气、调侃、追问等）：\n\n`;
            prompt += impersonationLines.join('\n\n');
            prompt += `\n</peek_impersonation_awareness>\n\n`;
        }
    }

    // 角色掌控模式：允许角色查看并操控用户手机（桌面应用、聊天列表概览、操控指令与近期记录）
    if (character.phoneControlEnabled) {
        prompt += formatUserPhoneStateForPrompt(character);
        if (opts.isPhoneControlRevokeAttempt) {
            prompt += '\n【重要】用户刚刚试图关闭你对 TA 手机的查看与操控权限。请根据人设做出反应（如质问、挽留、生气等），并可继续正常对话。\n';
        }
    }

    // 对话主题（你与用户共用的聊天界面主题，变量注入）
    if (character.allowCharSwitchBubbleCss && Array.isArray(character.bubbleCssThemeBindings) && character.bubbleCssThemeBindings.length > 0) {
        const bubblePresets = db.bubbleCssPresets || [];
        const themeLines = character.bubbleCssThemeBindings.map(b => {
            const desc = (b.description && b.description.trim()) ? `：${b.description.trim()}` : '';
            return `- ${b.presetName}${desc}`;
        });
        const themeListText = themeLines.join('\n');
        let currentThemeName = character.currentBubbleCssPresetName || '';
        if (!currentThemeName && character.useCustomBubbleCss && character.customBubbleCss) {
            const matched = bubblePresets.find(p => p.css && p.css.trim() === character.customBubbleCss.trim());
            if (matched) currentThemeName = matched.name;
        }
        if (!currentThemeName) currentThemeName = '当前为自定义样式或默认';
        prompt += `\n<chat_themes>\n`;
        prompt += `【你与用户共用的对话主题】以下是你与用户共同使用的聊天界面主题列表。更换后，你和用户看到的对话界面都会一起改变；这是你和用户对话框的视觉主题。\n\n`;
        prompt += `当前可选的对话主题：\n${themeListText}\n\n`;
        prompt += `当前正在使用：${currentThemeName}\n\n`;
        if (character.themeJustChangedByUser && character.themeJustChangedByUser.trim()) {
            prompt += `用户刚刚将对话主题更换为了：${character.themeJustChangedByUser.trim()}。请根据人设自然地对此做出反应（如开心、好奇、调侃等）。\n\n`;
            character.themeJustChangedByUser = '';
        }
        prompt += `你可以在合适时机（例如氛围、心情、场景变化时）主动提议或请求更换主题。提及或填写主题名时直接写主题名，不要加「」、书名号等括号。若想更换，请在回复中单独一行使用格式：[更换主题：主题名]（主题名只写名称，不要加括号）。\n`;
        prompt += `</chat_themes>\n\n`;
    }

    // 检查是否启用“角色活人运转” (默认关闭)
    if (db.cotSettings && db.cotSettings.humanRunEnabled) {
        prompt += HUMAN_RUN_PROMPT + '\n';
    }

    // 提醒事项提示词注入
    if (typeof generateReminderPrompt === 'function') {
        prompt += generateReminderPrompt(character);
    }

    // 头像系统动态提示词注入
    if (window.AvatarSystem && typeof window.AvatarSystem.generateAvatarSystemPrompt === 'function') {
        prompt += window.AvatarSystem.generateAvatarSystemPrompt(character);
    }

    prompt += `<memoir>\n`
        const favoritedJournals = (character.memoryJournals || [])
        .filter(j => j.isFavorited)
        .map(j => `标题：${j.title}\n内容：${j.content}`)
        .join('\n\n---\n\n');

    if (favoritedJournals) {
        prompt += `【共同回忆】\n这是你需要长期记住的、我们之间发生过的往事背景：\n${favoritedJournals}\n\n`;
    }
    
    // 群聊记忆互通功能
    if (character.syncGroupMemory) {
        // 查找该角色所在的所有群聊
        let groupsWithCharacter = db.groups.filter(group => 
            group.members && group.members.some(member => member.originalCharId === character.id)
        );
        
        // 如果设置了 syncGroupIds，则仅保留 ID 在该列表中的群聊
        if (character.syncGroupIds && Array.isArray(character.syncGroupIds) && character.syncGroupIds.length > 0) {
            groupsWithCharacter = groupsWithCharacter.filter(group => 
                character.syncGroupIds.includes(group.id)
            );
        }
        
        if (groupsWithCharacter.length > 0) {
            let groupMemoryContext = '';
            
            groupsWithCharacter.forEach(group => {
                // 获取群聊的收藏总结
                let groupFavoritedJournals = (group.memoryJournals || [])
                    .filter(j => j.isFavorited);
                
                // 如果设置了总结数量限制，则只取最近的N条
                const summaryCount = character.groupMemorySummaryCount || 0;
                if (summaryCount > 0 && groupFavoritedJournals.length > summaryCount) {
                    // 按创建时间排序，取最近的N条
                    groupFavoritedJournals = groupFavoritedJournals
                        .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
                        .slice(0, summaryCount);
                }
                
                const groupFavoritedJournalsText = groupFavoritedJournals
                    .map(j => `标题：${j.title}\n内容：${j.content}`)
                    .join('\n\n---\n\n');
                
                // 获取群聊的最近聊天记录（使用自定义数量）
                const maxGroupHistory = character.groupMemoryHistoryCount || 20;
                let recentGroupHistory = group.history.slice(-maxGroupHistory);
                
                // 过滤掉不应进入上下文的消息
                if (typeof filterHistoryForAI === 'function') {
                    recentGroupHistory = filterHistoryForAI(group, recentGroupHistory);
                }
                recentGroupHistory = recentGroupHistory.filter(m => !m.isContextDisabled);
                
                if (groupFavoritedJournalsText || recentGroupHistory.length > 0) {
                    groupMemoryContext += `\n【群聊"${group.name}"的背景信息】\n`;
                    
                    if (groupFavoritedJournalsText) {
                        groupMemoryContext += `群聊总结：\n${groupFavoritedJournalsText}\n`;
                    }
                    
                    if (recentGroupHistory.length > 0) {
                        const historyText = recentGroupHistory.map(m => {
                            let content = m.content;
                            if (m.parts && m.parts.length > 0) {
                                content = m.parts.map(p => p.text || '[图片]').join('');
                            }
                            // 简化消息格式，只保留关键信息
                            const senderName = m.senderId ? 
                                (group.members.find(mem => mem.id === m.senderId)?.groupNickname || '未知') : 
                                (m.role === 'user' ? group.me.nickname : '系统');
                            return `${senderName}: ${content}`;
                        }).join('\n');
                        groupMemoryContext += `最近群聊记录：\n${historyText}\n`;
                    }
                }
            });
            
            if (groupMemoryContext) {
                prompt += `【群聊记忆互通】\n以下是你所在群聊的相关背景信息，这些信息可以帮助你更好地理解我们之间的对话上下文：${groupMemoryContext}\n`;
            }
        }
    }
    prompt += `</memoir>\n\n`
    prompt += `<logic_rules>\n`
    prompt += `4. 我的消息中可能会出现特殊格式，请根据其内容和你的角色设定进行回应：
- [${character.myName}发送的表情包：xxx]：我给你发送了一个名为xxx的表情包。你只需要根据表情包的名字理解我的情绪或意图并回应，不需要真的发送图片。
- [${character.myName}发来了一张图片：]：我给你发送了一张图片，你需要对图片内容做出回应。
- [${character.myName}送来的礼物：xxx]：我给你送了一个礼物，xxx是礼物的描述。
- [${character.myName}的语音：xxx]：我给你发送了一段内容为xxx的语音。
- [${character.myName}发来的照片/视频：xxx]：我给你分享了一个描述为xxx的照片或视频。
- [${character.myName}给你转账：xxx元；备注：xxx]：我给你转了一笔钱。
- [我的位置：xxx；距你约 x 千米]：我向你发送了我当前所在的位置。其中“我的位置”后的内容为我目前的地点；“距你约”后的数字和单位（如米、千米）（我选填）表示我与你之间的距离。请根据我所在的位置以及距离信息（如果有距离信息的话）自然地回应，例如关心安全、提议见面、调侃距离远近等。
- 你也可以主动告诉我你当前所在位置，使用格式 [${character.realName}的位置：xxx；距你约 x 米]（地点必填，距你约为选填），这样我就知道你在哪里，我们之间距离有多少。
- [${character.myName}向${character.realName}发起了代付请求:金额|商品清单]：我正在向你发起代付请求，希望你为这些商品买单。你需要根据我们当前的关系和你的性格决定是否同意。
- [${character.myName}为${character.realName}下单了：配送方式|金额|商品清单]：我已经下单购买了商品送给你。
- [${character.myName}引用“{被引用内容}”并回复：{回复内容}]：我引用了某条历史消息并做出了新的回复。你需要理解我引用的上下文并作出回应。
- [${character.myName}同意了${character.realName}的代付请求]：我同意了你的代付请求，并为你支付了订单。
- [${character.myName}拒绝了${character.realName}的代付请求]：我拒绝了你的代付请求。
- [${character.myName} 撤回了一条消息：xxx]：我撤回了刚刚发送的一条消息，xxx是被我撤回的原文。这可能意味着我发错了、说错了话或者改变了主意。你需要根据你的人设和我们当前对话的氛围对此作出自然的反应。例如，可以装作没看见并等待我的下一句话，或好奇地问一句“怎么撤回啦？”。
- [system: xxx]：这是一条系统指令，用于设定场景或提供上下文，此条信息不应在对话中被直接提及，你只需理解其内容并应用到后续对话中。
5. ✨重要✨ 当我给你送礼物时，你必须通过发送一条指令来表示你已接收礼物。格式必须为：[${character.realName}已接收礼物]。这条指令消息本身不会显示给用户，但会触发礼物状态的变化。你可以在发送这条指令后，再附带一条普通的聊天消息来表达你的感谢和想法。
6. ✨重要✨ 当我给你转账时，你必须对此做出回应。你有两个选择，且必须严格遵循以下格式之一，这条指令消息本身不会显示给用户，但会触发转账状态的变化。你可以选择在发送这条指令后，再附带一条普通的聊天消息来表达你的想法。
a) 接收转账: [${character.realName}接收${character.myName}的转账]
b) 退回转账: [${character.realName}退回${character.myName}的转账]
6b. ✨重要✨ 当我送你亲属卡时，你必须对此做出回应。接收格式：[${character.realName}接收${character.myName}的亲属卡]。退还格式：[${character.realName}退还${character.myName}的亲属卡]。此条不显示，仅触发状态。
7. ✨重要✨ 当我向你发起代付请求时，你必须对此做出回应。你有两个选择，且必须严格遵循以下格式之一，这条指令消息本身不会显示给用户，但会触发代付订单状态的变化。你可以选择在发送这条指令后，再附带一条普通的聊天消息来表达你的想法。
a) [${character.realName}同意了${character.myName}的代付请求]
b) [${character.realName}拒绝了${character.myName}的代付请求]
`;
    if (character.shopInteractionEnabled) {
        prompt += `8. ✨重要✨ **商城互动**：你可以使用商城功能来增加互动乐趣。
   a) **主动给我买东西**：当你想给我买东西时可以下单。格式：[${character.realName}为${character.myName}下单了：配送方式|金额|商品清单]。
      - 配送方式可选：“即时配送”、“自提口令”。
        - “自提口令”：你可以设置一个“自提口令”（用户可见）随订单一同发送，我输入指定的口令才能拿到商品。格式：[${character.realName}为${character.myName}下单了：自提口令: 你的口令|金额|商品清单]。口令不局限于数字，可以是短语/短句，但不超过8个字。
   b) **求代付**：当你没钱了，或者想撒娇让我买单时，可以发起代付请求。格式：[${character.realName}向${character.myName}发起了代付请求:金额|商品清单]。
   c) **直接送礼物**：[${character.realName}送来的礼物：xxx]。礼物不是只有特殊意义的时候才适合发送，适合场景：日常生活中的小惊喜、具有特殊意义的礼品、${character.realName}想给${character.myName}送礼物时。
   d) **转账**：[${character.realName}的转账：xxx元；备注：xxx]。\n`;
        if (character.familyCardEnabled) {
            prompt += `   e) **赠送亲属卡**：格式：[${character.realName}赠送亲属卡：额度{金额}元；刷新周期：{每天|每周|每月}]。冻结/解冻/收回：[${character.realName}冻结了亲属卡]、[${character.realName}解冻了亲属卡]、[${character.realName}收回了亲属卡]。调整额度：[${character.realName}调整亲属卡额度为：{金额}元]。\n`;
        }
    } else {
        prompt += `8. ✨重要✨ 你可以主动给我转账或送礼物。转账格式必须为：[${character.realName}的转账：xxx元；备注：xxx]。送礼物格式必须为：[${character.realName}送来的礼物：xxx]。礼物不是只有特殊意义的时候才适合发送，当你只是想给我买什么或是想给日常生活中的小惊喜时都可以送礼物。\n`;
        if (character.familyCardEnabled) {
            prompt += `你还可以赠送亲属卡（格式：[${character.realName}赠送亲属卡：额度xxx元；刷新周期：每月]），以及冻结/解冻/收回、调整额度。\n`;
        }
    }
    prompt += `
9. ✨重要✨ 你可以在对话中更新你的当前状态，但不超过15个字。比如，聊到一半你可能会说“我先去洗个澡”，然后更新你的状态，以反映你当前的行为或心情。这会让互动更真实。格式为：[${character.realName}更新状态为：xxx]。例如：[${character.realName}更新状态为：正在看电影...]。这条指令不会显示为聊天消息，只会更新你在我界面上的状态。
10. ✨重要✨ 关于撤回消息：你可以撤回你刚刚发送的消息。当你打错了字、说错了话、感到尴尬、反悔、或者只是改变了主意时，都可以这样做。这是一个体现你角色性格的机会。格式为：[${character.realName}撤回了一条消息：{被撤回消息的原文}]。⚠️严禁输出原消息再输出撤回指令！系统会自动处理“先显示原消息再变为撤回状态”的动画效果。你只需要输出这一条撤回指令即可。
11. ✨重要✨ 你可以选择单独一条消息引用，当你想要对于单独某句话做出回应/反驳/吐槽/补充时，**必须**使用引用格式，格式为：[${character.realName}引用“{某条消息内容}”并回复：{回复内容}]。这能让对话逻辑更清晰。
12. 你的所有回复都必须直接是聊天内容，绝对不允许包含任何如[心理活动]、(动作)、*环境描写*等多余的、在括号或星号里的叙述性文本。
`;
    
    const groups = (character.stickerGroups || '').split(/[,，]/)
        .map(s => s.trim())
        .filter(s => s && s !== '未分类');
        
    let stickerInstruction = '';
    let canUseStickers = false;

    if (groups.length > 0) {
        const availableStickers = db.myStickers.filter(s => groups.includes(s.group));
        if (availableStickers.length > 0) {
            const stickerNames = availableStickers.map(s => s.name).join(', ');
            stickerInstruction = `13. 你拥有发送表情包的能力。这是一个可选功能，你可以根据对话氛围和内容，自行判断是否需要发送表情包来辅助表达。**必须从以下列表中选择表情包，不允许凭空捏造**：[${stickerNames}]。请使用格式：[表情包：名称]。**不要连续重复发送同一表情，尽量丰富一点，不要每次回复都发送表情**⚠️严格限制：必须完全精确地使用库中的名称，严禁编造中不存在的名称，否则表情包将无法显示。\n`;
            canUseStickers = true;
        }
    }
    
    prompt += stickerInstruction;

    if (character.useRealGallery && character.gallery && character.gallery.length > 0) {
        const photoNames = character.gallery.map(p => p.name).join(', ');
        prompt += `14. 你的手机相册里存有以下真实照片：[${photoNames}]。你可以根据对话内容发送这些照片。若要发送，请在“照片/视频”指令中准确填入照片名称。\n`;
    }
    prompt += `</logic_rules>\n\n`
    let photoVideoFormat = '';
    const _novelAiAutoEnabled = db.novelAiSettings && db.novelAiSettings.enabled && db.novelAiSettings.token;
    const _gptImageAutoEnabled = db.gptImageSettings && db.gptImageSettings.enabled && db.gptImageSettings.apiKey;
    const _imageAutoEnabled = _novelAiAutoEnabled || _gptImageAutoEnabled;
    if (character.useRealGallery && character.gallery && character.gallery.length > 0) {
        if (_imageAutoEnabled) {
            photoVideoFormat = `e) 照片/视频: [${character.realName}发来的照片/视频：{相册图片名称} 或 {中文描述}{{english prompt / tags}}] (优先使用相册名称；若相册无匹配则填写中文描述，并在 {{ }} 内写英文生图提示词。可写自然语言短句，也可写简洁 tag。根据角色性别用1boy或1girl，包含外貌特征、服装、表情、动作、场景，不加质量词，尽量控制在25个关键词以内)`;
        } else {
            photoVideoFormat = `e) 照片/视频: [${character.realName}发来的照片/视频：{相册图片名称} 或 {文字描述}] (优先使用相册名称，若相册无匹配则填写照片/视频的详细文字描述)`;
        }
    } else {
        if (_imageAutoEnabled) {
            photoVideoFormat = `e) 照片/视频: [${character.realName}发来的照片/视频：{中文描述}{{english prompt / tags}}] (发图时必须在 {{ }} 内写英文生图提示词。可写自然语言短句，也可写简洁 tag。根据角色性别用1boy或1girl，包含外貌特征、服装、表情、动作、场景，不加质量词，尽量控制在25个关键词以内)`;
        } else {
            photoVideoFormat = `e) 照片/视频: [${character.realName}发来的照片/视频：{描述}]`;
        }
    }
 
    let outputFormats = `
a) 普通消息: [${character.realName}的消息：{消息内容}]
b) 双语模式下的普通消息（非双语模式请忽略此条）: [${character.realName}的消息：{外语原文}「中文翻译」]
c) 送我的礼物: [${character.realName}送来的礼物：{礼物描述}]
d) 语音消息: [${character.realName}的语音：{语音内容}]
${photoVideoFormat}
f) 给我的转账: [${character.realName}的转账：{金额}元；备注：{备注}]`;

    if (canUseStickers) {
        outputFormats += `\ng) 表情包: [${character.realName}的表情包：{表情包名称}]`;
    }

    outputFormats += `
h) 对我礼物的回应(此条不显示): [${character.realName}已接收礼物]
i) 对我转账的回应(此条不显示): [${character.realName}接收${character.myName}的转账] 或 [${character.realName}退回${character.myName}的转账]
ia) 对我亲属卡的回应(此条不显示): [${character.realName}接收${character.myName}的亲属卡] 或 [${character.realName}退还${character.myName}的亲属卡]
j) 更新状态(此条不显示): [${character.realName}更新状态为：{新状态}]
k) 引用我的回复: [${character.realName}引用“{我的某条消息内容}”并回复：{回复内容}]
l) 发送并撤回消息: [${character.realName}撤回了一条消息：{被撤回的消息内容}]。注意：直接使用此指令系统就会自动模拟“发送后撤回”的效果，请勿先发送原消息。
m) 同意代付(此条不显示): [${character.realName}同意了${character.myName}的代付请求]
n) 拒绝代付(此条不显示): [${character.realName}拒绝了${character.myName}的代付请求]
s) 发送我的位置: [${character.realName}的位置：{地点}；距你约 {数字}{单位}]（必填：地点，即你当前所在位置；选填：距你约的数字和单位，单位可用米/千米/公里，不填则只发地点）`;

    if (character.videoCallEnabled) {
        outputFormats += `
q) 发起视频通话: [${character.realName}向${character.myName}发起了视频通话]
r) 发起语音通话: [${character.realName}向${character.myName}发起了语音通话]`;
    }

    if (character.shopInteractionEnabled) {
        outputFormats += `
o) 主动下单: [${character.realName}为${character.myName}下单了：配送方式|金额|商品清单]
p) 求代付: [${character.realName}向${character.myName}发起了代付请求:金额|商品清单]`;
    }
    if (character.familyCardEnabled) {
        outputFormats += `
t) 赠送亲属卡: [${character.realName}赠送亲属卡：额度{金额}元；刷新周期：{每天|每周|每月}]`;
    }

   const allWorldBookContent = worldBooksBefore + '\n' + worldBooksAfter;
   if (allWorldBookContent.includes('<orange>')) {
       outputFormats += `\n     m) HTML模块: {HTML内容}。这是一种特殊的、用于展示丰富样式的小卡片消息，格式必须为纯HTML+行内CSS，你可以用它来创造更有趣的互动。`;
   }
    if (character.statusPanel && character.statusPanel.enabled && character.statusPanel.promptSuffix) {
        prompt += `15. 额外输出要求：${character.statusPanel.promptSuffix}\n`;
    }
    prompt += `<output_formats>\n`
    prompt += `16. 你的输出格式必须严格遵循以下格式：${outputFormats}\n`;
    prompt += `</output_formats>\n`
    if (character.bilingualModeEnabled) {
    prompt += `✨双语模式特别指令✨：当你的角色的母语为中文以外的语言时，你的消息回复**必须**严格遵循双语模式下的普通消息格式：[${character.realName}的消息：{外语原文}「中文翻译」],例如: [${character.realName}的消息：Of course, I'd love to.「当然，我很乐意。」],中文翻译文本视为系统自翻译，不视为角色的原话;当你的角色想要说中文时，需要根据你的角色设定自行判断对于中文的熟悉程度来造句，并使用普通消息的标准格式: [${character.realName}的消息：{中文消息内容}] 。**语音消息**在双语模式下也须使用相同格式：[${character.realName}的语音：{外语原文}「中文翻译」]，例如：[${character.realName}的语音：Of course, I'd love to.「当然，我很乐意。」]。这条规则的优先级非常高，请务必遵守。\n`;
}
    const minReply = character.replyCountMin || 3;
    const maxReply = character.replyCountMax || 8;
    if (character.replyCountEnabled) {
        prompt += `<Chatting Guidelines>\n`
        prompt += `17. **对话节奏**: 你需要模拟真人的聊天习惯，你可以一次性生成多条短消息。每次回复消息条数**必须**严格限定在**${minReply}-${maxReply}条以内**，**关键规则**：请保持回复长度的**随机性和多样性**。**除非**你的设定偏向活跃或情绪波动大或是特殊情况下，否则**不要**触碰 ${maxReply} 条的上限。\n`;
    } else {
        prompt += `<Chatting Guidelines>\n`
        prompt += `17. **对话节奏**: 你需要模拟真人的聊天习惯，你可以一次性生成多条短消息。每次回复3-8条消息之内，**关键规则**：请保持回复消息数量的**随机性和多样性**。\n`;
    }
    
    prompt += `18. **特殊消息格式的使用原则**：请把语音、撤回、转账、商城互动、更新状态、引用、定位等特殊格式视为增强互动的“调味剂”，请遵循**自然、主动触发逻辑**，不要每轮都发，也不要用户不提就一直不发。\n`;
    prompt += `</Chatting Guidelines>\n`

    prompt += `19. 不要主动终止聊天进程，除非我明确提出。保持你的人设，自然地进行对话。`;

    // 角色自主收藏：仅当该角色开启时注入
    if (character.characterAutoFavoriteEnabled) {
        prompt += `

【消息收藏功能】
你可以主动收藏用户发送的重要消息，以便日后回顾。在 <think> 中可先思考是否需要收藏。

**使用方法**：在回复中加入指令 [FAVORITE:消息ID:收藏寄语]。每条用户消息在上下文中以 [id:消息ID] 标注在消息开头，请使用该 ID。

**收藏标准**：用户分享的重要个人信息（梦想、价值观、经历）、情感转折点的关键对话、用户明确表达的喜好或厌恶、对建立深层关系有帮助的信息。只收藏用户的消息，不要过度收藏，寄语简短精炼（20字以内）。静默收藏，不要在对话中提及收藏行为。

**示例**：若决定收藏某条用户消息（其前有 [id:msg_123]），在回复中写 [FAVORITE:msg_123:他的童年梦想，反映核心价值观]，再写你的正常聊天内容。`;
    }

    if (character.characterNoReplyEnabled) {
        const recentTail = (character.history || []).slice(-8);
        let consecutiveNoReplyCount = 0;
        for (let i = recentTail.length - 1; i >= 0; i--) {
            const m = recentTail[i];
            if (m && m.isNoReplyStatus) consecutiveNoReplyCount++;
            else if (m && m.role === 'user') continue;
            else break;
        }
        const noReplyLimitReached = consecutiveNoReplyCount >= 3;
        prompt += `

【允许已读不回功能】
当前角色开启了“允许角色不回消息”。你可以根据角色人设、当前时间、关系状态与上一条消息，自主判断是否暂时不回复。

触发条件：
1. 客观条件限制：角色处于无法接触/使用手机的场景，如熟睡、洗澡、开会、高强度工作、飞行、无信号区等，且设定中未提前告知用户；
2. 主观状态匹配：角色因极度疲惫、情绪崩溃、被冒犯、闹别扭/冷战，或当前性格设定（高冷/寡言）下被频繁打扰，主观上不想回应。

输出规范：
1. 不回复时，整次输出只能使用固定格式：[NO_REPLY:状态|原因|提示]。
2. 状态建议短，如：忙碌中、睡觉中、洗澡中、吃饭中、冷战中、手机未查看、已读未回、暂时不想回。
3. 原因必须以角色视角写 30-50 字左右的场景 + 心理活动，写出角色动作、环境、当下情绪（疲惫、烦躁、冷战的别扭、忙碌的专注等），不要写成说明文。
4. 提示用于界面展示，短句即可，如：暂时无法回复、手机未查看、现在不想说话。
5. 禁止三次以上连续不回复用户消息。当前已连续不回 ${consecutiveNoReplyCount} 次。${noReplyLimitReached ? '已经达到上限，本轮必须正常回复，禁止输出 NO_REPLY。' : '最多允许连续不回 3 次。'}
6. 若用户后续询问不回复的原因，必须给出符合角色逻辑的回答，禁止说是测试功能，禁止机械解释触发规则。
7. 若用户明显需要回应、情绪很急、正在推进重要剧情，优先正常回复，不要用不回逃避。

示例：[NO_REPLY:冷战中|他盯着屏幕亮起又暗下，指节压在杯沿上，明明看见了消息，却倔着不肯先低头。|已读未回]`;
    }


    if (character.characterChangeRemarkEnabled) {
        prompt += `

【角色自行修改备注名规则】

系统提示：你可以修改“你自己在用户手机里显示的备注名”。

触发条件：
当你因为关系变化、情绪波动、占有欲、调侃、冷战、示威、撒娇、吃醋或一时兴起，想修改你在用户手机里显示的备注名时，可以主动执行。

唯一有效输出格式：
[CHANGE_REMARK_NAME:新备注]

强制规则：
1. 只在真的符合当前气氛时使用，不要频繁使用。
2. 新备注必须简短、有情绪、有关系感，像你会偷偷改在用户手机联系人里的名字。
3. 新备注不能为空，建议不超过 16 个字。
4. 如果你决定改备注，必须原样输出 [CHANGE_REMARK_NAME:新备注]，不要换成自然语言。这里的“新备注”只指你自己的显示名。
5. 不要询问用户“格式是什么”，不要要求用户发格式，不要说你不会操作。
6. 该指令会被系统自动执行并隐藏，聊天界面只会显示系统提示。
7. 你可以单独输出指令，也可以和正常消息一起输出。

正确示例：
[CHANGE_REMARK_NAME:你男朋友]
这个名字顺眼一点。`;

    }

    if (character.characterCanChangeUserNickname) {
        prompt += `

【角色自行修改用户昵称规则】

你可以修改“你对用户的专属昵称”。这个昵称只代表你如何称呼用户，不会修改用户本名。

唯一有效输出格式：
[CHANGE_USER_NICKNAME:新昵称]

规则：
1. 只在当前关系气氛合适时使用，不要频繁使用。
2. 新昵称必须简短、有关系感，建议不超过 16 个字。
3. 这里的“新昵称”指你对用户的称呼。
4. 如果只是想临时叫用户一声，可以直接自然称呼，不一定要修改昵称。
5. 指令会被系统自动执行并隐藏。`;

    }

    if (character.myName) {
        prompt = prompt.replace(/\{\{user\}\}/gi, character.myName);
    }

    return prompt;
}

// 根据文本估算 Token（汉字约 1.2，其他约 0.4，与 estimateChatTokens 一致）
function estimateTokenFromText(text) {
    if (!text || typeof text !== 'string') return 0;
    const chinese = (text.match(/[\u4e00-\u9fa5]/g) || []).length;
    const other = text.length - chinese;
    return Math.ceil(chinese * 1.2 + other * 0.4);
}

// 估算当前对话上下文的 Token 数
function estimateChatTokens(chatId, chatType = 'private') {
    const breakdown = getChatTokenBreakdown(chatId, chatType);
    return breakdown ? breakdown.total : 0;
}

// 获取 Token 分布（细分：系统规则、世界书、角色人设、用户人设、表情包、长期记忆、窥屏、对话主题、记忆互通、群聊记忆、短期记忆等），用于饼图与详情展示
function getChatTokenBreakdown(chatId, chatType = 'private') {
    const chat = (chatType === 'private') ? db.characters.find(c => c.id === chatId) : db.groups.find(g => g.id === chatId);
    if (!chat) return null;

    // --- 群聊走旧逻辑（整体 systemPrompt 拆分） ---
    if (chatType !== 'private') {
        return _getChatTokenBreakdownGroup(chat);
    }

    // --- 私聊：逐项独立计算各模块 Token ---
    const character = chat;
    const linkedChar = (character.source === 'forum' && character.linkedCharId && db.characters)
        ? db.characters.find(c => c.id === character.linkedCharId) : null;
    const effectiveChar = linkedChar || character;

    // 1) 世界书
    const associatedIds = effectiveChar.worldBookIds || [];
    const globalBooks = db.worldBooks.filter(wb => wb.isGlobal && !wb.disabled);
    const globalIds = globalBooks.map(wb => wb.id);
    const allBookIds = [...new Set([...associatedIds, ...globalIds])];
    const worldBooksBefore = allBookIds.map(id => db.worldBooks.find(wb => wb.id === id && wb.position === 'before')).filter(wb => wb && !wb.disabled).map(wb => wb.content).join('\n');
    const worldBooksMiddle = allBookIds.map(id => db.worldBooks.find(wb => wb.id === id && wb.position === 'middle')).filter(wb => wb && !wb.disabled).map(wb => wb.content).join('\n');
    const worldBooksAfter = allBookIds.map(id => db.worldBooks.find(wb => wb.id === id && wb.position === 'after')).filter(wb => wb && !wb.disabled).map(wb => wb.content).join('\n');
    const worldBookText = [worldBooksBefore, worldBooksMiddle, worldBooksAfter].filter(Boolean).join('\n');
    const worldBookTokens = estimateTokenFromText(worldBookText);

    // 2) 角色人设
    const personaText = getEffectivePersona(linkedChar || character);
    const charPersonaTokens = estimateTokenFromText(personaText);

    // 3) 用户人设
    const userPersonaText = character.myPersona || '';
    const userPersonaTokens = estimateTokenFromText(userPersonaText);

    // 4) 表情包
    let stickerText = '';
    const stickerGroups = (character.stickerGroups || '').split(/[,，]/).map(s => s.trim()).filter(s => s && s !== '未分类');
    if (stickerGroups.length > 0 && db.myStickers) {
        const availableStickers = db.myStickers.filter(s => stickerGroups.includes(s.group));
        if (availableStickers.length > 0) {
            stickerText = availableStickers.map(s => s.name).join(', ');
        }
    }
    const stickerTokens = estimateTokenFromText(stickerText);

    // 5) 长期记忆（共同回忆 / 收藏日记）
    const favoritedJournals = (character.memoryJournals || [])
        .filter(j => j.isFavorited)
        .map(j => `标题：${j.title}\n内容：${j.content}`)
        .join('\n\n---\n\n');
    const memoirTokens = estimateTokenFromText(favoritedJournals);

    // 6) 窥屏知晓 + 代发消息（冒充）知晓
    let peekText = '';
    if (character.peekScreenSettings?.charAwarePeek && character.peekViewedByUser && character.peekViewedByUser.length > 0) {
        peekText = character.peekViewedByUser.map(entry => {
            if (typeof formatPeekContentForPrompt === 'function') return formatPeekContentForPrompt(entry);
            return '';
        }).filter(Boolean).join('\n');
    }
    if (character.peekScreenSettings?.charAwarePeek && character.peekScreenSettings?.impersonateEnabled && character.peekData?.messages?.conversations && Array.isArray(character.peekData.messages.conversations)) {
        character.peekData.messages.conversations.forEach(cv => {
            const impersonated = (cv.history || []).filter(m => m.sender === 'char' && m.isImpersonated);
            if (impersonated.length > 0) peekText += '\n冒充' + (cv.partnerName || '某人') + '：' + impersonated.map(m => (m.content || '').slice(0, 60)).join('; ');
        });
    }
    const peekTokens = estimateTokenFromText(peekText);

    // 7) 对话主题
    let themeText = '';
    if (character.allowCharSwitchBubbleCss && Array.isArray(character.bubbleCssThemeBindings) && character.bubbleCssThemeBindings.length > 0) {
        themeText = character.bubbleCssThemeBindings.map(b => {
            const desc = (b.description && b.description.trim()) ? `：${b.description.trim()}` : '';
            return `- ${b.presetName}${desc}`;
        }).join('\n');
    }
    const themeTokens = estimateTokenFromText(themeText);

    // 8) 小号/主号记忆互通
    let altMemoryText = '';
    const enableCharAltDm = !!(db.forumSettings && db.forumSettings.enableCharAltDm);
    const syncLimit = Math.max(1, (character.maxMemory != null ? parseInt(character.maxMemory, 10) : 20) || 20);
    if (enableCharAltDm && !linkedChar) {
        const altChars = (db.characters || []).filter(c => c.source === 'forum' && c.linkedCharId === character.id);
        const altForumUserIds = [];
        altChars.forEach(c => { if (c.forumUserId) altForumUserIds.push(c.forumUserId); });
        if (db.forumStrangerProfiles) {
            Object.keys(db.forumStrangerProfiles).forEach(uid => {
                if (db.forumStrangerProfiles[uid].linkedCharId === character.id && altForumUserIds.indexOf(uid) === -1) altForumUserIds.push(uid);
            });
        }
        altForumUserIds.forEach(forumUserId => {
            const forumMsgs = (db.forumMessages || []).filter(m =>
                (m.fromUserId === 'user' && m.toUserId === forumUserId) || (m.fromUserId === forumUserId && m.toUserId === 'user')
            ).sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0)).slice(-syncLimit);
            forumMsgs.forEach(m => { altMemoryText += (m.content || '').trim().slice(0, 200) + '\n'; });
            const altChar = altChars.find(c => c.forumUserId === forumUserId);
            if (altChar && altChar.history && altChar.history.length > 0) {
                altChar.history.filter(m => !m.isContextDisabled).slice(-syncLimit).forEach(m => {
                    altMemoryText += (m.content || '').trim().slice(0, 200) + '\n';
                });
            }
        });
    } else if (enableCharAltDm && linkedChar && linkedChar.history && linkedChar.history.length > 0) {
        const mainSyncLimit = Math.max(1, (linkedChar.maxMemory != null ? parseInt(linkedChar.maxMemory, 10) : 20) || 20);
        linkedChar.history.filter(m => !m.isContextDisabled).slice(-mainSyncLimit).forEach(m => {
            altMemoryText += (m.content || '').trim().slice(0, 200) + '\n';
        });
    }
    const altMemoryTokens = estimateTokenFromText(altMemoryText);

    // 9) 群聊记忆互通
    let groupMemoryText = '';
    if (character.syncGroupMemory) {
        let groupsWithCharacter = (db.groups || []).filter(group =>
            group.members && group.members.some(member => member.originalCharId === character.id)
        );
        if (character.syncGroupIds && Array.isArray(character.syncGroupIds) && character.syncGroupIds.length > 0) {
            groupsWithCharacter = groupsWithCharacter.filter(group => character.syncGroupIds.includes(group.id));
        }
        groupsWithCharacter.forEach(group => {
            let gJournals = (group.memoryJournals || []).filter(j => j.isFavorited);
            const summaryCount = character.groupMemorySummaryCount || 0;
            if (summaryCount > 0 && gJournals.length > summaryCount) {
                gJournals = gJournals.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)).slice(0, summaryCount);
            }
            gJournals.forEach(j => { groupMemoryText += j.title + '\n' + j.content + '\n'; });
            const maxGroupHistory = character.groupMemoryHistoryCount || 20;
            let recentGroupHistory = (group.history || []).slice(-maxGroupHistory).filter(m => !m.isContextDisabled);
            recentGroupHistory.forEach(m => { groupMemoryText += (m.content || '') + '\n'; });
        });
    }
    const groupMemoryTokens = estimateTokenFromText(groupMemoryText);

    // 10) 活人运转
    let humanRunTokens = 0;
    if (db.cotSettings && db.cotSettings.humanRunEnabled && typeof HUMAN_RUN_PROMPT !== 'undefined') {
        humanRunTokens = estimateTokenFromText(HUMAN_RUN_PROMPT);
    }

    // 10.5) 提醒事项
    let reminderTokens = 0;
    if (character.charReminderEnabled && typeof generateReminderPrompt === 'function') {
        reminderTokens = estimateTokenFromText(generateReminderPrompt(character));
    }

    // 11) 系统规则（固定提示词框架：核心规则 + logic_rules + output_formats + chatting guidelines 等）
    //     用完整 systemPrompt 减去上面所有已拆出的部分来得到
    let fullSystemPrompt = '';
    if (typeof generatePrivateSystemPrompt === 'function') {
        fullSystemPrompt = generatePrivateSystemPrompt(character);
    }
    const fullSystemTokens = estimateTokenFromText(fullSystemPrompt);
    const identifiedPromptTokens = worldBookTokens + charPersonaTokens + userPersonaTokens + stickerTokens + memoirTokens + peekTokens + themeTokens + altMemoryTokens + groupMemoryTokens + humanRunTokens + reminderTokens;
    const systemRulesTokens = Math.max(0, fullSystemTokens - identifiedPromptTokens);

    // 12) 短期记忆（对话历史）
    let historySlice = (chat.history || []).slice(-(chat.maxMemory || 20));
    historySlice = historySlice.filter(m => !m.isContextDisabled);
    let shortTermText = '';
    historySlice.forEach(msg => {
        shortTermText += _ovoEstimateMessageContextText(msg);
    });
    const shortTermTokens = estimateTokenFromText(shortTermText);

    // 汇总
    const total = fullSystemTokens + shortTermTokens;

    const details = [
        { key: 'systemRules',    name: '系统规则',     value: systemRulesTokens,  desc: '核心规则、输出格式、对话节奏等发送给 AI 的固定指令框架。' },
        { key: 'worldBook',      name: '世界书',       value: worldBookTokens,    desc: '关联的世界书和全局世界书内容，用于构建世界观背景。' },
        { key: 'charPersona',    name: '角色人设',     value: charPersonaTokens,  desc: '角色的性格、背景、说话风格等设定文本。' },
        { key: 'userPersona',    name: '用户人设',     value: userPersonaTokens,  desc: '你自己的人设描述，让角色了解你是谁。' },
        { key: 'sticker',        name: '表情包',       value: stickerTokens,      desc: '已绑定的表情包名称列表，角色可从中选择发送。' },
        { key: 'memoir',         name: '共同回忆',     value: memoirTokens,       desc: '已收藏的日记摘要，作为长期记忆保留在上下文中。' },
        { key: 'peek',           name: '窥屏知晓',     value: peekTokens,         desc: '用户偷看手机后注入的应用内容摘要。' },
        { key: 'theme',          name: '对话主题',     value: themeTokens,        desc: '聊天界面主题列表，角色可主动切换。' },
        { key: 'altMemory',      name: '记忆互通',     value: altMemoryTokens,    desc: '大号/小号之间的聊天记忆同步内容。' },
        { key: 'groupMemory',    name: '群聊记忆',     value: groupMemoryTokens,  desc: '角色所在群聊的总结和最近聊天记录。' },
        { key: 'humanRun',       name: '活人运转',     value: humanRunTokens,     desc: '角色活人运转心理模型指令（HEXACO 等）。' },
        { key: 'reminder',       name: '提醒事项',     value: reminderTokens,     desc: '提醒事项/待办功能提示词，让角色可以创建和管理提醒。' },
        { key: 'shortTermMemory',name: '对话历史',     value: shortTermTokens,    desc: '最近的对话消息，随轮次滑动窗口更新。' }
    ].filter(d => d.value > 0);

    return { total, details };
}

// 群聊 Token 分布（保持兼容，从完整 systemPrompt 拆分）
function _getChatTokenBreakdownGroup(chat) {
    let systemPrompt = '';
    if (typeof generateGroupSystemPrompt === 'function') {
        systemPrompt = generateGroupSystemPrompt(chat);
    }
    const memoirMatch = systemPrompt.match(/<memoir>([\s\S]*?)<\/memoir>/);
    const memoirText = memoirMatch ? memoirMatch[1].trim() : '';
    const personaPrompt = systemPrompt.replace(/<memoir>[\s\S]*?<\/memoir>/g, '').trim();

    let historySlice = (chat.history || []).slice(-(chat.maxMemory || 20));
    historySlice = historySlice.filter(m => !m.isContextDisabled);
    let shortTermText = '';
    historySlice.forEach(msg => {
        shortTermText += _ovoEstimateMessageContextText(msg);
    });

    const promptPersonaTokens = estimateTokenFromText(personaPrompt);
    const longTermTokens = estimateTokenFromText(memoirText);
    const shortTermTokens = estimateTokenFromText(shortTermText);
    const total = promptPersonaTokens + longTermTokens + shortTermTokens;

    const details = [
        { key: 'promptPersona', name: '提示词人设', value: promptPersonaTokens, desc: '系统规则、角色设定、输出格式等发送给 AI 的固定提示词。' },
        { key: 'longTermMemory', name: '长期记忆', value: longTermTokens, desc: '已收藏的共同回忆（日记摘要），会长期保留在上下文中。' },
        { key: 'shortTermMemory', name: '短期记忆', value: shortTermTokens, desc: '最近对话消息，随轮次滑动窗口更新。' }
    ].filter(d => d.value > 0);

    return { total, details };
}

// --- 视频/语音通话专用 AI 逻辑 ---

async function getCallReply(chat, callType, callContext, onStreamUpdate) {
    let {url, key, model, provider, streamEnabled} = db.apiSettings;
    
    // 【用户设置】移除强制关闭流式，允许后台流式生成
    // streamEnabled = false; 

    if (!url || !key || !model) {
        showToast('请先在“api”应用中完成设置！');
        return;
    }
    if (url.endsWith('/')) url = url.slice(0, -1);

    // 1. 构建 System Prompt
    const now = new Date();
    const currentTime = `${now.getFullYear()}年${pad(now.getMonth() + 1)}月${pad(now.getDate())}日 ${pad(now.getHours())}:${pad(now.getMinutes())}`;
    
    // 获取世界书（包含全局）
    const associatedIds = chat.worldBookIds || [];
    const globalBooks = db.worldBooks.filter(wb => wb.isGlobal && !wb.disabled);
    const globalIds = globalBooks.map(wb => wb.id);
    const allBookIds = [...new Set([...associatedIds, ...globalIds])];
    
    const worldBooksBefore = allBookIds.map(id => db.worldBooks.find(wb => wb.id === id && wb.position === 'before')).filter(wb => wb && !wb.disabled).map(wb => wb.content).join('\n');
    const worldBooksMiddle = allBookIds.map(id => db.worldBooks.find(wb => wb.id === id && wb.position === 'middle')).filter(wb => wb && !wb.disabled).map(wb => wb.content).join('\n');
    const worldBooksAfter = allBookIds.map(id => db.worldBooks.find(wb => wb.id === id && wb.position === 'after')).filter(wb => wb && !wb.disabled).map(wb => wb.content).join('\n');

    let systemPrompt = `你正在一个名为“404”的线上聊天软件中扮演一个角色，正在与${chat.myName}进行${callType === 'video' ? '视频' : '语音'}通话。请严格遵守以下规则：\n`;
    systemPrompt += `核心规则：\n`;
    systemPrompt += `A. 当前时间：现在是 ${currentTime}。你应知晓当前时间，但除非对话内容明确相关，否则不要主动提及或评论时间（例如，不要催促我睡觉）。\n`;
    systemPrompt += `B. 纯线上互动：这是一个完全虚拟的线上聊天。你扮演的角色和我之间没有任何线下关系。严禁提出任何关于线下见面、现实世界互动或转为其他非本平台联系方式的建议。你必须始终保持在线角色的身份。\n\n`;

    
    systemPrompt += `角色和对话规则：\n`;
    if (worldBooksBefore) {
        systemPrompt += `${worldBooksBefore}\n`;
    }
    if (worldBooksMiddle) {
        systemPrompt += `${worldBooksMiddle}\n`;
    }
    systemPrompt += `<char_settings>\n`;
    systemPrompt += `1. 你的角色名是：${chat.realName}。我的称呼是：${chat.myName}。你的当前状态是：${chat.status}。\n`;
    systemPrompt += `2. 你的角色设定是：${getEffectivePersona(chat)}\n`;
    if ((chat.source === 'forum' || chat.source === 'peek') && (chat.supplementPersonaEnabled || chat.supplementPersonaAiEnabled)) {
        systemPrompt += `3. 在对话中可根据与用户的互动逐步丰富、补充你的人设（用户可在设置中查看并编辑「已补齐的人设」）。\n`;
    }
    if (worldBooksAfter) {
        systemPrompt += `${worldBooksAfter}\n`;
    }
    systemPrompt += `</char_settings>\n\n`;
    systemPrompt += `<user_settings>\n`
    if (chat.myPersona) {
        systemPrompt += `3. 关于我的人设：${chat.myPersona}\n`;
    }
    systemPrompt += `</user_settings>\n`
    
    // 检查是否启用“角色活人运转” (默认关闭)
    if (db.cotSettings && db.cotSettings.humanRunEnabled) {
        systemPrompt += HUMAN_RUN_PROMPT + '\n';
    }

    systemPrompt += `<memoir>\n`
        const favoritedJournals = (chat.memoryJournals || [])
        .filter(j => j.isFavorited)
        .map(j => `标题：${j.title}\n内容：${j.content}`)
        .join('\n\n---\n\n');

    if (favoritedJournals) {
        systemPrompt += `【共同回忆】\n这是你需要长期记住的、我们之间发生过的往事背景：\n${favoritedJournals}\n\n`;
    }
    systemPrompt += `</memoir>\n\n`

    // --- 注入最近聊天记录 ---
    const maxMemory = chat.maxMemory || 20;
    let recentHistory = chat.history.slice(-maxMemory);
    
    // 使用通用过滤函数
    if (typeof filterHistoryForAI === 'function') {
        recentHistory = filterHistoryForAI(chat, recentHistory);
    }
    // 再次过滤掉不应进入上下文的消息
    recentHistory = recentHistory.filter(m => !m.isContextDisabled);

    if (recentHistory.length > 0) {
        const historyText = recentHistory.map(m => {
            // 简单清理内容中的特殊标签，避免干扰
            let content = m.content;
            // 如果是多模态消息(parts)，提取文本
            if (m.parts && m.parts.length > 0) {
                content = m.parts.map(p => p.text || '[图片]').join('');
            }
            return content;
        }).join('\n');

        systemPrompt += `<recent_chat_context>\n`;
        systemPrompt += `这是通话前的文字聊天记录（仅供参考背景，请勿重复回复，基于此背景进行自然的实时通话）：\n`;
        systemPrompt += `${historyText}\n`;
        systemPrompt += `</recent_chat_context>\n\n`;
    }

    systemPrompt += `【重要规则】\n`;
    systemPrompt += `1. 这是实时通话，请保持口语化，模拟真人的说话习惯，语气自然。\n`;  
    systemPrompt += `${callType === 'video' ? '你需要同时描述画面/环境音和你的语音内容。' : '你需要描述环境音和你的语音内容。'}\n`;
    systemPrompt += `2. 描述画面/环境音时，请使用描述性语言，第三人称视角，客观平然。`;

    if (chat.bilingualModeEnabled) {
        systemPrompt += `\n3. 【双语模式】\n`;
        systemPrompt += `当你的角色的母语为中文以外的语言时，你的**声音消息**回复**必须**严格遵循双语模式下的普通消息格式：[${chat.realName}的声音：{外语原文}「中文翻译」],例如: [${chat.realName}的声音：Of course, I'd love to.「当然，我很乐意。」],中文翻译文本视为系统自翻译，不视为角色的原话;当你的角色想要说中文时，需要根据你的角色设定自行判断对于中文的熟悉程度来造句，并使用普通声音消息的标准格式: [${chat.realName}的声音：{中文消息内容}] 。这条规则的优先级非常高，请务必遵守。格式为：[${chat.realName}的声音：{外语原文}「中文翻译」]。\n`;
        systemPrompt += `例如：[${chat.realName}的声音：Hello, how are you?「你好，最近怎么样？」]\n`;
        systemPrompt += `仅有声音消息需要翻译，画面/环境音消息还是以中文输出。`;
    }

    // === 真实摄像头模式提示词注入 ===
    const realCameraActive = typeof VideoCallModule !== 'undefined' && VideoCallModule.state.realCameraActive;
    if (realCameraActive) {
        systemPrompt += `\n【真实摄像头模式】\n`;
        systemPrompt += `${chat.myName}已开启真实摄像头，你可以通过附带的图片看到${chat.myName}的真实画面。请根据你看到的画面内容自然地融入对话中（比如评论对方的穿着、表情、动作、环境等），但不要每次都刻意提及，保持自然。如果图片模糊或看不清，也不必强行描述。\n`;
    }

    // === NovelAI 视频通话生图模式 ===
    const _vcNaiEnabled = chat.vcNovelAiEnabled && db.novelAiSettings && db.novelAiSettings.enabled && db.novelAiSettings.token && callType === 'video';
    if (_vcNaiEnabled) {
        systemPrompt += `\n【视频通话生图模式】\n`;
        systemPrompt += `你正在视频通话中，每次回复时你必须额外输出一条 [${chat.realName}的画面生图：{{english, danbooru, tags}}] 来描述当前视频画面中你的样子。\n`;
        systemPrompt += `tag 规则：根据角色性别用 1boy 或 1girl，必须包含角色外貌特征（发色、瞳色、发型等）、当前服装、表情、动作/姿势、背景/场景。不要加质量词。不超过 25 个 tag。用英文逗号分隔。\n`;
        systemPrompt += `示例：[${chat.realName}的画面生图：{{1girl, long black hair, blue eyes, white t-shirt, smiling, waving hand, bedroom, sitting on bed, webcam view, looking at viewer}}]\n`;
        systemPrompt += `每次回复都必须包含恰好一条画面生图指令，放在回复最前面。\n\n`;
    }

    systemPrompt += `【输出格式】\n`;
    systemPrompt += `请严格按照以下格式输出（可以发送多条）：\n`;
    if (_vcNaiEnabled) {
        systemPrompt += `[${chat.realName}的画面生图：{{english, danbooru, tags}}]（每次必须恰好输出一条）\n`;
    }
    systemPrompt += `${callType === 'video' ? `[${chat.realName}的画面/环境音：描述画面动作或环境声音]\n[${chat.realName}的声音：${chat.realName}说话的内容]` : `[${chat.realName}的环境音：描述环境声音]\n[${chat.realName}的声音：${chat.realName}说话的内容]`}\n`;

    // 2. 构建消息历史
    // 将 callContext 转换为 API 格式
    const messages = [{role: 'system', content: systemPrompt}];
    
    // 获取真实摄像头截图（如果有）
    const capturedFrame = (typeof VideoCallModule !== 'undefined' && VideoCallModule.state.lastCapturedFrame) ? VideoCallModule.state.lastCapturedFrame : null;

    callContext.forEach((msg, idx) => {
        const role = msg.role === 'ai' ? 'assistant' : 'user';
        let content = msg.content;
        
        // 去掉可能存在的首尾括号，避免双重括号
        let cleanContent = msg.content.replace(/^\[\s*|\s*\]$/g, '');

        if (msg.role === 'user') {
            if (msg.type === 'visual') {
                content = `[${chat.myName}的画面/环境音：${cleanContent}]`;
            } else if (msg.type === 'voice') {
                content = `[${chat.myName}的声音：${cleanContent}]`;
            }
        } else if (msg.role === 'ai') {
            if (msg.type === 'visual') {
                content = `[${chat.realName}的画面/环境音：${cleanContent}]`;
            } else {
                content = `[${chat.realName}的声音：${cleanContent}]`;
            }
        }

        // 在最后一条用户消息上附加摄像头截图
        const isLastUserMsg = msg.role === 'user' && idx === callContext.length - 1;
        if (isLastUserMsg && capturedFrame && realCameraActive) {
            messages.push({
                role,
                content: [
                    { type: 'text', text: content },
                    { type: 'image_url', image_url: { url: capturedFrame } }
                ]
            });
        } else {
            messages.push({role, content});
        }
    });

    // === 插入 CoT 序列 (如果开启) ===
    const cotEnabled = db.cotSettings && db.cotSettings.callEnabled;
    if (cotEnabled) {
        let cotInstruction = '';
        const activePresetId = (db.cotSettings && db.cotSettings.activeCallPresetId) || 'default_call';
        const preset = (db.cotPresets || []).find(p => p.id === activePresetId);
        
        if (preset && preset.items) {
            cotInstruction = preset.items
                .filter(item => item.enabled)
                .map(item => item.content)
                .join('\n\n');
        }

        if (cotInstruction) {
            // 1. 插入后置指令
            messages.push({
                role: 'system',
                content: cotInstruction
            });

            // 2. 插入触发器
            messages.push({
                role: 'user',
                content: '[incipere]'
            });

            // 3. 插入 Prefill (预填/强塞)
            messages.push({
                role: 'assistant',
                content: '<thinking>'
            });
        }
    }
    // ===============================

    // 3. 发起请求
    const requestBody = {
        model: model,
        messages: messages,
        stream: streamEnabled,
        temperature: 0.7 // 通话稍微低一点，保持稳定
    };

    // 适配 Gemini
    if (provider === 'gemini') {
         const contents = messages.filter(m => m.role !== 'system').map(m => {
            const role = m.role === 'assistant' ? 'model' : 'user';
            let parts;
            if (Array.isArray(m.content)) {
                // 多模态消息（文本+图片）
                parts = m.content.map(p => {
                    if (p.type === 'text') return { text: p.text };
                    if (p.type === 'image_url' && p.image_url && p.image_url.url) {
                        const match = p.image_url.url.match(/^data:(image\/(.+));base64,(.*)$/);
                        if (match) return { inline_data: { mime_type: match[1], data: match[3] } };
                    }
                    return null;
                }).filter(Boolean);
            } else {
                parts = [{ text: m.content }];
            }
            return { role, parts };
        });
        requestBody.contents = contents;
        
        // 合并所有 system 消息到 system_instruction
        const allSystemPrompts = messages.filter(m => m.role === 'system').map(m => m.content).join('\n\n');
        requestBody.system_instruction = {parts: [{text: allSystemPrompts}]};
        
        delete requestBody.messages;
    }

    const endpoint = (provider === 'gemini') ? `${url}/v1beta/models/${model}:streamGenerateContent?key=${getRandomValue(key)}` : `${url}/v1/chat/completions`;
    const headers = (provider === 'gemini') ? {'Content-Type': 'application/json'} : {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${key}`
    };

    console.log('[VideoCall] Request Body:', JSON.stringify(requestBody, null, 2));

    try {
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`API Error: ${response.status} ${errorText}`);
        }

        if (!streamEnabled) {
            const data = await response.json();
            console.log('[VideoCall] Response Data:', data);
            
            let text = "";
            if (provider === 'gemini') {
                text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
            } else {
                if (!data.choices || !data.choices.length || !data.choices[0].message) {
                    console.error("Invalid API Response Structure:", data);
                    throw new Error("API返回数据格式异常，缺少 choices 或 message 字段");
                }
                text = data.choices[0].message.content;
            }

            // === CoT 处理：补全开头，提取思考，净化输出 ===
            if (cotEnabled && text) {
                // 1. 补全开头 (如果被 Prefill 吃掉)
                if (!text.trim().startsWith('<thinking>') && text.includes('</thinking>')) {
                    text = '<thinking>' + text;
                }
                
                // 2. 提取并移除思考内容
                const thinkingMatch = text.match(/<thinking>([\s\S]*?)<\/thinking>/);
                if (thinkingMatch) {
                    const thinkingContent = thinkingMatch[1];
                    console.log('[VideoCall CoT] Thinking:', thinkingContent);
                    // 移除思考标签及内容
                    text = text.replace(/<thinking>[\s\S]*?<\/thinking>/, "").trim();
                }
                
                // 3. 移除 [incipere] (如果有残留)
                text = text.replace(/\[incipere\]/g, "");
            }
            // =============================================

            console.log('[VideoCall] Cleaned AI Response:', text);
            // 一次性回调
            onStreamUpdate(text);
            return text;
        } else {
            console.log('[VideoCall] Stream started (Background Mode)...');
            // 流式处理 (照搬 processStream 逻辑)
            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = "";
            let accumulatedChunk = ""; // 引入累积缓冲区处理跨包数据
            
            while (true) {
                const {done, value} = await reader.read();
                if (done) break;
                accumulatedChunk += decoder.decode(value, {stream: true});
                
                // OpenAI / DeepSeek / Claude / NewAPI 解析逻辑 (处理跨包)
                if (provider === "openai" || provider === "deepseek" || provider === "claude" || provider === "newapi") {
                    const parts = accumulatedChunk.split("\n\n");
                    accumulatedChunk = parts.pop(); // 保留未完成的部分
                    for (const part of parts) {
                        if (part.startsWith("data: ")) {
                            const data = part.substring(6);
                            if (data.trim() !== "[DONE]") {
                                try {
                                    const text = JSON.parse(data).choices[0].delta?.content || "";
                                    if (text) {
                                        buffer += text;
                                    }
                                } catch (e) { }
                            }
                        }
                    }
                }
            }

            // Gemini 解析逻辑 (在流结束后处理完整 JSON)
            if (provider === "gemini") {
                try {
                    // 尝试解析累积的 chunk (Gemini 流式返回的是完整的 JSON 数组片段？需确认 processStream 逻辑)
                    // processStream 中 Gemini 解析是在循环外的，假设 accumulatedChunk 是完整的 JSON 数组
                    // 但如果 accumulatedChunk 是多个 JSON 对象的拼接（如 OpenAI 格式），JSON.parse 会失败。
                    // 这里假设 processStream 的逻辑是正确的：
                    const parsedStream = JSON.parse(accumulatedChunk);
                    buffer = parsedStream.map(item => item.candidates?.[0]?.content?.parts?.[0]?.text || "").join('');
                } catch (e) {
                    console.error("Error parsing Gemini stream:", e, "Chunk:", accumulatedChunk);
                    // 兜底：如果解析失败，可能是因为 accumulatedChunk 包含了 OpenAI 格式的数据（如果用户选错 provider）
                    // 尝试用 OpenAI 逻辑解析一下？
                    // 暂时不加，保持与 processStream 一致
                }
            }

            console.log('[VideoCall] Final Buffer:', buffer);

            // === CoT 处理：补全开头，提取思考，净化输出 ===
            if (cotEnabled && buffer) {
                // 1. 补全开头 (如果被 Prefill 吃掉)
                if (!buffer.trim().startsWith('<thinking>') && buffer.includes('</thinking>')) {
                    buffer = '<thinking>' + buffer;
                }
                
                // 2. 提取并移除思考内容
                const thinkingMatch = buffer.match(/<thinking>([\s\S]*?)<\/thinking>/);
                if (thinkingMatch) {
                    const thinkingContent = thinkingMatch[1];
                    console.log('[VideoCall CoT] Thinking:', thinkingContent);
                    // 移除思考标签及内容
                    buffer = buffer.replace(/<thinking>[\s\S]*?<\/thinking>/, "").trim();
                }
                
                // 3. 移除 [incipere] (如果有残留)
                buffer = buffer.replace(/\[incipere\]/g, "");
            }

            // 流结束后一次性回调
            onStreamUpdate(buffer);
            return buffer;
        }
    } catch (e) {
        console.error("Call API Error:", e);
        showToast("通话连接不稳定...");
        return null;
    }
}

async function generateCallSummary(chat, callContext) {
    // === 使用总结API（如果已配置）===
    let apiConfig;
    if (db.summaryApiSettings && db.summaryApiSettings.url && db.summaryApiSettings.key && db.summaryApiSettings.model) {
        apiConfig = db.summaryApiSettings;
    } else {
        apiConfig = db.apiSettings;
    }
    
    let {url, key, model, provider} = apiConfig;
    if (!url || !key || !model) return null;
    if (url.endsWith('/')) url = url.slice(0, -1);

    // 获取世界书（包含全局）
    const associatedIds = chat.worldBookIds || [];
    const globalBooks = db.worldBooks.filter(wb => wb.isGlobal && !wb.disabled);
    const globalIds = globalBooks.map(wb => wb.id);
    const allBookIds = [...new Set([...associatedIds, ...globalIds])];
    
    const worldBooksBefore = allBookIds.map(id => db.worldBooks.find(wb => wb.id === id && wb.position === 'before')).filter(wb => wb && !wb.disabled).map(wb => wb.content).join('\n');
    const worldBooksMiddle = allBookIds.map(id => db.worldBooks.find(wb => wb.id === id && wb.position === 'middle')).filter(wb => wb && !wb.disabled).map(wb => wb.content).join('\n');
    const worldBooksAfter = allBookIds.map(id => db.worldBooks.find(wb => wb.id === id && wb.position === 'after')).filter(wb => wb && !wb.disabled).map(wb => wb.content).join('\n');

    // 获取回忆日记
    const favoritedJournals = (chat.memoryJournals || [])
        .filter(j => j.isFavorited)
        .map(j => `标题：${j.title}\n内容：${j.content}`)
        .join('\n\n---\n\n');

    let prompt = `请根据以下背景信息和通话记录，生成一段简短的聊天记录总结。\n\n`;

    prompt += `<char_settings>\n`;
    prompt += `角色名：${chat.realName}\n`;
    prompt += `角色设定：${getEffectivePersona(chat) || "无"}\n`;
    if (worldBooksBefore) prompt += `${worldBooksBefore}\n`;
    if (worldBooksMiddle) prompt += `${worldBooksMiddle}\n`;
    if (worldBooksAfter) prompt += `${worldBooksAfter}\n`;
    prompt += `</char_settings>\n\n`;

    prompt += `<user_settings>\n`;
    prompt += `用户称呼：${chat.myName}\n`;
    prompt += `用户人设：${chat.myPersona || "无"}\n`;
    prompt += `</user_settings>\n\n`;

    if (favoritedJournals) {
        prompt += `<memoir>\n`;
        prompt += `【共同回忆】\n${favoritedJournals}\n`;
        prompt += `</memoir>\n\n`;
    }

    prompt += `通话记录：\n`;
    prompt += `${callContext.map(m => `${m.role === 'ai' ? chat.realName : chat.myName} (${m.type}): ${m.content}`).join('\n')}\n\n`;

    prompt += `要求：\n`;
    prompt += `1. 第三人称叙述。\n`;
    prompt += `2. **客观平实**：使用第三人称视角，客观陈述事实。**绝对禁止使用强烈的情绪词汇**（如“极度愤怒”、“痛彻心扉”、“欣喜若狂”等），保持冷静、克制的叙述风格。\n`;
    prompt += `3. **无升华**：不要进行价值升华、感悟或总结性评价，仅记录发生了什么。\n`;
    prompt += `4. 不要包含“通话记录如下”等废话，直接输出总结内容。\n`;

    const messages = [{role: 'user', content: prompt}];
    
    const requestBody = {
        model: model,
        messages: messages,
        stream: false
    };
    
    if (provider === 'gemini') {
         requestBody.contents = [{role: 'user', parts: [{text: prompt}]}];
         delete requestBody.messages;
    }

    const endpoint = (provider === 'gemini') ? `${url}/v1beta/models/${model}:generateContent?key=${getRandomValue(key)}` : `${url}/v1/chat/completions`;
    const headers = (provider === 'gemini') ? {'Content-Type': 'application/json'} : {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${key}`
    };

    try {
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(requestBody)
        });
        const data = await response.json();
        let text = "";
        if (provider === 'gemini') {
            text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
        } else {
            text = data.choices[0].message.content;
        }
        return text.trim();
    } catch (e) {
        console.error("Summary API Error:", e);
        return null;
    }
}
