// --- 消息操作模块 (编辑、撤回、多选、截图、历史记录管理) ---

let currentMultiSelectMode = 'delete'; // 'delete' or 'capture'

function handleMessageLongPress(messageWrapper, x, y) {
    if (isInMultiSelectMode) return;
    clearTimeout(longPressTimer);
    // 清除可能存在的文本选择，防止干扰菜单点击
    if (window.getSelection) {
        window.getSelection().removeAllRanges();
    }
    const messageId = messageWrapper.dataset.id;
    const chat = (currentChatType === 'private') ? db.characters.find(c => c.id === currentChatId) : db.groups.find(g => g.id === currentChatId);
    const message = chat.history.find(m => m.id === messageId);
    if (!message) return;

    const isImageRecognitionMsg = message.parts && message.parts.some(p => p.type === 'image');
    const isVoiceMessage = /\[.*?的语音：.*?\]/.test(message.content);
    const isStickerMessage = /\[.*?的表情包：.*?\]|\[.*?发送的表情包：.*?\]/.test(message.content);
    const isPhotoVideoMessage = /\[.*?发来的照片\/视频：.*?\]/.test(message.content);
    const isTransferMessage = /\[.*?给你转账：.*?\]|\[.*?的转账：.*?\]|\[.*?向.*?转账：.*?\]/.test(message.content);
    const isGiftMessage = /\[.*?送来的礼物：.*?\]|\[.*?向.*?送来了礼物：.*?\]/.test(message.content);
    
    let invisibleRegex;
    if (chat.showStatusUpdateMsg) {
        invisibleRegex = /\[.*?(?:接收|退回).*?的转账\]|\[.*?已接收礼物\]|\[system:.*?\]|\[.*?邀请.*?加入了群聊\]|\[.*?修改群名为：.*?\]|\[system-display:.*?\]|\[avatar-action:.*?\]/;
    } else {
        invisibleRegex = /\[.*?(?:接收|退回).*?的转账\]|\[.*?更新状态为：.*?\]|\[.*?已接收礼物\]|\[system:.*?\]|\[.*?邀请.*?加入了群聊\]|\[.*?修改群名为：.*?\]|\[system-display:.*?\]|\[avatar-action:.*?\]/;
    }
    const isInvisibleMessage = invisibleRegex.test(message.content);
    const isWithdrawn = message.isWithdrawn; 

    let menuItems = [];

    if (!isWithdrawn) {
        if (!isImageRecognitionMsg && !isVoiceMessage && !isStickerMessage && !isPhotoVideoMessage && !isTransferMessage && !isGiftMessage && !isInvisibleMessage) {
            menuItems.push({label: '编辑', action: () => startMessageEdit(messageId)});
        }
        
        if (!isInvisibleMessage) {
            menuItems.push({label: '引用', action: () => startQuoteReply(messageId)});
        }

        if (message.role === 'user') {
            menuItems.push({label: '撤回', action: () => withdrawMessage(messageId)});
        }
    }

    if (!isInvisibleMessage) {
        menuItems.push({label: '收藏', action: () => { if (typeof addMessageToFavorites === 'function') addMessageToFavorites(messageId); }});
    }

    if (message.novelAiImageUrl) {
        menuItems.push({
            label: '重roll生图',
            action: () => {
                if (typeof rerollNovelAiImage === 'function') rerollNovelAiImage(messageId);
                else showToast('重roll功能未加载');
            }
        });
        menuItems.push({
            label: '保存图片',
            action: () => {
                if (typeof saveNovelAiImage === 'function') saveNovelAiImage(messageId);
                else showToast('保存功能未加载');
            }
        });
    }

    menuItems.push({
        label: isDebugMode ? '退出调试' : '进入调试',
        action: () => {
            isDebugMode = !isDebugMode;
            showToast(isDebugMode ? '已进入调试模式' : '已退出调试模式');
            renderMessages(false, true); 
        }
    });

    menuItems.push({label: '删除', action: () => enterMultiSelectMode(messageId)});
    if (!isInvisibleMessage) {
        menuItems.push({label: '多选收藏', action: () => enterMultiSelectMode(messageId, 'favorite')});
        menuItems.push({label: '多选截图', action: () => enterMultiSelectMode(messageId, 'capture')});
    }

    if (menuItems.length > 0) {
        triggerHapticFeedback('medium');
        createContextMenu(menuItems, x, y);
    }
}

function startDebugEdit(messageId) {
    exitMultiSelectMode();
    editingMessageId = messageId;
    isRawEditMode = true; 

    const chat = (currentChatType === 'private') ? db.characters.find(c => c.id === currentChatId) : db.groups.find(g => g.id === currentChatId);
    const message = chat.history.find(m => m.id === messageId);
    if (!message) return;

    const modal = document.getElementById('message-edit-modal');
    const textarea = document.getElementById('message-edit-textarea');
    const title = modal.querySelector('h3');
    const deleteBtn = document.getElementById('debug-delete-msg-btn'); 

    if (!modal.dataset.originalTitle) modal.dataset.originalTitle = title.textContent;
    title.textContent = "调试/编辑源码";

    const textMatch = message.content.match(/^\[(.*?)的消息：([\s\S]+?)\]$/);
    if (message.quote && textMatch) {
        const name = textMatch[1];
        const text = textMatch[2];
        const quoteContent = message.quote.content;
        textarea.value = `[${name}引用“${quoteContent}”并回复：${text}]`;
    } else {
        textarea.value = message.content; 
    }

    const timestampInput = document.getElementById('message-edit-timestamp');
    const timestampGroup = document.getElementById('message-edit-timestamp-group');
    if (timestampInput && timestampGroup) {
        const date = new Date(message.timestamp);
        const Y = date.getFullYear();
        const M = String(date.getMonth() + 1).padStart(2, '0');
        const D = String(date.getDate()).padStart(2, '0');
        const h = String(date.getHours()).padStart(2, '0');
        const m = String(date.getMinutes()).padStart(2, '0');
        timestampInput.value = `${Y}-${M}-${D}T${h}:${m}`;
        timestampInput.dataset.originalValue = timestampInput.value;
        timestampGroup.style.display = 'flex';
    }
    
    if (deleteBtn) {
        deleteBtn.style.display = 'block';
        const newDeleteBtn = deleteBtn.cloneNode(true);
        deleteBtn.parentNode.replaceChild(newDeleteBtn, deleteBtn);
        
        newDeleteBtn.addEventListener('click', async () => {
            if (confirm('【调试模式】确定要永久删除这条消息吗？')) {
                chat.history = chat.history.filter(m => m.id !== messageId);
                
                if (currentChatType === 'private') {
                    recalculateChatStatus(chat);
                }

                await saveData(); 
                renderMessages(false, true); 
                cancelMessageEdit(); 
                showToast('消息已删除');
            }
        });
    }

    modal.classList.add('visible');
    textarea.focus();
}

function startQuoteReply(messageId) {
    const chat = (currentChatType === 'private') ? db.characters.find(c => c.id === currentChatId) : db.groups.find(g => g.id === currentChatId);
    const message = chat.history.find(m => m.id === messageId);
    if (!message) return;

    let senderName = '';
    let senderId = '';
    if (message.role === 'user') {
        senderName = (currentChatType === 'private') ? chat.myName : chat.me.nickname;
        senderId = 'user_me';
    } else { 
        if (currentChatType === 'private') {
            senderName = chat.remarkName;
            senderId = chat.id;
        } else {
            const sender = chat.members.find(m => m.id === message.senderId);
            senderName = sender ? sender.groupNickname : '未知成员';
            senderId = sender ? sender.id : 'unknown';
        }
    }
    
    let previewContent = message.content;
    const textMatch = message.content.match(/\[.*?的消息：([\s\S]+?)\]/);
    if (textMatch) {
        previewContent = textMatch[1];
    } else if (/\[.*?的表情包：.*?\]/.test(message.content)) {
        previewContent = '[表情包]';
    } else if (/\[.*?的语音：.*?\]/.test(message.content)) {
        previewContent = '[语音]';
    } else if (/\[.*?发来的照片\/视频：.*?\]/.test(message.content)) {
        previewContent = '[照片/视频]';
    } else if (message.parts && message.parts.some(p => p.type === 'image')) {
        previewContent = '[图片]';
    }
    
    currentQuoteInfo = {
        id: message.id,
        senderId: senderId,
        senderName: senderName,
        content: previewContent.substring(0, 100) 
    };

    const previewBar = document.getElementById('reply-preview-bar');
    previewBar.querySelector('.reply-preview-name').textContent = `回复 ${senderName}`;
    previewBar.querySelector('.reply-preview-text').textContent = currentQuoteInfo.content;
    previewBar.classList.add('visible');
    
    messageInput.focus();
}

function cancelQuoteReply() {
    currentQuoteInfo = null;
    const previewBar = document.getElementById('reply-preview-bar');
    previewBar.classList.remove('visible');
}

function startMessageEdit(messageId) {
    exitMultiSelectMode();
    editingMessageId = messageId;
    isRawEditMode = false;
    const chat = (currentChatType === 'private') ? db.characters.find(c => c.id === currentChatId) : db.groups.find(g => g.id === currentChatId);
    const message = chat.history.find(m => m.id === messageId);
    if (!message) return;

    const modal = document.getElementById('message-edit-modal');
    const textarea = document.getElementById('message-edit-textarea');

    let contentToEdit = message.content;
    const plainTextMatch = contentToEdit.match(/^\[.*?：([\s\S]*)\]$/);
    if (plainTextMatch && plainTextMatch[1]) {
        contentToEdit = plainTextMatch[1].trim();
    }
    contentToEdit = contentToEdit.replace(/\[发送时间:.*?\]/g, '').trim();
    
    textarea.value = contentToEdit;

    const timestampInput = document.getElementById('message-edit-timestamp');
    const timestampGroup = document.getElementById('message-edit-timestamp-group');
    if (timestampInput && timestampGroup) {
        const date = new Date(message.timestamp);
        const Y = date.getFullYear();
        const M = String(date.getMonth() + 1).padStart(2, '0');
        const D = String(date.getDate()).padStart(2, '0');
        const h = String(date.getHours()).padStart(2, '0');
        const m = String(date.getMinutes()).padStart(2, '0');
        timestampInput.value = `${Y}-${M}-${D}T${h}:${m}`;
        timestampInput.dataset.originalValue = timestampInput.value;
        timestampGroup.style.display = 'flex';
    }

    modal.classList.add('visible');
    textarea.focus();
}

async function saveMessageEdit() {
    const newText = document.getElementById('message-edit-textarea').value.trim();
    if (!newText || !editingMessageId) {
        cancelMessageEdit();
        return;
    }

    const chat = (currentChatType === 'private') ? db.characters.find(c => c.id === currentChatId) : db.groups.find(g => g.id === currentChatId);
    const messageIndex = chat.history.findIndex(m => m.id === editingMessageId);
    if (messageIndex === -1) {
        cancelMessageEdit();
        return;
    }

    if (isRawEditMode) {
        const quoteRegex = /^\[(.*?)引用[“"]([\s\S]*?)[”"]并回复：([\s\S]*?)\]$/;
        const match = newText.match(quoteRegex);

        if (match) {
            const name = match[1];
            const quoteContent = match[2];
            const replyText = match[3];

            if (chat.history[messageIndex].quote) {
                chat.history[messageIndex].quote.content = quoteContent;

                const targetContent = quoteContent.trim();
                const originalMessage = chat.history.slice().reverse().find(m => {
                    if (m.id === chat.history[messageIndex].id) return false;
                    let text = m.content;
                    const plainTextMatch = text.match(/^\[.*?：([\s\S]*)\]$/);
                    if (plainTextMatch && plainTextMatch[1]) {
                        text = plainTextMatch[1].trim();
                    }
                    text = text.replace(/\[发送时间:.*?\]$/, '').trim();
                    return text === targetContent;
                });

                if (originalMessage) {
                    let newSenderId;
                    if (originalMessage.role === 'user') {
                        newSenderId = 'user_me';
                    } else {
                        newSenderId = originalMessage.senderId || (currentChatType === 'private' ? chat.id : 'unknown');
                    }
                    chat.history[messageIndex].quote.senderId = newSenderId;
                    chat.history[messageIndex].quote.messageId = originalMessage.id;
                }
            }
            chat.history[messageIndex].content = `[${name}的消息：${replyText}]`;
        } else {
            chat.history[messageIndex].content = newText;
        }

        if (chat.history[messageIndex].parts) {
            chat.history[messageIndex].parts = [{type: 'text', text: chat.history[messageIndex].content}];
        }
    } else {
        const oldContent = chat.history[messageIndex].content;
        const prefixMatch = oldContent.match(/(\[.*?的消息：)[\s\S]+\]/);
        let newContent;

        if (prefixMatch && prefixMatch[1]) {
            const prefix = prefixMatch[1];
            newContent = `${prefix}${newText}]`;
        } else {
            newContent = newText;
        }

        chat.history[messageIndex].content = newContent;
        if (chat.history[messageIndex].parts) {
        chat.history[messageIndex].parts = [{type: 'text', text: newContent}];
        }
    }

    const timestampInput = document.getElementById('message-edit-timestamp');
    if (timestampInput && timestampInput.value) {
        if (timestampInput.value !== timestampInput.dataset.originalValue) {
            const newTime = new Date(timestampInput.value).getTime();
            if (!isNaN(newTime)) {
                chat.history[messageIndex].timestamp = newTime;
                chat.history.sort((a, b) => a.timestamp - b.timestamp);
            }
        }
    }
    
    if (currentChatType === 'private') {
        recalculateChatStatus(chat);

        if (chat.statusPanel && chat.statusPanel.enabled && chat.statusPanel.regexPattern) {
            try {
                let pattern = chat.statusPanel.regexPattern;
                let flags = 'gs'; 

                const matchParts = pattern.match(/^\/(.*?)\/([a-z]*)$/);
                if (matchParts) {
                    pattern = matchParts[1];
                    flags = matchParts[2] || 'gs';
                    if (!flags.includes('s')) flags += 's';
                }

                const regex = new RegExp(pattern, flags);
                const match = regex.exec(chat.history[messageIndex].content);
                
                if (match) {
                    const rawStatus = match[0];
                    
                    let html = chat.statusPanel.replacePattern;
                    
                    for (let i = 1; i < match.length; i++) {
                        html = html.replace(new RegExp(`\\$${i}`, 'g'), match[i]);
                    }

                    // 更新 history 中对应的旧条目
                    if (!chat.statusPanel.history) chat.statusPanel.history = [];
                    const oldRaw = chat.history[messageIndex].statusSnapshot
                        ? chat.history[messageIndex].statusSnapshot.oldRaw || ''
                        : '';
                    const existingIndex = chat.statusPanel.history.findIndex(h => h.raw === oldRaw || h.raw === rawStatus);
                    if (existingIndex !== -1) {
                        chat.statusPanel.history[existingIndex].raw = rawStatus;
                        chat.statusPanel.history[existingIndex].html = html;
                        chat.statusPanel.history[existingIndex].timestamp = Date.now();
                    } else {
                        // 之前不是状态消息，现在编辑成了状态消息，新增一条
                        chat.statusPanel.history.unshift({
                            raw: rawStatus,
                            html: html,
                            timestamp: Date.now()
                        });
                        if (chat.statusPanel.history.length > 20) {
                            chat.statusPanel.history = chat.statusPanel.history.slice(0, 20);
                        }
                    }

                    chat.statusPanel.currentStatusRaw = rawStatus;
                    chat.statusPanel.currentStatusHtml = html;
                    
                    chat.history[messageIndex].isStatusUpdate = true;
                    chat.history[messageIndex].statusSnapshot = {
                        regex: pattern,
                        replacePattern: chat.statusPanel.replacePattern,
                        oldRaw: rawStatus
                    };
                } else {
                    // 编辑后不再匹配状态，从 history 中移除旧条目
                    if (chat.history[messageIndex].isStatusUpdate && chat.statusPanel.history) {
                        const oldRaw = chat.history[messageIndex].statusSnapshot
                            ? chat.history[messageIndex].statusSnapshot.oldRaw || ''
                            : '';
                        if (oldRaw) {
                            const removeIndex = chat.statusPanel.history.findIndex(h => h.raw === oldRaw);
                            if (removeIndex !== -1) {
                                chat.statusPanel.history.splice(removeIndex, 1);
                            }
                        }
                        // 重新计算 currentStatus 为最新的 history 条目
                        if (chat.statusPanel.history.length > 0) {
                            chat.statusPanel.currentStatusRaw = chat.statusPanel.history[0].raw;
                            chat.statusPanel.currentStatusHtml = chat.statusPanel.history[0].html;
                        } else {
                            chat.statusPanel.currentStatusRaw = '';
                            chat.statusPanel.currentStatusHtml = '';
                        }
                    }
                    chat.history[messageIndex].isStatusUpdate = false;
                    delete chat.history[messageIndex].statusSnapshot;
                }
            } catch (e) {
                console.error("编辑时解析状态栏错误:", e);
            }
        }
    }

    await saveData();
    currentPage = 1;
    renderMessages(false, true);
    renderChatList();
    
    cancelMessageEdit();
}

function cancelMessageEdit() {
    editingMessageId = null;
    isRawEditMode = false; 
    const modal = document.getElementById('message-edit-modal');
    const deleteBtn = document.getElementById('debug-delete-msg-btn');
    if (deleteBtn) deleteBtn.style.display = 'none';

    const timestampInput = document.getElementById('message-edit-timestamp');
    const timestampGroup = document.getElementById('message-edit-timestamp-group');
    if (timestampInput && timestampGroup) {
        timestampInput.value = '';
        timestampGroup.style.display = 'none';
    }

    if (modal) {
        modal.classList.remove('visible');
        const title = modal.querySelector('h3');
        if (modal.dataset.originalTitle) {
            title.textContent = modal.dataset.originalTitle;
        } else {
            title.textContent = "编辑消息";
        }
    }
}

function enterMultiSelectMode(initialMessageId, mode = 'delete') {
    isInMultiSelectMode = true;
    currentMultiSelectMode = mode;
    
    chatRoomHeaderDefault.style.display = 'none';
    chatRoomHeaderSelect.style.display = 'flex';
    document.querySelector('.chat-input-wrapper').style.display = 'none';
    
    if (mode === 'delete') {
        multiSelectBar.classList.add('visible');
        document.getElementById('multi-select-title').textContent = '选择消息';
        const delBtn = document.getElementById('delete-selected-btn');
        const favBtn = document.getElementById('favorite-selected-btn');
        if (delBtn) delBtn.style.display = '';
        if (favBtn) favBtn.style.display = 'none';
    } else if (mode === 'capture') {
        document.getElementById('capture-mode-bar').classList.add('visible');
        document.getElementById('multi-select-title').textContent = '选择截图范围';
    } else if (mode === 'favorite') {
        multiSelectBar.classList.add('visible');
        document.getElementById('multi-select-title').textContent = '选择要收藏的消息';
        const delBtn = document.getElementById('delete-selected-btn');
        const favBtn = document.getElementById('favorite-selected-btn');
        const mergeBtn = document.getElementById('favorite-merge-btn');
        if (delBtn) delBtn.style.display = 'none';
        if (favBtn) { favBtn.style.display = ''; favBtn.disabled = selectedMessageIds.size === 0; }
        if (mergeBtn) { mergeBtn.style.display = ''; mergeBtn.disabled = selectedMessageIds.size === 0; }
    }
    
    chatRoomScreen.classList.add('multi-select-active');
    selectedMessageIds.clear();
    if (initialMessageId) {
        toggleMessageSelection(initialMessageId);
    }
}

function exitMultiSelectMode() {
    isInMultiSelectMode = false;
    chatRoomHeaderDefault.style.display = 'flex';
    chatRoomHeaderSelect.style.display = 'none';
    document.querySelector('.chat-input-wrapper').style.display = 'block';
    
    multiSelectBar.classList.remove('visible');
    document.getElementById('capture-mode-bar').classList.remove('visible');
    const delBtn = document.getElementById('delete-selected-btn');
    const favBtn = document.getElementById('favorite-selected-btn');
    if (delBtn) delBtn.style.display = '';
    if (favBtn) favBtn.style.display = 'none';
    
    chatRoomScreen.classList.remove('multi-select-active');
    selectedMessageIds.forEach(id => {
        const el = messageArea.querySelector(`.message-wrapper[data-id="${id}"]`);
        if (el) el.classList.remove('multi-select-selected');
    });
    selectedMessageIds.clear();
    currentMultiSelectMode = 'delete';
}

function toggleMessageSelection(messageId) {
    const el = messageArea.querySelector(`.message-wrapper[data-id="${messageId}"]`);
    if (!el) return;
    if (selectedMessageIds.has(messageId)) {
        selectedMessageIds.delete(messageId);
        el.classList.remove('multi-select-selected');
    } else {
        selectedMessageIds.add(messageId);
        el.classList.add('multi-select-selected');
    }
    
    if (currentMultiSelectMode === 'delete') {
        selectCount.textContent = `已选择 ${selectedMessageIds.size} 项`;
        deleteSelectedBtn.disabled = selectedMessageIds.size === 0;
    } else if (currentMultiSelectMode === 'capture') {
        document.getElementById('capture-select-count').textContent = `已选择 ${selectedMessageIds.size} 项`;
    } else if (currentMultiSelectMode === 'favorite') {
        selectCount.textContent = `已选择 ${selectedMessageIds.size} 项`;
        const favBtn = document.getElementById('favorite-selected-btn');
        const mergeBtn = document.getElementById('favorite-merge-btn');
        if (favBtn) favBtn.disabled = selectedMessageIds.size === 0;
        if (mergeBtn) mergeBtn.disabled = selectedMessageIds.size === 0;
    }
}

function _captureGetSenderInfo(chat, msg) {
    if (msg.role === 'user') {
        return {
            name: currentChatType === 'private' ? (chat.myName || '我') : (chat.me && chat.me.nickname) || '我',
            avatar: currentChatType === 'private' ? (chat.myAvatar || db.myAvatar || '') : (chat.me && chat.me.avatar) || db.myAvatar || '',
            isUser: true
        };
    }
    if (currentChatType === 'group' && msg.senderId && chat.members) {
        const member = chat.members.find(m => m.id === msg.senderId);
        return {
            name: (member && (member.groupNickname || member.realName || member.name)) || chat.name || '对方',
            avatar: (member && member.avatar) || chat.avatar || '',
            isUser: false
        };
    }
    return {
        name: chat.remarkName || chat.realName || chat.name || '对方',
        avatar: chat.avatar || '',
        isUser: false
    };
}

function _captureExtractDisplayText(msg) {
    const content = msg.content || '';
    let m;
    if ((m = content.match(/\[.*?的消息[：:]([\s\S]+?)\]/))) return m[1].trim();
    if ((m = content.match(/\[.*?引用[“"]([\s\S]*?)["”]并回复[：:]([\s\S]+?)\]/))) return '回复：' + m[2].trim();
    if ((m = content.match(/\[.*?的语音[：:]([\s\S]+?)\]/))) return '🎙 ' + m[1].trim();
    if (/\[.*?的表情包[：:].*?\]|\[.*?发送的表情包[：:].*?\]/.test(content)) return '[表情包]';
    if (/\[.*?发来的照片\/视频[：:].*?\]/.test(content)) return msg.novelAiImageUrl ? '[图片]' : '[照片/视频]';
    if (/\[.*?(?:给你转账|的转账|向.*?转账)[：:].*?\]/.test(content)) return '[转账]';
    if (/\[.*?送来的礼物[：:].*?\]|\[.*?向.*?送来了礼物[：:].*?\]/.test(content)) return '[礼物]';
    if (/\[system[:：].*?\]|\[system-display[:：].*?\]/.test(content)) return content.replace(/^\[|\]$/g, '');
    return content.replace(/<[^>]+>/g, '').trim() || '[消息]';
}

function _captureFormatTime(ts) {
    const d = new Date(ts || Date.now());
    return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
}

function _captureBuildBubble(row, msg, chat) {
    const info = _captureGetSenderInfo(chat, msg);
    const avatar = document.createElement('img');
    avatar.className = 'capture-avatar';
    avatar.src = info.avatar || (info.isUser ? 'https://i.postimg.cc/L8NFrBrW/1752307494497.jpg' : 'https://i.postimg.cc/1tH6ds9g/1752301200490.jpg');
    avatar.crossOrigin = 'anonymous';

    const bubble = document.createElement('div');
    bubble.className = 'capture-bubble ' + (info.isUser ? 'sent' : 'received');

    if (msg.novelAiImageUrl) {
        const img = document.createElement('img');
        img.className = 'capture-image';
        img.src = msg.novelAiImageUrl;
        img.crossOrigin = 'anonymous';
        bubble.appendChild(img);
    } else {
        bubble.textContent = _captureExtractDisplayText(msg);
    }

    const time = document.createElement('span');
    time.className = 'capture-time';
    time.textContent = _captureFormatTime(msg.timestamp);

    if (info.isUser) {
        row.className = 'capture-message-row sent';
        row.appendChild(time);
        row.appendChild(bubble);
        row.appendChild(avatar);
    } else {
        row.className = 'capture-message-row received';
        row.appendChild(avatar);
        row.appendChild(bubble);
        row.appendChild(time);
    }
}

async function generateCapture() {
    if (selectedMessageIds.size === 0) return showToast('请至少选择一条消息');

    const selectedCount = selectedMessageIds.size;
    if (selectedCount > 50) {
        showToast('最多只能生成前 50 条消息截图');
    }

    showToast('正在生成截图，请稍候...', 3000);

    const chat = (currentChatType === 'private') ? db.characters.find(c => c.id === currentChatId) : db.groups.find(g => g.id === currentChatId);
    if (!chat || !chat.history) return showToast('找不到聊天记录');

    const sortedMessages = chat.history.filter(m => selectedMessageIds.has(m.id)).slice(0, 50);
    const sourceName = chat.remarkName || chat.realName || chat.name || '聊天';

    const tempContainer = document.createElement('div');
    tempContainer.className = 'capture-card-render';
    tempContainer.style.position = 'fixed';
    tempContainer.style.left = '-9999px';
    tempContainer.style.top = '0';
    tempContainer.style.width = '390px';
    tempContainer.style.background = '#eef0f4';
    tempContainer.style.fontFamily = '-apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", sans-serif';
    tempContainer.style.overflow = 'hidden';

    const header = document.createElement('div');
    header.className = 'capture-card-header';
    header.innerHTML = `
        <div class="capture-title">来自“${sourceName}”的聊天记录</div>
        <div class="capture-subtitle">共 ${sortedMessages.length} 条消息</div>
        <div class="capture-label">聊天记录</div>
    `;
    tempContainer.appendChild(header);

    const body = document.createElement('div');
    body.className = 'capture-card-body';
    sortedMessages.forEach(msg => {
        const row = document.createElement('div');
        _captureBuildBubble(row, msg, chat);
        body.appendChild(row);
    });
    tempContainer.appendChild(body);

    document.body.appendChild(tempContainer);

    try {
        const canvas = await html2canvas(tempContainer, {
            useCORS: true,
            allowTaint: true,
            scale: 2,
            backgroundColor: '#eef0f4',
            logging: false
        });

        const imgUrl = canvas.toDataURL('image/png');
        const previewContainer = document.getElementById('capture-preview-container');
        previewContainer.innerHTML = '';
        const img = document.createElement('img');
        img.src = imgUrl;
        img.style.maxWidth = '100%';
        img.style.borderRadius = '10px';
        previewContainer.appendChild(img);

        const downloadBtn = document.getElementById('download-capture-btn');
        if (downloadBtn) {
            downloadBtn.onclick = () => {
                const link = document.createElement('a');
                link.href = imgUrl;
                link.download = `chat-record-${Date.now()}.png`;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            };
        }

        document.getElementById('capture-result-modal').classList.add('visible');
        exitMultiSelectMode();
    } catch (error) {
        console.error('截图生成失败:', error);
        showToast('截图生成失败，请重试');
    } finally {
        if (tempContainer && tempContainer.parentNode) tempContainer.parentNode.removeChild(tempContainer);
    }
}


function _forwardRecordResolveStickerData(msg, chat) {
    const content = msg.content || '';
    const sentStickerMatch = content.match(/\[(?:.+?)发送的表情包[：:](.+?)\]/i);
    const receivedStickerMatch = content.match(/\[(?:.*?的)?表情包[：:](.+?)\]/i);
    if (msg.stickerData) return { name: (sentStickerMatch && sentStickerMatch[1] || receivedStickerMatch && receivedStickerMatch[1] || '表情包').trim(), data: msg.stickerData };
    const match = sentStickerMatch || receivedStickerMatch;
    if (!match) return null;
    const stickerName = match[1].trim();
    const groups = (chat.stickerGroups || '').split(/[,，]/).map(s => s.trim()).filter(Boolean);
    let targetSticker = null;
    if (groups.length > 0 && db.myStickers) {
        targetSticker = db.myStickers.find(s => groups.includes(s.group) && s.name === stickerName);
    }
    if (!targetSticker && db.myStickers) {
        targetSticker = db.myStickers.find(s => s.name === stickerName);
    }
    return { name: stickerName, data: targetSticker ? targetSticker.data : '' };
}

function _forwardRecordReadableLine(msg, chat) {
    const content = msg.content || '';
    const sender = msg.role === 'user'
        ? (currentChatType === 'private' ? (chat.myName || '我') : ((chat.me && chat.me.nickname) || '我'))
        : (chat.remarkName || chat.realName || chat.name || '对方');

    let m;
    if ((m = content.match(/\[.*?的消息[：:]([\s\S]+?)\]/))) return `${sender}：${m[1].trim()}`;
    if ((m = content.match(/\[.*?引用[“"]([\s\S]*?)["”]并回复[：:]([\s\S]+?)\]/))) return `${sender}：回复「${m[1].trim()}」：${m[2].trim()}`;
    if ((m = content.match(/\[.*?的语音[：:]([\s\S]+?)\]/))) return `${sender}：[语音] ${m[1].trim()}`;
    if ((m = content.match(/\[(?:.*?的)?表情包[：:](.+?)\]/i)) || (m = content.match(/\[(?:.+?)发送的表情包[：:](.+?)\]/i))) return `${sender}：[表情包：${m[1].trim()}]`;
    if ((m = content.match(/\[.*?发来的照片\/视频[：:]([\s\S]+?)\]/))) return `${sender}：[照片/视频] ${m[1].replace(/\{\{[\s\S]*?\}\}/g, '').trim()}`;
    if (/\[.*?(?:给你转账|的转账|向.*?转账)[：:].*?\]/.test(content)) return `${sender}：[转账] ${content}`;
    if (/\[.*?送来的礼物[：:].*?\]|\[.*?向.*?送来了礼物[：:].*?\]/.test(content)) return `${sender}：[礼物] ${content}`;
    return `${sender}：${content.replace(/<[^>]+>/g, '').trim() || '[消息]'}`;
}

function _forwardRecordCloneMessage(msg, chat) {
    const stickerInfo = _forwardRecordResolveStickerData(msg, chat);
    const copy = {
        id: msg.id,
        role: msg.role,
        senderId: msg.senderId || '',
        content: msg.content || '',
        textForAI: _forwardRecordReadableLine(msg, chat),
        timestamp: msg.timestamp || Date.now(),
        novelAiImageUrl: msg.novelAiImageUrl || '',
        stickerName: stickerInfo ? stickerInfo.name : '',
        stickerData: stickerInfo ? stickerInfo.data : '',
        parts: msg.parts ? JSON.parse(JSON.stringify(msg.parts)) : undefined
    };
    return copy;
}

function _forwardRecordBuildPayload(chat, messages) {
    const sourceName = chat.remarkName || chat.realName || chat.name || '聊天';
    return {
        type: 'forward-record',
        sourceName,
        count: messages.length,
        createdAt: Date.now(),
        messages: messages.map(m => _forwardRecordCloneMessage(m, chat))
    };
}

function _forwardRecordOpenTargetModal() {
    if (selectedMessageIds.size === 0) return showToast('请至少选择一条消息');
    let modal = document.getElementById('forward-record-target-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'forward-record-target-modal';
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal-window forward-record-window">
                <h3>转发聊天记录</h3>
                <div class="forward-record-subtitle">选择要转发到的对话</div>
                <div id="forward-record-target-list" class="forward-record-target-list"></div>
                <button type="button" id="forward-record-cancel-btn" class="btn btn-neutral" style="margin-top: 14px;">取消</button>
            </div>
        `;
        document.body.appendChild(modal);
        modal.querySelector('#forward-record-cancel-btn').addEventListener('click', () => modal.classList.remove('visible'));
    }

    const list = modal.querySelector('#forward-record-target-list');
    list.innerHTML = '';

    const addTarget = (type, item, title, sub, avatar) => {
        const row = document.createElement('button');
        row.type = 'button';
        row.className = 'forward-record-target-item';
        row.innerHTML = `
            <img class="forward-record-target-avatar" src="${DOMPurify.sanitize(avatar || '')}" onerror="this.style.visibility='hidden'">
            <div class="forward-record-target-info">
                <div class="forward-record-target-title">${DOMPurify.sanitize(title || '未命名')}</div>
                <div class="forward-record-target-sub">${DOMPurify.sanitize(sub || '')}</div>
            </div>
        `;
        row.addEventListener('click', () => forwardSelectedMessagesToChat(type, item.id));
        list.appendChild(row);
    };

    (db.characters || []).forEach(c => {
        addTarget('private', c, c.remarkName || c.realName || c.name || '角色', '私聊', c.avatar || '');
    });
    (db.groups || []).forEach(g => {
        addTarget('group', g, g.name || '群聊', '群聊', g.avatar || '');
    });

    modal.classList.add('visible');
}

async function forwardSelectedMessagesToChat(targetType, targetId) {
    const sourceChat = (currentChatType === 'private') ? db.characters.find(c => c.id === currentChatId) : db.groups.find(g => g.id === currentChatId);
    const targetChat = (targetType === 'private') ? db.characters.find(c => c.id === targetId) : db.groups.find(g => g.id === targetId);
    if (!sourceChat || !targetChat) return showToast('找不到目标对话');

    let selected = sourceChat.history.filter(m => selectedMessageIds.has(m.id));
    if (selected.length === 0) return showToast('请至少选择一条消息');
    if (selected.length > 50) {
        selected = selected.slice(0, 50);
        showToast('最多转发前 50 条聊天记录');
    }

    const payload = _forwardRecordBuildPayload(sourceChat, selected);
    const senderName = targetType === 'private' ? (targetChat.myName || '我') : ((targetChat.me && targetChat.me.nickname) || '我');
    const readableLines = (payload.messages || []).map((m, idx) => `${idx + 1}. ${m.textForAI || m.content || '[消息]'}`).join('\n');
    const forwardMessage = {
        id: 'msg_' + Date.now() + '_' + Math.random().toString(36).slice(2, 9),
        role: 'user',
        senderId: 'user_me',
        timestamp: Date.now(),
        content: `[${senderName}转发聊天记录：来自“${payload.sourceName}”的聊天记录，共 ${payload.count} 条消息\n${readableLines}]`,
        forwardRecord: payload
    };

    if (!targetChat.history) targetChat.history = [];
    targetChat.history.push(forwardMessage);
    await saveData();

    const modal = document.getElementById('forward-record-target-modal');
    if (modal) modal.classList.remove('visible');

    exitMultiSelectMode();
    renderChatList();

    if (currentChatId === targetId && currentChatType === targetType) {
        renderMessages(false, true);
    }
    showToast('聊天记录已转发', 'success');
}

window.forwardSelectedMessagesToChat = forwardSelectedMessagesToChat;


async function deleteSelectedMessages() {
    if (selectedMessageIds.size === 0) return;
    const deletedCount = selectedMessageIds.size;
    const chat = (currentChatType === 'private') ? db.characters.find(c => c.id === currentChatId) : db.groups.find(g => g.id === currentChatId);

    // 收集需要一并删除的关联消息 ID（思维链 + 状态栏消息）
    const idsToDelete = new Set(selectedMessageIds);

    for (const msgId of selectedMessageIds) {
        const msgIndex = chat.history.findIndex(m => m.id === msgId);
        if (msgIndex === -1) continue;
        const msg = chat.history[msgIndex];

        // 1. 如果删除的是普通 assistant 消息，查找紧邻其前面的 isThinking 消息一并删除
        if (msg.role === 'assistant' && !msg.isThinking) {
            for (let i = msgIndex - 1; i >= 0; i--) {
                const prev = chat.history[i];
                // 找到紧邻的思维链消息（时间差在 30 秒内，属于同一轮对话）
                if (prev.isThinking && prev.role === 'assistant' && (msg.timestamp - prev.timestamp) < 30000) {
                    idsToDelete.add(prev.id);
                }
                // 遇到非 thinking 的 assistant 消息或 user 消息就停止向前搜索
                if (!prev.isThinking) break;
            }
            // 同时查找紧邻其后面的 isStatusUpdate 消息
            for (let i = msgIndex + 1; i < chat.history.length; i++) {
                const next = chat.history[i];
                if (next.isStatusUpdate && next.role === 'assistant' && (next.timestamp - msg.timestamp) < 5000) {
                    idsToDelete.add(next.id);
                }
                if (!next.isStatusUpdate && !next.isThinking) break;
            }
        }

        // 2. 如果删除的消息带有状态栏快照，清理 statusPanel.history 中对应的条目
        if (msg.isStatusUpdate && msg.statusSnapshot && chat.statusPanel && chat.statusPanel.history) {
            const msgContent = msg.content;
            chat.statusPanel.history = chat.statusPanel.history.filter(h => {
                // 通过 raw 内容匹配：如果状态栏历史的 raw 文本包含在被删消息中，则移除
                return !msgContent.includes(h.raw);
            });
            // 更新当前状态为最新的历史记录，或清空
            if (chat.statusPanel.history.length > 0) {
                chat.statusPanel.currentStatusHtml = chat.statusPanel.history[0].html;
                chat.statusPanel.currentStatusRaw = chat.statusPanel.history[0].raw;
            } else {
                chat.statusPanel.currentStatusHtml = '';
                chat.statusPanel.currentStatusRaw = '';
            }
        }
    }

    chat.history = chat.history.filter(m => !idsToDelete.has(m.id));

    if (currentChatType === 'private') {
        recalculateChatStatus(chat);
    }

    await saveData();
    currentPage = 1;
    renderMessages(false, true);
    renderChatList();
    exitMultiSelectMode();
    showToast(`已删除 ${deletedCount} 条消息`);
}

async function withdrawMessage(messageId) {
    const chat = (currentChatType === 'private') ? db.characters.find(c => c.id === currentChatId) : db.groups.find(g => g.id === currentChatId);
    if (!chat) return;

    const messageIndex = chat.history.findIndex(m => m.id === messageId);
    if (messageIndex === -1) return;

    const message = chat.history[messageIndex];
    const messageTime = message.timestamp;
    const now = Date.now();

    if (now - messageTime > 2 * 60 * 1000) {
        showToast('超过2分钟的消息无法撤回');
        return;
    }

    message.isWithdrawn = true;

    const cleanContentMatch = message.content.match(/\[.*?的消息：([\s\S]+?)\]/);
    const cleanOriginalContent = cleanContentMatch ? cleanContentMatch[1] : message.content;
    message.originalContent = cleanOriginalContent; 

    const myName = (currentChatType === 'private') ? chat.myName : chat.me.nickname;

    message.content = `[${myName} 撤回了一条消息：${cleanOriginalContent}]`;

    if (currentChatType === 'private') {
        recalculateChatStatus(chat);
    }

    await saveData();

    currentPage = 1;
    renderMessages(false, true);
    renderChatList();
    showToast('消息已撤回');
    triggerHapticFeedback('medium');
}

function openDeleteChunkModal() {
    const chat = (currentChatType === 'private') ? db.characters.find(c => c.id === currentChatId) : db.groups.find(g => g.id === currentChatId);
    if (!chat || !chat.history || chat.history.length === 0) {
        showToast('当前没有聊天记录可管理');
        return;
    }
    const totalMessages = chat.history.length;
    const rangeInfo = document.getElementById('delete-chunk-range-info');
    rangeInfo.textContent = `当前聊天总消息数: ${totalMessages}`;
    
    // 计算并显示已隐藏的范围
    updateHiddenRangesInfo(chat);
    
    document.getElementById('delete-chunk-form').reset();
    document.getElementById('delete-chunk-preview-box').innerHTML = '<p style="color: #999; text-align: center; margin-top: 30px;">输入范围以预览内容</p>';
    
    document.getElementById('delete-chunk-modal').classList.add('visible');
}

function updateHiddenRangesInfo(chat) {
    const hiddenInfo = document.getElementById('delete-chunk-hidden-info');
    if (!hiddenInfo) return;

    if (!chat.history || chat.history.length === 0) {
        hiddenInfo.textContent = '';
        return;
    }

    const ranges = [];
    let start = -1;

    for (let i = 0; i < chat.history.length; i++) {
        const isHidden = chat.history[i].isContextDisabled;
        if (isHidden) {
            if (start === -1) start = i; // Start of a range
        } else {
            if (start !== -1) {
                // End of a range
                ranges.push(start === i - 1 ? `${start + 1}` : `${start + 1}-${i}`);
                start = -1;
            }
        }
    }
    // Handle case where range goes until the end
    if (start !== -1) {
        ranges.push(start === chat.history.length - 1 ? `${start + 1}` : `${start + 1}-${chat.history.length}`);
    }

    if (ranges.length > 0) {
        hiddenInfo.textContent = `当前已隐藏范围: ${ranges.join(', ')}`;
        hiddenInfo.style.display = 'block';
    } else {
        hiddenInfo.textContent = '';
        hiddenInfo.style.display = 'none';
    }
}

function generateRangePreview(chat, startIndex, endIndex) {
    const previewBox = document.getElementById('delete-chunk-preview-box');
    if (!previewBox) return;

    if (startIndex < 0 || endIndex > chat.history.length || startIndex >= endIndex) {
        previewBox.innerHTML = '<p style="color: #999; text-align: center; margin-top: 30px;">无效的范围</p>';
        return;
    }

    const messagesToPreview = chat.history.slice(startIndex, endIndex);
    const totalToPreview = messagesToPreview.length;
    let previewHtml = '';

    if (totalToPreview === 0) {
        previewBox.innerHTML = '<p style="color: #999; text-align: center; margin-top: 30px;">范围为空</p>';
        return;
    }

    const renderMsg = (msg) => {
        const contentMatch = msg.content.match(/\[.*?的消息：([\s\S]+)\]/);
        let text = contentMatch ? contentMatch[1] : msg.content;
        text = text.replace(/</g, '<').replace(/>/g, '>'); // Escape HTML
        const sender = msg.role === 'user' ? '我' : (chat.remarkName || chat.name || '对方');
        const status = msg.isContextDisabled ? ' <span style="color:red; font-size:10px;">(已隐藏)</span>' : '';
        return `<div style="margin-bottom:4px; padding-bottom:4px; border-bottom:1px solid #eee;">
            <span style="font-weight:600; color:#555;">${sender}</span>${status}: 
            <span style="color:#666;">${text.substring(0, 60)}${text.length > 60 ? '...' : ''}</span>
        </div>`;
    };

    if (totalToPreview <= 5) {
        previewHtml = messagesToPreview.map(renderMsg).join('');
    } else {
        const firstThree = messagesToPreview.slice(0, 3);
        const lastTwo = messagesToPreview.slice(-2);
        
        previewHtml = firstThree.map(renderMsg).join('') + 
                      `<div style="text-align: center; color: #999; margin: 8px 0; font-size: 10px;">... 共 ${totalToPreview} 条 ...</div>` + 
                      lastTwo.map(renderMsg).join('');
    }
    
    previewBox.innerHTML = previewHtml;
}

function setupDeleteHistoryChunk() {
    const deleteChunkModal = document.getElementById('delete-chunk-modal');
    const startInput = document.getElementById('delete-range-start');
    const endInput = document.getElementById('delete-range-end');
    
    // Real-time Preview Logic
    const updatePreview = () => {
        const chat = (currentChatType === 'private') ? db.characters.find(c => c.id === currentChatId) : db.groups.find(g => g.id === currentChatId);
        if (!chat) return;
        
        const s = parseInt(startInput.value);
        const e = parseInt(endInput.value);
        
        if (!isNaN(s) && !isNaN(e) && s > 0 && e >= s && e <= chat.history.length) {
            generateRangePreview(chat, s - 1, e);
        }
    };

    startInput.addEventListener('input', updatePreview);
    endInput.addEventListener('input', updatePreview);

    // Button Actions
    const btnBlock = document.getElementById('btn-block-range');
    const btnRestore = document.getElementById('btn-restore-range');
    const btnDelete = document.getElementById('btn-delete-range');
    
    const getRange = () => {
        const chat = (currentChatType === 'private') ? db.characters.find(c => c.id === currentChatId) : db.groups.find(g => g.id === currentChatId);
        const s = parseInt(startInput.value);
        const e = parseInt(endInput.value);
        if (!chat || isNaN(s) || isNaN(e) || s <= 0 || e < s || e > chat.history.length) {
            showToast('请输入有效的起止范围');
            return null;
        }
        return { chat, startIndex: s - 1, endIndex: e, count: e - s + 1 };
    };

    if (btnBlock) {
        btnBlock.addEventListener('click', async () => {
            const range = getRange();
            if (!range) return;
            
            let changedCount = 0;
            const modifiedIds = [];
            for (let i = range.startIndex; i < range.endIndex; i++) {
                if (!range.chat.history[i].isContextDisabled) {
                    range.chat.history[i].isContextDisabled = true;
                    modifiedIds.push(range.chat.history[i].id);
                    changedCount++;
                }
            }
            
            if (changedCount > 0) {
                await saveData();
                showToast(`已屏蔽 ${changedCount} 条消息`);
                // Update DOM in-place
                modifiedIds.forEach(id => {
                    const el = document.querySelector(`.message-wrapper[data-id="${id}"]`);
                    if (el) el.classList.add('context-disabled');
                });
                updateHiddenRangesInfo(range.chat);
                generateRangePreview(range.chat, range.startIndex, range.endIndex);
            } else {
                showToast('选中范围内没有需要屏蔽的消息');
            }
        });
    }

    if (btnRestore) {
        btnRestore.addEventListener('click', async () => {
            const range = getRange();
            if (!range) return;
            
            let changedCount = 0;
            const modifiedIds = [];
            for (let i = range.startIndex; i < range.endIndex; i++) {
                const msg = range.chat.history[i];
                // 检查是否为思维链消息 (isThinking 标记或内容以 <thinking> 开头)
                const isThinkingMsg = msg.isThinking || (msg.content && typeof msg.content === 'string' && msg.content.trim().startsWith('<thinking>'));
                
                if (msg.isContextDisabled && !isThinkingMsg) {
                    msg.isContextDisabled = false;
                    modifiedIds.push(msg.id);
                    changedCount++;
                }
            }
            
            if (changedCount > 0) {
                await saveData();
                showToast(`已恢复 ${changedCount} 条消息`);
                // Update DOM in-place
                modifiedIds.forEach(id => {
                    const el = document.querySelector(`.message-wrapper[data-id="${id}"]`);
                    if (el) el.classList.remove('context-disabled');
                });
                updateHiddenRangesInfo(range.chat);
                generateRangePreview(range.chat, range.startIndex, range.endIndex);
            } else {
                showToast('选中范围内没有被屏蔽的消息');
            }
        });
    }

    // Delete Logic (With Confirmation)
    const confirmDeleteModal = document.getElementById('delete-chunk-confirm-modal');
    const confirmDeleteBtn = document.getElementById('confirm-delete-chunk-btn');
    const cancelDeleteBtn = document.getElementById('cancel-delete-chunk-btn');
    
    let pendingDeleteRange = null;

    if (btnDelete) {
        btnDelete.addEventListener('click', () => {
            const range = getRange();
            if (range) {
                pendingDeleteRange = range;
                confirmDeleteModal.classList.add('visible');
            }
        });
    }

    if (confirmDeleteBtn) {
        confirmDeleteBtn.addEventListener('click', async () => {
            if (!pendingDeleteRange) return;
            
            const { chat, startIndex, count } = pendingDeleteRange;

            // 清理被删除消息中关联的状态栏历史
            if (currentChatType === 'private' && chat.statusPanel && chat.statusPanel.history) {
                const deletedMsgs = chat.history.slice(startIndex, startIndex + count);
                for (const msg of deletedMsgs) {
                    if (msg.isStatusUpdate && msg.statusSnapshot) {
                        chat.statusPanel.history = chat.statusPanel.history.filter(h => !msg.content.includes(h.raw));
                    }
                }
                if (chat.statusPanel.history.length > 0) {
                    chat.statusPanel.currentStatusHtml = chat.statusPanel.history[0].html;
                    chat.statusPanel.currentStatusRaw = chat.statusPanel.history[0].raw;
                } else {
                    chat.statusPanel.currentStatusHtml = '';
                    chat.statusPanel.currentStatusRaw = '';
                }
            }

            chat.history.splice(startIndex, count);

            if (currentChatType === 'private') {
                recalculateChatStatus(chat);
            }

            await saveData();
            confirmDeleteModal.classList.remove('visible');
            deleteChunkModal.classList.remove('visible');
            showToast(`已永久删除 ${count} 条消息`);
            
            currentPage = 1;
            renderMessages(false, true);
            renderChatList();
            
            pendingDeleteRange = null;
        });
    }

    if (cancelDeleteBtn) {
        cancelDeleteBtn.addEventListener('click', () => {
            confirmDeleteModal.classList.remove('visible');
            pendingDeleteRange = null;
        });
    }

    document.getElementById('close-delete-modal-btn').addEventListener('click', () => {
        deleteChunkModal.classList.remove('visible');
    });
}

// 重新计算并更新角色状态
function recalculateChatStatus(chat) {
    if (!chat || !chat.history) return;
    
    // 仅针对私聊且非群聊
    // 注意：虽然函数参数叫 chat，但在调用处需确保是 private 类型或者在这里判断
    // 由于群聊没有状态栏，这里主要针对 private
    // 但为了通用性，我们可以检查 chat.realName 是否存在
    
    if (!chat.realName) return; // 简单判断，群聊通常没有单人的 realName 用于状态更新（群聊逻辑不同）

    const updateStatusRegex = new RegExp(`\\[${chat.realName}更新状态为：(.*?)\\]`);
    let foundStatus = '在线'; // 默认状态

    // 倒序遍历历史记录
    for (let i = chat.history.length - 1; i >= 0; i--) {
        const msg = chat.history[i];
        // 忽略被撤回的消息
        if (msg.isWithdrawn) continue;

        const match = msg.content.match(updateStatusRegex);
        if (match) {
            foundStatus = match[1];
            break; // 找到最近的一个状态，停止遍历
        }
    }

    // 更新状态
    chat.status = foundStatus;
    
    // 如果当前正在该聊天室，实时更新 UI
    if (currentChatId === chat.id) {
        const statusTextEl = document.getElementById('chat-room-status-text');
        if (statusTextEl) {
            statusTextEl.textContent = foundStatus;
        }
    }
}

// 在当前编辑的消息下方插入新消息
function insertMessageBelow() {
    if (!editingMessageId) {
        showToast('无法获取当前编辑的消息');
        return;
    }

    // 显示自定义插入消息弹窗
    const insertModal = document.getElementById('insert-message-modal');
    const insertTextarea = document.getElementById('insert-message-textarea');
    
    if (!insertModal || !insertTextarea) {
        showToast('弹窗元素不存在，请刷新页面');
        return;
    }
    
    insertTextarea.value = '';
    insertModal.classList.add('visible');
    insertTextarea.focus();
}

// 确认插入新消息
async function confirmInsertMessage() {
    const newContent = document.getElementById('insert-message-textarea').value.trim();
    if (!newContent) {
        showToast('请输入消息内容');
        return;
    }

    const chat = (currentChatType === 'private') ? db.characters.find(c => c.id === currentChatId) : db.groups.find(g => g.id === currentChatId);
    if (!chat) {
        showToast('无法获取聊天数据');
        return;
    }

    const currentMessageIndex = chat.history.findIndex(m => m.id === editingMessageId);
    if (currentMessageIndex === -1) {
        showToast('找不到当前消息');
        return;
    }

    const currentMessage = chat.history[currentMessageIndex];
    
    // 计算新消息的时间戳
    let newTimestamp;
    if (currentMessageIndex < chat.history.length - 1) {
        const nextMessage = chat.history[currentMessageIndex + 1];
        // 在当前消息和下一条消息之间插入（取中间时间）
        newTimestamp = Math.floor((currentMessage.timestamp + nextMessage.timestamp) / 2);
    } else {
        // 如果当前消息是最后一条，则在其后1分钟
        newTimestamp = currentMessage.timestamp + 60000;
    }

    // 创建新消息：跟随当前被编辑消息的发送方。
    // 修复：在 char 消息下方点“新增消息”时，不能再强制写成 user。
    const isAssistantInsert = currentMessage.role === 'assistant' || currentMessage.role === 'system';
    let senderLabel = chat.myName || '我';
    let newRole = 'user';
    let newSenderId = 'user_me';

    if (isAssistantInsert) {
        newRole = 'assistant';
        if (currentChatType === 'private') {
            senderLabel = chat.realName || chat.remarkName || chat.name || '对方';
            newSenderId = undefined;
        } else {
            const sourceSender = chat.members && currentMessage.senderId
                ? chat.members.find(m => m.id === currentMessage.senderId)
                : null;
            senderLabel = (sourceSender && (sourceSender.realName || sourceSender.groupNickname || sourceSender.name)) || currentMessage.name || chat.name || '对方';
            newSenderId = currentMessage.senderId;
        }
    }

    const newMessage = {
        id: 'msg_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
        content: `[${senderLabel}的消息：${newContent}]`,
        timestamp: newTimestamp,
        role: newRole
    };

    if (newSenderId) newMessage.senderId = newSenderId;
    if (isAssistantInsert && currentMessage.isStatusUpdate) newMessage.isStatusUpdate = false;

    // 插入新消息到数组
    chat.history.splice(currentMessageIndex + 1, 0, newMessage);

    // 保存数据
    if (currentChatType === 'private') {
        recalculateChatStatus(chat);
    }

    await saveData();
    currentPage = 1;
    renderMessages(false, true);
    renderChatList();

    // 关闭插入弹窗和编辑弹窗
    document.getElementById('insert-message-modal').classList.remove('visible');
    cancelMessageEdit();
    
    showToast('新消息已插入');
}
